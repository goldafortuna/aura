import { Hono } from 'hono';
import { z } from 'zod';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../../../../db';
import { aiPromptSettings } from '../../../../db/schema';
import { requireApprovedUser, requireSuperAdmin } from '../../../../lib/middleware/auth';
import { DEFAULT_DOCUMENT_REVIEW_SYSTEM_PROMPT, DEFAULT_MINUTES_REVIEW_SYSTEM_PROMPT } from '../../../../lib/defaultAiPrompts';

const app = new Hono();

const upsertAiPromptsSchema = z.object({
  documentReview: z.string().min(1),
  minutesReview: z.string().min(1),
});

app.get('/', async (c) => {
  const dbUser = await requireApprovedUser(c);
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  const rows = await db.select().from(aiPromptSettings).where(isNull(aiPromptSettings.userId));
  const byKind = new Map(rows.map((r) => [r.kind, r.systemPrompt]));

  return c.json({
    data: {
      documentReview: byKind.get('document_review') ?? DEFAULT_DOCUMENT_REVIEW_SYSTEM_PROMPT,
      minutesReview: byKind.get('minutes_review') ?? DEFAULT_MINUTES_REVIEW_SYSTEM_PROMPT,
    },
  });
});

app.put('/', async (c) => {
  const dbUser = await requireSuperAdmin(c);
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  const body = await c.req.json();
  const parsed = upsertAiPromptsSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);

  const now = new Date();

  const upsertGlobalPrompt = async (kind: 'document_review' | 'minutes_review', systemPrompt: string) => {
    const [existing] = await db
      .select()
      .from(aiPromptSettings)
      .where(and(isNull(aiPromptSettings.userId), eq(aiPromptSettings.kind, kind)))
      .limit(1);

    if (existing) {
      await db
        .update(aiPromptSettings)
        .set({ systemPrompt, updatedAt: now })
        .where(eq(aiPromptSettings.id, existing.id));
      return;
    }

    await db.insert(aiPromptSettings).values({
      userId: null,
      kind,
      systemPrompt,
      updatedAt: now,
    });
  };

  await upsertGlobalPrompt('document_review', parsed.data.documentReview);
  await upsertGlobalPrompt('minutes_review', parsed.data.minutesReview);

  return c.json({ ok: true });
});

export default app;
