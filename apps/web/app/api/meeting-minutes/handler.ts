import { Hono } from 'hono';
import { z } from 'zod';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { db } from '../../../db';
import { meetingMinutes, ctaItems } from '../../../db/schema';
import { requireSecretary } from '../../../lib/middleware/auth';
import { extractDocumentText } from '../../../lib/extractDocumentText';
import { reviewMeetingMinutesText } from '../../../lib/aiMinutesReview';
import { applyFindingsToDocument } from '../../../lib/applyFindingsToDocument';
import { sendNotulaEmail } from '../../../lib/sendEmailGmail';
import { downloadObject, uploadObject } from '../../../lib/objectStorage';
import { loadActiveAiCallConfig, loadMinutesReviewSystemPrompt } from '../../../lib/aiConfig';
import { parseIsoDateOrNull } from '../../../lib/utils/date';
import { buildUnitKerjaHints, normalizeDetectedUnit } from '../../../lib/unitKerjaMatching';
import { emailConfigs } from '../../../db/schema';
import { unitKerja } from '../../../db/schema';
import { decrypt } from '../../../lib/encryption';
import { createRateLimitMiddleware } from '../../../lib/middleware/rateLimit';
import type { AiCallConfig } from '../../../lib/aiClient';
import { validateUserScopedStoragePath } from '../../../lib/storageAccess';
import { automationMinutesFromStartedAt, recordMinutesCtaSavings } from '../../../lib/timeSavings';

const app = new Hono();

function parseJsonArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

const createMeetingMinuteSchema = z.object({
  title: z.string().min(1),
  meetingDate: z.string().min(1),
  participantsCount: z.number().int().nonnegative().optional(),
  participantsEmails: z.array(z.string().email()).optional(),
  filename: z.string().min(1),
  fileType: z.string().min(1),
  fileSize: z.number().int().nonnegative(),
  storagePath: z.string().min(1),
});

const updateMeetingMinuteSchema = z.object({
  title: z.string().min(1).optional(),
  meetingDate: z.string().min(1).optional(),
  participantsCount: z.number().int().nonnegative().optional(),
  participantsEmails: z.array(z.string().email()).optional(),
  status: z.string().optional(),
});

const approveFindingsSchema = z.object({
  approvedIndices: z.array(z.number().int().nonnegative()),
});

const distributeSchema = z.object({
  /** Penerima email. unitKerjaId opsional — dipakai untuk filter CTA per unit */
  recipients: z
    .array(
      z.object({
        email: z.string().email(),
        unitKerjaId: z.string().uuid().optional(),
        unitName: z.string().optional(),
      }),
    )
    .min(1),
  subject: z.string().min(1),
  message: z.string().optional(),
});

app.get('/', async (c) => {
  const dbUser = await requireSecretary(c);
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  const rows = await db
    .select()
    .from(meetingMinutes)
    .where(eq(meetingMinutes.userId, dbUser.id))
    .orderBy(desc(meetingMinutes.createdAt));

  return c.json({ data: rows });
});

app.post('/', async (c) => {
  const dbUser = await requireSecretary(c);
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  const body = await c.req.json();
  const parsed = createMeetingMinuteSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);

  const validatedPath = validateUserScopedStoragePath(dbUser.id, parsed.data.storagePath);
  if (!validatedPath.ok) return c.json({ error: validatedPath.error }, 400);

  const [created] = await db
    .insert(meetingMinutes)
    .values({
      userId: dbUser.id,
      title: parsed.data.title,
      meetingDate: parsed.data.meetingDate,
      participantsCount: parsed.data.participantsCount ?? 0,
      participantsEmails: parsed.data.participantsEmails?.length ? parsed.data.participantsEmails : null,
      filename: parsed.data.filename,
      fileType: parsed.data.fileType,
      fileSize: parsed.data.fileSize,
      storagePath: validatedPath.normalizedPath,
      status: 'uploaded',
    })
    .returning();

  return c.json({ data: created }, 201);
});

app.get('/:id', async (c) => {
  const dbUser = await requireSecretary(c);
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  const id = c.req.param('id');
  const [row] = await db
    .select()
    .from(meetingMinutes)
    .where(and(eq(meetingMinutes.id, id), eq(meetingMinutes.userId, dbUser.id)))
    .limit(1);

  if (!row) return c.json({ error: 'Meeting minute not found' }, 404);
  return c.json({ data: row });
});

