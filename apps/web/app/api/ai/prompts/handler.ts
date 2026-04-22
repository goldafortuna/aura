import { Hono } from 'hono';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../../../../db';
import { aiPromptSettings } from '../../../../db/schema';
import { requireDbUser } from '../../../../lib/middleware/auth';
import { DEFAULT_DOCUMENT_REVIEW_SYSTEM_PROMPT, DEFAULT_MINUTES_REVIEW_SYSTEM_PROMPT } from '../../../../lib/defaultAiPrompts';

const app = new Hono();

const upsertAiPromptsSchema = z.object({
  documentReview: z.string().min(1),
  minutesReview: z.string().min(1),
});

app.get('/', async (c) => {
  const dbUser = await requireDbUser(c);
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  const rows = await db.select().from(aiPromptSettings).where(eq(aiPromptSettings.userId, dbUser.id));
  const byKind = new Map(rows.map((r) => [r.kind, r.systemPrompt]));

  return c.json({
    data: {
      documentReview: byKind.get('document_review') ?? DEFAULT_DOCUMENT_REVIEW_SYSTEM_PROMPT,
      minutesReview: byKind.get('minutes_review') ?? DEFAULT_MINUTES_REVIEW_SYSTEM_PROMPT,
    },
  });
});

app.put('/', async (c) => {
  const dbUser = await requireDbUser(c);
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  const body = await c.req.json();
  const parsed = upsertAiPromptsSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);

  const now = new Date();

  await db
    .insert(aiPromptSettings)
    .values({
      userId: dbUser.id,
      kind: 'document_review',
      systemPrompt: parsed.data.documentReview,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [aiPromptSettings.userId, aiPromptSettings.kind],
      set: { systemPrompt: parsed.data.documentReview, updatedAt: now },
    });

  await db
    .insert(aiPromptSettings)
    .values({
      userId: dbUser.id,
      kind: 'minutes_review',
      systemPrompt: parsed.data.minutesReview,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [aiPromptSettings.userId, aiPromptSettings.kind],
      set: { systemPrompt: parsed.data.minutesReview, updatedAt: now },
    });

  return c.json({ ok: true });
});

export default app;
