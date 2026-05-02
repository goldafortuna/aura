import { Hono } from 'hono';
import { z } from 'zod';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../../../db';
import { documents } from '../../../db/schema';
import { requireSecretary } from '../../../lib/middleware/auth';
import { extractDocumentText } from '../../../lib/extractDocumentText';
import { reviewOfficialDocumentText } from '../../../lib/aiDocumentReview';
import { downloadObject, removeObjects } from '../../../lib/objectStorage';
import { loadAiCallConfigCandidates, loadDocumentReviewSystemPrompt } from '../../../lib/aiConfig';
import type { AiCallConfig } from '../../../lib/aiClient';
import { toUserFacingAiError } from '../../../lib/aiErrorMessage';
import { createRateLimitMiddleware } from '../../../lib/middleware/rateLimit';
import { validateUserScopedStoragePath } from '../../../lib/storageAccess';
import { internalServerError } from '../../../lib/httpErrors';
import { automationMinutesFromStartedAt, recordDocumentReviewSavings } from '../../../lib/timeSavings';

const app = new Hono();

async function reviewDocumentWithFallback(params: {
  text: string;
  systemPrompt: string;
  cfgCandidates: AiCallConfig[];
}) {
  let lastError: unknown;

  for (const cfg of params.cfgCandidates) {
    try {
      return await reviewOfficialDocumentText({
        text: params.text,
        systemPrompt: params.systemPrompt,
        cfg,
      });
    } catch (err) {
      lastError = err;
      console.warn('[documents/analyze] AI provider failed:', {
        kind: cfg.kind,
        baseUrl: cfg.baseUrl,
        model: cfg.model,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  throw new Error(toUserFacingAiError(lastError, params.cfgCandidates));
}

const createDocumentSchema = z.object({
  filename: z.string().min(1),
  fileType: z.string().min(1),
  fileSize: z.number().int().nonnegative(),
  storagePath: z.string().min(1),
  status: z.string().optional(),
  typoCount: z.number().int().nonnegative().optional(),
  ambiguousCount: z.number().int().nonnegative().optional(),
});

const updateDocumentSchema = z.object({
  filename: z.string().min(1).optional(),
  fileType: z.string().min(1).optional(),
  fileSize: z.number().int().nonnegative().optional(),
  storagePath: z.string().min(1).optional(),
  status: z.string().optional(),
  typoCount: z.number().int().nonnegative().optional(),
  ambiguousCount: z.number().int().nonnegative().optional(),
  findingsJson: z.unknown().nullable().optional(),
  analysisError: z.string().nullable().optional(),
});

app.get('/', async (c) => {
  const dbUser = await requireSecretary(c);
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  try {
    const rows = await db
      .select()
      .from(documents)
      .where(eq(documents.userId, dbUser.id))
      .orderBy(desc(documents.createdAt));

    return c.json({ data: rows });
  } catch (err) {
    return internalServerError(c, 'documents/list', err);
  }
});

app.post('/', async (c) => {
  const dbUser = await requireSecretary(c);
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  try {
    const body = await c.req.json();
    const parsed = createDocumentSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
    }

    const validatedPath = validateUserScopedStoragePath(dbUser.id, parsed.data.storagePath);
    if (!validatedPath.ok) {
      return c.json({ error: validatedPath.error }, 400);
    }

    const [created] = await db
      .insert(documents)
      .values({
        userId: dbUser.id,
        filename: parsed.data.filename,
        fileType: parsed.data.fileType,
        fileSize: parsed.data.fileSize,
        storagePath: validatedPath.normalizedPath,
        status: parsed.data.status ?? 'uploaded',
        typoCount: parsed.data.typoCount ?? 0,
        ambiguousCount: parsed.data.ambiguousCount ?? 0,
      })
      .returning();

    return c.json({ data: created }, 201);
  } catch (err) {
    return internalServerError(c, 'documents/create', err);
  }
});

app.get('/:id', async (c) => {
  const dbUser = await requireSecretary(c);
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  const id = c.req.param('id');
  const [row] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, id), eq(documents.userId, dbUser.id)));

  if (!row) return c.json({ error: 'Document not found' }, 404);
  return c.json({ data: row });
});

