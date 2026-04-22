import { Hono } from 'hono';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { db } from '../../../../db';
import { aiProviderConfigs } from '../../../../db/schema';
import { requireDbUser } from '../../../../lib/middleware/auth';
import { maskApiKey, isMaskedApiKeyInput } from '../../../../lib/utils/security';
import { decrypt, encrypt } from '../../../../lib/encryption';

const app = new Hono();

const upsertAiProviderSchema = z.object({
  displayName: z.string().min(1),
  kind: z.enum(['openai_compatible', 'anthropic']),
  apiKey: z.string().optional().default(''),
  baseUrl: z.string().optional().nullable(),
  model: z.string().min(1),
});

app.get('/', async (c) => {
  const dbUser = await requireDbUser(c);
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  const rows = await db.select().from(aiProviderConfigs).where(eq(aiProviderConfigs.userId, dbUser.id));
  const byProvider = new Map(rows.map((r) => [r.provider, r]));

  const templates = [
    {
      provider: 'deepseek',
      displayName: 'DeepSeek',
      kind: 'openai_compatible' as const,
      defaultBaseUrl: 'https://api.deepseek.com/v1',
      defaultModel: 'deepseek-chat',
    },
    {
      provider: 'openai',
      displayName: 'OpenAI (GPT)',
      kind: 'openai_compatible' as const,
      defaultBaseUrl: 'https://api.openai.com/v1',
      defaultModel: 'gpt-4o-mini',
    },
    {
      provider: 'anthropic',
      displayName: 'Anthropic (Claude)',
      kind: 'anthropic' as const,
      defaultBaseUrl: 'https://api.anthropic.com',
      defaultModel: 'claude-3-5-sonnet-20241022',
    },
  ];

  const data = templates.map((t) => {
    const row = byProvider.get(t.provider);
    return {
      provider: t.provider,
      displayName: row?.displayName ?? t.displayName,
      kind: row?.kind ?? t.kind,
      baseUrl: row?.baseUrl ?? t.defaultBaseUrl,
      model: row?.model ?? t.defaultModel,
      isActive: row?.isActive ?? false,
      hasApiKey: Boolean(row?.apiKey),
      apiKeyPreview: row?.apiKey ? maskApiKey(decrypt(row.apiKey)) : '',
    };
  });

  return c.json({ data });
});

app.put('/:provider', async (c) => {
  const dbUser = await requireDbUser(c);
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  const provider = c.req.param('provider');
  const body = await c.req.json();
  const parsed = upsertAiProviderSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);

  const [existing] = await db
    .select()
    .from(aiProviderConfigs)
    .where(and(eq(aiProviderConfigs.userId, dbUser.id), eq(aiProviderConfigs.provider, provider)))
    .limit(1);

  const incomingKey = parsed.data.apiKey?.trim() ?? '';
  const shouldKeepKey = !incomingKey || isMaskedApiKeyInput(incomingKey);
  if (shouldKeepKey && !existing?.apiKey) {
    return c.json({ error: 'API key wajib diisi untuk pertama kali menyimpan provider ini.' }, 400);
  }

  const nextKey = shouldKeepKey ? existing!.apiKey : encrypt(incomingKey);

  const [saved] = await db
    .insert(aiProviderConfigs)
    .values({
      userId: dbUser.id,
      provider,
      kind: parsed.data.kind,
      displayName: parsed.data.displayName,
      apiKey: nextKey,
      baseUrl: parsed.data.baseUrl ?? null,
      model: parsed.data.model,
      isActive: existing?.isActive ?? false,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [aiProviderConfigs.userId, aiProviderConfigs.provider],
      set: {
        kind: parsed.data.kind,
        displayName: parsed.data.displayName,
        apiKey: nextKey,
        baseUrl: parsed.data.baseUrl ?? null,
        model: parsed.data.model,
        updatedAt: new Date(),
      },
    })
    .returning();

  return c.json({
    data: {
      provider: saved.provider,
      displayName: saved.displayName,
      kind: saved.kind,
      baseUrl: saved.baseUrl,
      model: saved.model,
      isActive: saved.isActive,
      hasApiKey: Boolean(saved.apiKey),
      apiKeyPreview: saved.apiKey ? maskApiKey(decrypt(saved.apiKey)) : '',
    },
  });
});

app.post('/:provider/activate', async (c) => {
  const dbUser = await requireDbUser(c);
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  const provider = c.req.param('provider');

  const [target] = await db
    .select()
    .from(aiProviderConfigs)
    .where(and(eq(aiProviderConfigs.userId, dbUser.id), eq(aiProviderConfigs.provider, provider)))
    .limit(1);

  if (!target?.apiKey) {
    return c.json({ error: 'Provider belum disimpan / API key belum diisi.' }, 400);
  }

  await db
    .update(aiProviderConfigs)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(aiProviderConfigs.userId, dbUser.id));

  const [activated] = await db
    .update(aiProviderConfigs)
    .set({ isActive: true, updatedAt: new Date() })
    .where(and(eq(aiProviderConfigs.userId, dbUser.id), eq(aiProviderConfigs.provider, provider)))
    .returning();

  return c.json({
    data: {
      provider: activated.provider,
      isActive: activated.isActive,
    },
  });
});

export default app;
