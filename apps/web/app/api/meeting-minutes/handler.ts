import { Hono } from 'hono';
import { z } from 'zod';
import { and, desc, eq, inArray, isNull, not } from 'drizzle-orm';
import { db } from '../../../db';
import { meetingMinutes, ctaItems } from '../../../db/schema';
import { requireSecretary } from '../../../lib/middleware/auth';
import { extractDocumentText } from '../../../lib/extractDocumentText';
import { reviewMeetingMinutesText } from '../../../lib/aiMinutesReview';
import { applyFindingsToDocument } from '../../../lib/applyFindingsToDocument';
import { resolveStoredSmtpConfig, sendNotulaEmail } from '../../../lib/smtpEmail';
import { downloadObject, uploadObject } from '../../../lib/objectStorage';
import { loadAiCallConfigCandidates, loadMinutesReviewSystemPrompt } from '../../../lib/aiConfig';
import { parseIsoDateOrNull } from '../../../lib/utils/date';
import { buildUnitKerjaHints, normalizeDetectedUnit } from '../../../lib/unitKerjaMatching';
import { emailConfigs } from '../../../db/schema';
import { unitKerja } from '../../../db/schema';
import { decrypt } from '../../../lib/encryption';
import { createRateLimitMiddleware } from '../../../lib/middleware/rateLimit';
import type { AiCallConfig } from '../../../lib/aiClient';
import { toUserFacingAiError } from '../../../lib/aiErrorMessage';
import { validateUserScopedStoragePath } from '../../../lib/storageAccess';
import { automationMinutesFromStartedAt, recordMinutesCtaSavings } from '../../../lib/timeSavings';

const app = new Hono();

