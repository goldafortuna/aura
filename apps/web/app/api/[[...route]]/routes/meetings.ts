import { Hono } from 'hono';
import { and, asc, desc, eq, gte, isNull, lte } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../../../db';
import { ctaItems, emailConfigs, meetingMinutes, unitKerja } from '../../../../db/schema';
import { extractDocumentText } from '../../../../lib/extractDocumentText';
import { reviewMeetingMinutesText } from '../../../../lib/aiMinutesReview';
import { applyFindingsToDocument } from '../../../../lib/applyFindingsToDocument';
import { resolveStoredSmtpConfig, sendNotulaEmail } from '../../../../lib/smtpEmail';
import { decrypt } from '../../../../lib/encryption';
import { downloadObject, uploadObject } from '../../../../lib/objectStorage';
import { requireSecretary } from '../_lib/auth';
import { parseIsoDateOrNull, loadMinutesReviewSystemPrompt, loadActiveAiCallConfig } from '../_lib/helpers';
import { internalServerError } from '../../../../lib/httpErrors';
import { validateUserScopedStoragePath } from '../../../../lib/storageAccess';

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
  recipients: z.array(z.object({
    email: z.string().email(),
    unitKerjaId: z.string().uuid().optional(),
    unitName: z.string().optional(),
  })).min(1),
  subject: z.string().min(1),
  message: z.string().optional(),
});

const updateCtaSchema = z.object({
  title: z.string().min(1).optional(),
  action: z.string().min(1).optional(),
  picName: z.string().nullable().optional(),
  unit: z.string().nullable().optional(),
  deadline: z.string().nullable().optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  status: z.enum(['pending', 'in-progress', 'completed']).optional(),
});

// ─── Meeting Minutes Router ────────────────────────────────────────────────────

export const meetingsRouter = new Hono();

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

meetingsRouter.get('/', async (c) => {
  const dbUser = await requireSecretary();
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  const rows = await db.select().from(meetingMinutes).where(eq(meetingMinutes.userId, dbUser.id)).orderBy(desc(meetingMinutes.createdAt));
  return c.json({ data: rows });
});

meetingsRouter.post('/', async (c) => {
  const dbUser = await requireSecretary();
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  const body = await c.req.json();
  const parsed = createMeetingMinuteSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);

  const validatedPath = validateUserScopedStoragePath(dbUser.id, parsed.data.storagePath);
  if (!validatedPath.ok) return c.json({ error: validatedPath.error }, 400);

  const [created] = await db.insert(meetingMinutes).values({
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
  }).returning();

  return c.json({ data: created }, 201);
});

meetingsRouter.get('/:id', async (c) => {
  const dbUser = await requireSecretary();
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  const id = c.req.param('id');
  const [row] = await db.select().from(meetingMinutes).where(and(eq(meetingMinutes.id, id), eq(meetingMinutes.userId, dbUser.id))).limit(1);
  if (!row) return c.json({ error: 'Meeting minute not found' }, 404);
  return c.json({ data: row });
});

meetingsRouter.patch('/:id', async (c) => {
  const dbUser = await requireSecretary();
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  const id = c.req.param('id');
  const body = await c.req.json();
  const parsed = updateMeetingMinuteSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);

  const { participantsEmails, ...rest } = parsed.data;
  const [updated] = await db.update(meetingMinutes).set({
    ...rest,
    ...(participantsEmails !== undefined ? { participantsEmails: participantsEmails.length ? participantsEmails : null } : {}),
    updatedAt: new Date(),
  }).where(and(eq(meetingMinutes.id, id), eq(meetingMinutes.userId, dbUser.id))).returning();

  if (!updated) return c.json({ error: 'Meeting minute not found' }, 404);
  return c.json({ data: updated });
});