app.patch('/:id', async (c) => {
  const dbUser = await requireSecretary(c);
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  const id = c.req.param('id');
  const body = await c.req.json();
  const parsed = updateMeetingMinuteSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);

  const { participantsEmails, ...rest } = parsed.data;
  const [updated] = await db
    .update(meetingMinutes)
    .set({
      ...rest,
      ...(participantsEmails !== undefined
        ? { participantsEmails: participantsEmails.length ? participantsEmails : null }
        : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(meetingMinutes.id, id), eq(meetingMinutes.userId, dbUser.id)))
    .returning();

  if (!updated) return c.json({ error: 'Meeting minute not found' }, 404);
  return c.json({ data: updated });
});

// Apply rate limiting to AI analysis endpoints
app.post('/:id/analyze', createRateLimitMiddleware(5, 60000), async (c) => {
  const dbUser = await requireSecretary(c);
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  const id = c.req.param('id');
  const startedAtMs = Date.now();

  try {
    const [minute] = await db
      .select()
      .from(meetingMinutes)
      .where(and(eq(meetingMinutes.id, id), eq(meetingMinutes.userId, dbUser.id)))
      .limit(1);

    if (!minute) return c.json({ error: 'Meeting minute not found' }, { status: 404 });

    await db
      .update(meetingMinutes)
      .set({ status: 'processing', analysisError: null, updatedAt: new Date() })
      .where(and(eq(meetingMinutes.id, id), eq(meetingMinutes.userId, dbUser.id)));

    const downloaded = await downloadObject(minute.storagePath);
    const bytes = downloaded.body;
    const text = await extractDocumentText({
      bytes,
      mimeType: minute.fileType,
      filename: minute.filename || minute.title,
    });

    if (!text.trim()) {
      throw new Error('Notula tidak mengandung teks yang bisa diekstrak (mungkin scan PDF tanpa OCR).');
    }

    const cfg =
      (await loadActiveAiCallConfig(dbUser.id)) ??
      (process.env.E2E_MOCK_AI === '1'
        ? ({
            kind: 'openai_compatible',
            apiKey: 'e2e-mock',
            baseUrl: 'https://example.invalid',
            model: 'e2e-mock',
          } satisfies AiCallConfig)
        : undefined);
    if (!cfg) throw new Error('Provider AI aktif belum diset. Buka Pengaturan untuk mengaktifkan provider.');

    const systemPrompt = await loadMinutesReviewSystemPrompt(dbUser.id);
    const unitKerjaRows = await db
      .select()
      .from(unitKerja)
      .where(isNull(unitKerja.userId));

    const review = await reviewMeetingMinutesText({
      text,
      systemPrompt,
      cfg,
      unitHints: buildUnitKerjaHints(unitKerjaRows),
    });

    const normalizedCtas = review.ctas.map((cta) => ({
      ...cta,
      unit: normalizeDetectedUnit({
        detectedUnit: cta.unit,
        title: cta.title,
        action: cta.action,
        pic: cta.pic,
        rows: unitKerjaRows,
      }),
    }));

    const typoCount = review.findings.filter((f) => f.kind === 'typo').length;
    const ambiguousCount = review.findings.filter((f) => f.kind === 'ambiguous').length;
    const ctaCount = normalizedCtas.length;
    const detectedParticipants = review.participantsCount ?? 0;

    await db.delete(ctaItems).where(eq(ctaItems.meetingMinuteId, id));

    const now = new Date();
    const rowsToInsert = normalizedCtas.map((cta) => ({
      meetingMinuteId: id,
      title: cta.title,
      action: cta.action,
      picName: cta.pic,
      unit: cta.unit,
      deadline: parseIsoDateOrNull(cta.deadline),
      priority: cta.priority,
      status: cta.status === 'done' ? 'completed' : cta.status === 'in_progress' ? 'in-progress' : 'pending',
      createdAt: now,
      updatedAt: now,
    }));

    if (rowsToInsert.length > 0) {
      await db.insert(ctaItems).values(rowsToInsert);
    }

    const [updated] = await db
      .update(meetingMinutes)
      .set({
        status: 'reviewed',
        typoCount,
        ambiguousCount,
        ctaCount,
        // Update participantsCount dari hasil AI jika terdeteksi
        ...(detectedParticipants > 0 ? { participantsCount: detectedParticipants } : {}),
        findingsJson: review.findings,
        ctasJson: normalizedCtas,
        analysisError: null,
        analyzedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(meetingMinutes.id, id), eq(meetingMinutes.userId, dbUser.id)))
      .returning();

    await recordMinutesCtaSavings({
      userId: dbUser.id,
      meetingMinuteId: id,
      typoCount,
      ambiguousCount,
      ctaCount,
      actualAutomationMinutes: automationMinutesFromStartedAt(startedAtMs),
      title: minute.title,
    });

    return c.json({ data: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';

    await db
      .update(meetingMinutes)
      .set({ status: 'error', analysisError: message, updatedAt: new Date() })
      .where(and(eq(meetingMinutes.id, id), eq(meetingMinutes.userId, dbUser.id)));

    // Log the full error server-side but return generic message to client
    console.error('[meeting-minutes/analyze] Error:', err);
    return c.json({ error: 'Analysis failed. Please try again later.' }, 500);
  }
});

app.post('/:id/approve-findings', async (c) => {
  const dbUser = await requireSecretary(c);
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  const id = c.req.param('id');
  const body = await c.req.json();
  const parsed = approveFindingsSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);

  const [minuteRow] = await db
    .select()
    .from(meetingMinutes)
    .where(and(eq(meetingMinutes.id, id), eq(meetingMinutes.userId, dbUser.id)))
    .limit(1);

  if (!minuteRow) return c.json({ error: 'Meeting minute not found' }, 404);
  if (minuteRow.status !== 'reviewed' && minuteRow.status !== 'approved') {
    return c.json({ error: 'Notula belum direview AI. Jalankan analisis terlebih dahulu.' }, 400);
  }

  const { approvedIndices } = parsed.data;

  // Build list of approved ApprovedFinding objects from stored findings JSON
  let correctedStoragePath: string | null = minuteRow.correctedStoragePath ?? null;
  let correctedFilename: string | null = minuteRow.correctedFilename ?? null;
  let correctedAt: Date | null = minuteRow.correctedAt ?? null;

  if (approvedIndices.length > 0 && minuteRow.findingsJson) {
    try {
      const allFindings = parseJsonArray<{
        originalText: string;
        suggestedText: string;
      }>(minuteRow.findingsJson);

      const approvedFindings = approvedIndices
        .filter((i) => i >= 0 && i < allFindings.length)
        .map((i) => ({
          originalText: allFindings[i]!.originalText,
          suggestedText: allFindings[i]!.suggestedText,
        }));

      if (approvedFindings.length > 0) {
        const downloaded = await downloadObject(minuteRow.storagePath);
        const result = await applyFindingsToDocument({
          bytes: downloaded.body,
          mimeType: minuteRow.fileType,
          filename: minuteRow.filename || minuteRow.title,
          findings: approvedFindings,
        });

        // Upload file yang sudah dikoreksi ke storage di subfolder corrected/
        const originalPath = minuteRow.storagePath;
        const pathParts = originalPath.split('/');
        pathParts[pathParts.length - 1] = `corrected_${result.filename}`;
        const newPath = pathParts.join('/');

        await uploadObject({
          path: newPath,
          body: result.buffer,
          contentType: result.mimeType,
          upsert: true,
        });

        correctedStoragePath = newPath;
        correctedFilename = result.filename;
        correctedAt = new Date();
      }
    } catch (applyErr) {
      // Koreksi dokumen gagal — tetap simpan approved indices, tapi tandai error
      console.error('[approve-findings] apply document error:', applyErr);
      // Tidak throw — persetujuan tetap disimpan, hanya koreksi dokumen yang gagal
    }
  }

  const [updated] = await db
    .update(meetingMinutes)
    .set({
      approvedFindingsJson: approvedIndices,
      correctedStoragePath,
      correctedFilename,
      correctedAt,
      status: 'approved',
      updatedAt: new Date(),
    })
      .where(and(eq(meetingMinutes.id, id), eq(meetingMinutes.userId, dbUser.id)))
    .returning();

  const minute = updated;

  if (!minute) return c.json({ error: 'Meeting minute not found' }, 404);
  return c.json({ data: minute });
});

app.get('/:id/download-corrected', async (c) => {
  const dbUser = await requireSecretary(c);
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  const id = c.req.param('id');
  const [minute] = await db
    .select()
    .from(meetingMinutes)
    .where(and(eq(meetingMinutes.id, id), eq(meetingMinutes.userId, dbUser.id)))
    .limit(1);

  if (!minute) return c.json({ error: 'Meeting minute not found' }, 404);
  if (!minute.correctedStoragePath) {
    return c.json({ error: 'Dokumen terkoreksi belum tersedia. Setujui temuan terlebih dahulu.' }, 404);
  }

  const downloaded = await downloadObject(minute.correctedStoragePath);
  const body = downloaded.body;
  const filename = minute.correctedFilename || 'notula_terkoreksi.docx';
  const mime = downloaded.contentType || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  return new Response(Buffer.from(body), {
    headers: {
      'Content-Type': mime,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
      'Content-Length': String(body.byteLength),
    },
  });
});

app.post('/:id/distribute', async (c) => {
  const dbUser = await requireSecretary(c);
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  const id = c.req.param('id');
  const body = await c.req.json();
  const parsed = distributeSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);

  const [minute] = await db
    .select()
    .from(meetingMinutes)
    .where(and(eq(meetingMinutes.id, id), eq(meetingMinutes.userId, dbUser.id)))
    .limit(1);

  if (!minute) return c.json({ error: 'Meeting minute not found' }, 404);

  // Load email config untuk kirim via Gmail
  const [emailCfg] = await db
    .select()
    .from(emailConfigs)
    .where(eq(emailConfigs.userId, dbUser.id))
    .limit(1);

  // Load semua CTA notula
  const allCtas = await db
    .select()
    .from(ctaItems)
    .where(eq(ctaItems.meetingMinuteId, id));

  // Load unit kerja untuk alias matching
  const unitKerjaRows = await db
    .select()
    .from(unitKerja)
    .where(isNull(unitKerja.userId));

  const { recipients, subject, message } = parsed.data;
  const sentTo: string[] = [];
  const errors: string[] = [];

  if (emailCfg) {
    for (const recipient of recipients) {
      try {
        // Filter CTA untuk penerima ini berdasarkan unit kerja
        let recipientCtas = allCtas;
        if (recipient.unitKerjaId || recipient.unitName) {
          // Cari unit kerja yang cocok
          const uk = unitKerjaRows.find((u) => u.id === recipient.unitKerjaId);
          const matchNames: string[] = [];
          if (uk) {
            matchNames.push(uk.name.toLowerCase());
            try {
              const aliases = JSON.parse(uk.aliasesJson) as string[];
              aliases.forEach((a) => matchNames.push(a.toLowerCase()));
            } catch { /* ignore */ }
          }
          if (recipient.unitName) matchNames.push(recipient.unitName.toLowerCase());

          if (matchNames.length > 0) {
            recipientCtas = allCtas.filter((cta) => {
              const unit = (cta.unit ?? '').toLowerCase();
              return matchNames.some((m) => unit.includes(m) || m.includes(unit));
            });
            // Jika tidak ada CTA spesifik, kirim semua CTA (agar tidak kosong)
            if (recipientCtas.length === 0) recipientCtas = allCtas;
          }
        }

        await sendNotulaEmail({
          from: {
            name: emailCfg.fromName,
            address: emailCfg.gmailAddress,
            appPassword: decrypt(emailCfg.gmailAppPassword),
          },
          to: recipient.email,
          subject,
          notula: {
            title: minute.title,
            meetingDate: minute.meetingDate,
            participantsCount: minute.participantsCount,
          },
          additionalMessage: message,
          ctas: recipientCtas.map((c) => ({
            title: c.title,
            action: c.action,
            picName: c.picName,
            unit: c.unit,
            deadline: c.deadline,
            priority: c.priority as 'low' | 'medium' | 'high',
          })),
        });
        sentTo.push(recipient.email);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        errors.push(`${recipient.email}: ${msg}`);
        console.error(`[distribute] failed to send to ${recipient.email}:`, err);
      }
    }
  } else {
    console.info(
      `[distribute] No email config — skipping send. minute=${id} to=${recipients.map((r) => r.email).join(',')}`,
    );
  }

  const allEmails = recipients.map((r) => r.email);
  const [updated] = await db
    .update(meetingMinutes)
    .set({
      status: errors.length < recipients.length ? 'distributed' : minute.status,
      participantsEmails: allEmails,
      distributedAt: errors.length < recipients.length ? new Date() : minute.distributedAt,
      updatedAt: new Date(),
    })
    .where(and(eq(meetingMinutes.id, id), eq(meetingMinutes.userId, dbUser.id)))
    .returning();

  return c.json({
    data: updated,
    meta: {
      sent: sentTo.length,
      errors: errors.length > 0 ? errors : undefined,
      emailConfigured: !!emailCfg,
    },
  });
});

app.get('/:id/ctas', async (c) => {
  const dbUser = await requireSecretary(c);
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  const id = c.req.param('id');
  const [minute] = await db
    .select()
    .from(meetingMinutes)
    .where(and(eq(meetingMinutes.id, id), eq(meetingMinutes.userId, dbUser.id)))
    .limit(1);

  if (!minute) return c.json({ error: 'Meeting minute not found' }, 404);

  const rows = await db
    .select()
    .from(ctaItems)
    .where(eq(ctaItems.meetingMinuteId, id))
    .orderBy(desc(ctaItems.createdAt));

  return c.json({ data: rows });
});

export default app;