async function reviewMeetingMinutesWithFallback(params: {
  text: string;
  systemPrompt: string;
  cfgCandidates: AiCallConfig[];
  unitHints?: Array<{ name: string; aliases?: string[] }>;
}): Promise<{ review: Awaited<ReturnType<typeof reviewMeetingMinutesText>>; modelUsed: string }> {
  let lastError: unknown;

  for (const cfg of params.cfgCandidates) {
    try {
      const review = await reviewMeetingMinutesText({
        text: params.text,
        systemPrompt: params.systemPrompt,
        cfg,
        unitHints: params.unitHints,
      });
      return { review, modelUsed: cfg.model };
    } catch (err) {
      lastError = err;
      console.warn('[meeting-minutes/analyze] AI provider failed:', {
        kind: cfg.kind,
        baseUrl: cfg.baseUrl,
        model: cfg.model,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  throw new Error(toUserFacingAiError(lastError, params.cfgCandidates));
}

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
  /** ID dari cta_items yang disetujui untuk masuk ke seksi Keputusan dan disimpan ke DB */
  approvedCtaIds: z.array(z.string()).optional(),
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

    const cfgCandidates = await loadAiCallConfigCandidates(dbUser.id);
    if (process.env.E2E_MOCK_AI === '1' && cfgCandidates.length === 0) {
      cfgCandidates.push({
        kind: 'openai_compatible',
        apiKey: 'e2e-mock',
        baseUrl: 'https://example.invalid',
        model: 'e2e-mock',
      });
    }
    if (cfgCandidates.length === 0) {
      throw new Error('Provider AI aktif belum diset. Buka Pengaturan untuk mengaktifkan provider.');
    }

    const systemPrompt = await loadMinutesReviewSystemPrompt(dbUser.id);
    const unitKerjaRows = await db
      .select()
      .from(unitKerja)
      .where(isNull(unitKerja.userId));

    const { review, modelUsed } = await reviewMeetingMinutesWithFallback({
      text,
      systemPrompt,
      cfgCandidates,
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
        aiModel: modelUsed,
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
    const message = toUserFacingAiError(err);

    await db
      .update(meetingMinutes)
      .set({ status: 'error', analysisError: message, updatedAt: new Date() })
      .where(and(eq(meetingMinutes.id, id), eq(meetingMinutes.userId, dbUser.id)));

    console.error('[meeting-minutes/analyze] Error:', err);
    return c.json({ error: message }, 500);
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

  const { approvedIndices, approvedCtaIds } = parsed.data;

  // ── 1. Resolve approved CTAs ──────────────────────────────────────────────
  // Fetch CTA rows that are approved for Keputusan section
  let approvedCtaRows: (typeof ctaItems.$inferSelect)[] = [];
  if (approvedCtaIds && approvedCtaIds.length > 0) {
    approvedCtaRows = await db
      .select()
      .from(ctaItems)
      .where(and(eq(ctaItems.meetingMinuteId, id), inArray(ctaItems.id, approvedCtaIds)));
  }

  // ── 2. Persist only approved CTAs to cta_items ────────────────────────────
  // When approvedCtaIds is explicitly provided (even empty), prune non-approved CTAs
  if (approvedCtaIds !== undefined) {
    if (approvedCtaIds.length === 0) {
      await db.delete(ctaItems).where(eq(ctaItems.meetingMinuteId, id));
    } else {
      await db
        .delete(ctaItems)
        .where(and(eq(ctaItems.meetingMinuteId, id), not(inArray(ctaItems.id, approvedCtaIds))));
    }
  }

  // ── 3. Build approved findings list ───────────────────────────────────────
  let approvedFindings: { originalText: string; suggestedText: string }[] = [];
  if (approvedIndices.length > 0 && minuteRow.findingsJson) {
    const allFindings = parseJsonArray<{ originalText: string; suggestedText: string }>(minuteRow.findingsJson);
    approvedFindings = approvedIndices
      .filter((i) => i >= 0 && i < allFindings.length)
      .map((i) => ({
        originalText: allFindings[i]!.originalText,
        suggestedText: allFindings[i]!.suggestedText,
      }));
  }

  // ── 4. Generate corrected document ────────────────────────────────────────
  let correctedStoragePath: string | null = minuteRow.correctedStoragePath ?? null;
  let correctedFilename: string | null = minuteRow.correctedFilename ?? null;
  let correctedAt: Date | null = minuteRow.correctedAt ?? null;

  const shouldGenerateDoc = approvedFindings.length > 0 || approvedCtaRows.length > 0;

  if (shouldGenerateDoc) {
    try {
      const downloaded = await downloadObject(minuteRow.storagePath);
      const result = await applyFindingsToDocument({
        bytes: downloaded.body,
        mimeType: minuteRow.fileType,
        filename: minuteRow.filename || minuteRow.title,
        findings: approvedFindings,
        approvedCtas: approvedCtaRows.map((c) => ({
          title: c.title,
          action: c.action,
          picName: c.picName,
          unit: c.unit,
          deadline: c.deadline ? String(c.deadline) : null,
          priority: c.priority as 'low' | 'medium' | 'high',
        })),
      });

      // Upload file terkoreksi ke storage
      const pathParts = minuteRow.storagePath.split('/');
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
    } catch (applyErr) {
      console.error('[approve-findings] apply document error:', applyErr);
      // Persetujuan tetap disimpan meski pembuatan dokumen gagal
    }
  }

  // Update ctaCount sesuai jumlah CTA yang disetujui
  const finalCtaCount =
    approvedCtaIds !== undefined ? approvedCtaIds.length : minuteRow.ctaCount;

  const [updated] = await db
    .update(meetingMinutes)
    .set({
      approvedFindingsJson: approvedIndices,
      correctedStoragePath,
      correctedFilename,
      correctedAt,
      ctaCount: finalCtaCount,
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

  // Load email config untuk kirim via SMTP
  const [emailCfg] = await db
    .select()
    .from(emailConfigs)
    .where(eq(emailConfigs.userId, dbUser.id))
    .limit(1);

  const smtpConfig = emailCfg ? resolveStoredSmtpConfig(emailCfg, decrypt) : null;

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

  if (smtpConfig) {
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
          from: smtpConfig,
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