app.patch('/:id', async (c) => {
  const dbUser = await requireSecretary(c);
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  const id = c.req.param('id');
  const body = await c.req.json();
  const parsed = updateDocumentSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
  }

  let nextStoragePath = parsed.data.storagePath;
  if (nextStoragePath !== undefined) {
    const validatedPath = validateUserScopedStoragePath(dbUser.id, nextStoragePath);
    if (!validatedPath.ok) {
      return c.json({ error: validatedPath.error }, 400);
    }
    nextStoragePath = validatedPath.normalizedPath;
  }

  const [updated] = await db
    .update(documents)
    .set({ ...parsed.data, ...(nextStoragePath !== undefined ? { storagePath: nextStoragePath } : {}), updatedAt: new Date() })
    .where(and(eq(documents.id, id), eq(documents.userId, dbUser.id)))
    .returning();

  if (!updated) return c.json({ error: 'Document not found' }, 404);
  return c.json({ data: updated });
});

app.delete('/:id', async (c) => {
  const dbUser = await requireSecretary(c);
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  const id = c.req.param('id');

  const [existing] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, id), eq(documents.userId, dbUser.id)));
  if (!existing) return c.json({ error: 'Document not found' }, 404);

  const [deleted] = await db
    .delete(documents)
    .where(and(eq(documents.id, id), eq(documents.userId, dbUser.id)))
    .returning();

  if (existing.storagePath) {
    try {
      await removeObjects([existing.storagePath]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown storage delete error';
      return c.json({ data: deleted, storageWarning: message }, 200);
    }
  }

  return c.json({ data: deleted });
});

// Apply rate limiting to AI analysis endpoints
app.post('/:id/analyze', createRateLimitMiddleware(5, 60000), async (c) => {
  const dbUser = await requireSecretary(c);
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  const id = c.req.param('id');
  const startedAtMs = Date.now();

  try {
    const [doc] = await db
      .select()
      .from(documents)
      .where(and(eq(documents.id, id), eq(documents.userId, dbUser.id)))
      .limit(1);

    if (!doc) return c.json({ error: 'Document not found' }, { status: 404 });

    await db
      .update(documents)
      .set({
        status: 'processing',
        analysisError: null,
        updatedAt: new Date(),
      })
      .where(and(eq(documents.id, id), eq(documents.userId, dbUser.id)));

    const downloaded = await downloadObject(doc.storagePath);
    const bytes = downloaded.body;

    const text = await extractDocumentText({
      bytes,
      mimeType: doc.fileType,
      filename: doc.filename,
    });

    if (!text.trim()) {
      throw new Error('Dokumen tidak mengandung teks yang bisa diekstrak (mungkin scan PDF tanpa OCR).');
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
    const systemPrompt = await loadDocumentReviewSystemPrompt(dbUser.id);
    const review = await reviewDocumentWithFallback({ text, systemPrompt, cfgCandidates });

    const typoCount = review.findings.filter((f) => f.kind === 'typo').length;
    const ambiguousCount = review.findings.filter((f) => f.kind === 'ambiguous').length;

    const [updated] = await db
      .update(documents)
      .set({
        status: 'reviewed',
        typoCount,
        ambiguousCount,
        findingsJson: review,
        analysisError: null,
        analyzedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(documents.id, id), eq(documents.userId, dbUser.id)))
      .returning();

    await recordDocumentReviewSavings({
      userId: dbUser.id,
      documentId: id,
      typoCount,
      ambiguousCount,
      actualAutomationMinutes: automationMinutesFromStartedAt(startedAtMs),
      filename: doc.filename,
    });

    return c.json({ data: updated });
  } catch (err) {
    const message = toUserFacingAiError(err);

    await db
      .update(documents)
      .set({
        status: 'error',
        analysisError: message,
        updatedAt: new Date(),
      })
      .where(and(eq(documents.id, id), eq(documents.userId, dbUser.id)));

    console.error('[documents/analyze] Error:', err);
    return c.json({ error: message }, 500);
  }
});

export default app;