meetingsRouter.post('/:id/analyze', async (c) => {
  const dbUser = await requireSecretary();
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  const id = c.req.param('id');

  try {
    const [minute] = await db.select().from(meetingMinutes).where(and(eq(meetingMinutes.id, id), eq(meetingMinutes.userId, dbUser.id))).limit(1);
    if (!minute) return c.json({ error: 'Meeting minute not found' }, { status: 404 });

    await db.update(meetingMinutes).set({ status: 'processing', analysisError: null, updatedAt: new Date() })
      .where(and(eq(meetingMinutes.id, id), eq(meetingMinutes.userId, dbUser.id)));

    const downloaded = await downloadObject(minute.storagePath);
    const text = await extractDocumentText({
      bytes: downloaded.body,
      mimeType: minute.fileType,
      filename: minute.filename || minute.title,
    });
    if (!text.trim()) throw new Error('Notula tidak mengandung teks yang bisa diekstrak (mungkin scan PDF tanpa OCR).');

    const cfg = await loadActiveAiCallConfig(dbUser.id);
    if (!cfg) throw new Error('Provider AI aktif belum diset. Buka Pengaturan untuk mengaktifkan provider.');

    const systemPrompt = await loadMinutesReviewSystemPrompt(dbUser.id);
    const review = await reviewMeetingMinutesText({ text, systemPrompt, cfg });

    const typoCount = review.findings.filter((f) => f.kind === 'typo').length;
    const ambiguousCount = review.findings.filter((f) => f.kind === 'ambiguous').length;
    const ctaCount = review.ctas.length;
    const detectedParticipants = review.participantsCount ?? 0;

    await db.delete(ctaItems).where(eq(ctaItems.meetingMinuteId, id));

    const now = new Date();
    const rowsToInsert = review.ctas.map((cta) => ({
      meetingMinuteId: id,
      title: cta.title,
      action: cta.action,
      picName: cta.pic,
      unit: null,
      deadline: parseIsoDateOrNull(cta.deadline),
      priority: cta.priority,
      status: cta.status === 'done' ? 'completed' : cta.status === 'in_progress' ? 'in-progress' : 'pending',
      createdAt: now,
      updatedAt: now,
    }));

    if (rowsToInsert.length > 0) await db.insert(ctaItems).values(rowsToInsert);

    const [updated] = await db.update(meetingMinutes).set({
      status: 'reviewed',
      typoCount,
      ambiguousCount,
      ctaCount,
      ...(detectedParticipants > 0 ? { participantsCount: detectedParticipants } : {}),
      findingsJson: review.findings,
      ctasJson: review.ctas,
      analysisError: null,
      analyzedAt: new Date(),
      updatedAt: new Date(),
    }).where(and(eq(meetingMinutes.id, id), eq(meetingMinutes.userId, dbUser.id))).returning();

    return c.json({ data: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    await db.update(meetingMinutes).set({ status: 'error', analysisError: message, updatedAt: new Date() })
      .where(and(eq(meetingMinutes.id, id), eq(meetingMinutes.userId, dbUser.id)));
    return internalServerError(c, 'meeting-minutes/analyze-legacy-route', err, 'Analysis failed. Please try again later.');
  }
});

meetingsRouter.post('/:id/approve-findings', async (c) => {
  const dbUser = await requireSecretary();
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  const id = c.req.param('id');
  const body = await c.req.json();
  const parsed = approveFindingsSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);

  const [minute] = await db.select().from(meetingMinutes).where(and(eq(meetingMinutes.id, id), eq(meetingMinutes.userId, dbUser.id))).limit(1);
  if (!minute) return c.json({ error: 'Meeting minute not found' }, 404);
  if (minute.status !== 'reviewed' && minute.status !== 'approved') {
    return c.json({ error: 'Notula belum direview AI. Jalankan analisis terlebih dahulu.' }, 400);
  }

  const { approvedIndices } = parsed.data;
  let correctedStoragePath: string | null = minute.correctedStoragePath ?? null;
  let correctedFilename: string | null = minute.correctedFilename ?? null;
  let correctedAt: Date | null = minute.correctedAt ?? null;

  if (approvedIndices.length > 0 && minute.findingsJson) {
    try {
      const allFindings = parseJsonArray<{ originalText: string; suggestedText: string }>(minute.findingsJson);
      const approvedFindings = approvedIndices
        .filter((i) => i >= 0 && i < allFindings.length)
        .map((i) => ({ originalText: allFindings[i]!.originalText, suggestedText: allFindings[i]!.suggestedText }));

      if (approvedFindings.length > 0) {
        const downloaded = await downloadObject(minute.storagePath);
        const result = await applyFindingsToDocument({
          bytes: downloaded.body,
          mimeType: minute.fileType,
          filename: minute.filename || minute.title,
          findings: approvedFindings,
        });

        const pathParts = minute.storagePath.split('/');
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
      console.error('[approve-findings] apply document error:', applyErr);
    }
  }

  const [updated] = await db.update(meetingMinutes).set({
    approvedFindingsJson: approvedIndices,
    correctedStoragePath,
    correctedFilename,
    correctedAt,
    status: 'approved',
    updatedAt: new Date(),
  }).where(and(eq(meetingMinutes.id, id), eq(meetingMinutes.userId, dbUser.id))).returning();

  return c.json({ data: updated });
});

meetingsRouter.get('/:id/download-corrected', async (c) => {
  const dbUser = await requireSecretary();
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  const id = c.req.param('id');
  const [minute] = await db.select().from(meetingMinutes).where(and(eq(meetingMinutes.id, id), eq(meetingMinutes.userId, dbUser.id))).limit(1);
  if (!minute) return c.json({ error: 'Meeting minute not found' }, 404);
  if (!minute.correctedStoragePath) return c.json({ error: 'Dokumen terkoreksi belum tersedia. Setujui temuan terlebih dahulu.' }, 404);

  let downloaded;
  try {
    downloaded = await downloadObject(minute.correctedStoragePath);
  } catch (error) {
    return internalServerError(
      c,
      'meeting-minutes/download-corrected-legacy-route',
      error,
      'Gagal mengunduh dokumen terkoreksi. Silakan coba lagi.',
    );
  }

  const ab = downloaded.body;
  const filename = minute.correctedFilename || 'notula_terkoreksi.docx';
  const mime = downloaded.contentType || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  return new Response(Buffer.from(ab), {
    headers: {
      'Content-Type': mime,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
      'Content-Length': String(ab.byteLength),
    },
  });
});

meetingsRouter.post('/:id/distribute', async (c) => {
  const dbUser = await requireSecretary();
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  const id = c.req.param('id');
  const body = await c.req.json();
  const parsed = distributeSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);

  const [minute] = await db.select().from(meetingMinutes).where(and(eq(meetingMinutes.id, id), eq(meetingMinutes.userId, dbUser.id))).limit(1);
  if (!minute) return c.json({ error: 'Meeting minute not found' }, 404);

  const [emailCfg] = await db.select().from(emailConfigs).where(eq(emailConfigs.userId, dbUser.id)).limit(1);
  const smtpConfig = emailCfg ? resolveStoredSmtpConfig(emailCfg, decrypt) : null;
  const allCtas = await db.select().from(ctaItems).where(eq(ctaItems.meetingMinuteId, id));
  const unitKerjaRows = await db.select().from(unitKerja).where(isNull(unitKerja.userId));

  const { recipients, subject, message } = parsed.data;
  const sentTo: string[] = [];
  const errors: string[] = [];

  if (smtpConfig) {
    for (const recipient of recipients) {
      let recipientCtas = allCtas;

      if (recipient.unitKerjaId) {
        const unit = unitKerjaRows.find((u) => u.id === recipient.unitKerjaId);
        if (unit) {
          const aliases: string[] = unit.aliasesJson ? JSON.parse(unit.aliasesJson) : [];
          const matchNames = [unit.name.toLowerCase(), ...aliases.map((a) => a.toLowerCase())];
          recipientCtas = allCtas.filter((cta) => {
            const unit_ = (cta.unit ?? '').toLowerCase();
            return matchNames.some((m) => unit_.includes(m) || m.includes(unit_));
          });
          if (recipientCtas.length === 0) recipientCtas = allCtas;
        }
      } else if (recipient.unitName) {
        const matchNames = [recipient.unitName.toLowerCase()];
        recipientCtas = allCtas.filter((cta) => {
          const unit_ = (cta.unit ?? '').toLowerCase();
          return matchNames.some((m) => unit_.includes(m) || m.includes(unit_));
        });
        if (recipientCtas.length === 0) recipientCtas = allCtas;
      }

      try {
        await sendNotulaEmail({
          from: smtpConfig,
          to: recipient.email,
          subject,
          notula: { title: minute.title, meetingDate: minute.meetingDate, participantsCount: minute.participantsCount },
          additionalMessage: message,
          ctas: recipientCtas.map((cta) => ({
            title: cta.title,
            action: cta.action,
            picName: cta.picName,
            unit: cta.unit,
            deadline: cta.deadline,
            priority: cta.priority as 'low' | 'medium' | 'high',
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
    console.info(`[distribute] No email config — skipping send. minute=${id} to=${recipients.map((r) => r.email).join(',')}`);
  }

  const allEmails = recipients.map((r) => r.email);
  const [updated] = await db.update(meetingMinutes).set({
    status: errors.length < recipients.length ? 'distributed' : minute.status,
    participantsEmails: allEmails,
    distributedAt: errors.length < recipients.length ? new Date() : minute.distributedAt,
    updatedAt: new Date(),
  }).where(and(eq(meetingMinutes.id, id), eq(meetingMinutes.userId, dbUser.id))).returning();

  return c.json({ data: updated, meta: { sent: sentTo.length, errors: errors.length > 0 ? errors : undefined, emailConfigured: !!smtpConfig } });
});

meetingsRouter.get('/:id/ctas', async (c) => {
  const dbUser = await requireSecretary();
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  const id = c.req.param('id');
  const [minute] = await db.select().from(meetingMinutes).where(and(eq(meetingMinutes.id, id), eq(meetingMinutes.userId, dbUser.id))).limit(1);
  if (!minute) return c.json({ error: 'Meeting minute not found' }, 404);

  const rows = await db.select().from(ctaItems).where(eq(ctaItems.meetingMinuteId, id)).orderBy(desc(ctaItems.createdAt));
  return c.json({ data: rows });
});

// ─── CTAs Router ───────────────────────────────────────────────────────────────

export const ctasRouter = new Hono();

ctasRouter.patch('/:id', async (c) => {
  const dbUser = await requireSecretary();
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  const id = c.req.param('id');
  const body = await c.req.json();
  const parsed = updateCtaSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);

  const [existing] = await db.select().from(ctaItems).where(eq(ctaItems.id, id)).limit(1);
  if (!existing) return c.json({ error: 'CTA not found' }, 404);

  const [minute] = await db.select().from(meetingMinutes)
    .where(and(eq(meetingMinutes.id, existing.meetingMinuteId), eq(meetingMinutes.userId, dbUser.id))).limit(1);
  if (!minute) return c.json({ error: 'Unauthorized' }, 401);

  const next = {
    ...parsed.data,
    deadline: 'deadline' in parsed.data ? parseIsoDateOrNull(parsed.data.deadline ?? null) : undefined,
    updatedAt: new Date(),
  };

  const [updated] = await db.update(ctaItems).set(next).where(eq(ctaItems.id, id)).returning();
  return c.json({ data: updated });
});

ctasRouter.get('/', async (c) => {
  const dbUser = await requireSecretary();
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  const { unit, status, priority, meetingDateFrom, meetingDateTo } = c.req.query();
  const conditions = [eq(meetingMinutes.userId, dbUser.id)];

  if (unit && unit !== 'all') conditions.push(eq(ctaItems.unit, unit));
  if (status && status !== 'all') conditions.push(eq(ctaItems.status, status));
  if (priority && priority !== 'all') conditions.push(eq(ctaItems.priority, priority));
  if (meetingDateFrom && /^\d{4}-\d{2}-\d{2}$/.test(meetingDateFrom)) conditions.push(gte(meetingMinutes.meetingDate, meetingDateFrom));
  if (meetingDateTo && /^\d{4}-\d{2}-\d{2}$/.test(meetingDateTo)) conditions.push(lte(meetingMinutes.meetingDate, meetingDateTo));

  const rows = await db
    .select({
      id: ctaItems.id, meetingMinuteId: ctaItems.meetingMinuteId, title: ctaItems.title, action: ctaItems.action,
      picName: ctaItems.picName, unit: ctaItems.unit, deadline: ctaItems.deadline, priority: ctaItems.priority,
      status: ctaItems.status, createdAt: ctaItems.createdAt, updatedAt: ctaItems.updatedAt,
      meetingTitle: meetingMinutes.title, meetingDate: meetingMinutes.meetingDate,
    })
    .from(ctaItems)
    .innerJoin(meetingMinutes, eq(ctaItems.meetingMinuteId, meetingMinutes.id))
    .where(and(...conditions))
    .orderBy(asc(ctaItems.deadline), desc(ctaItems.createdAt));

  return c.json({ data: rows });
});
