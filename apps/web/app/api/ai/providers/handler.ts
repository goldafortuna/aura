import { Hono } from 'hono';
import { z } from 'zod';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '../../../../db';
import { aiProviderConfigs } from '../../../../db/schema';
import { isSecretary, isSuperAdmin, requireApprovedUser } from '../../../../lib/middleware/auth';
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

const GLOBAL_PROVIDERS = ['deepseek', 'openai'] as const;
const USER_PROVIDERS = ['anthropic'] as const;

function isGlobalProvider(provider: string): provider is (typeof GLOBAL_PROVIDERS)[number] {
  return GLOBAL_PROVIDERS.includes(provider as (typeof GLOBAL_PROVIDERS)[number]);
}

function isUserProvider(provider: string): provider is (typeof USER_PROVIDERS)[number] {
  return USER_PROVIDERS.includes(provider as (typeof USER_PROVIDERS)[number]);
}

function serializeProvider(row: typeof aiProviderConfigs.$inferSelect | undefined, template: {
  provider: string;
  displayName: string;
  kind: 'openai_compatible' | 'anthropic';
  defaultBaseUrl: string;
  defaultModel: string;
  scope: 'global' | 'user';
  canEdit: boolean;
}) {
  return {
    provider: template.provider,
    displayName: row?.displayName ?? template.displayName,
    kind: row?.kind ?? template.kind,
    baseUrl: row?.baseUrl ?? template.defaultBaseUrl,
    model: row?.model ?? template.defaultModel,
    isActive: row?.isActive ?? false,
    hasApiKey: Boolean(row?.apiKey),
    apiKeyPreview: row?.apiKey ? maskApiKey(decrypt(row.apiKey)) : '',
    scope: template.scope,
    canEdit: template.canEdit,
  };
}

app.get('/', async (c) => {
  const dbUser = await requireApprovedUser(c);
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  const [globalRows, userRows] = await Promise.all([
    db
      .select()
      .from(aiProviderConfigs)
      .where(and(isNull(aiProviderConfigs.userId), inArray(aiProviderConfigs.provider, [...GLOBAL_PROVIDERS]))),
    db
      .select()
      .from(aiProviderConfigs)
      .where(and(eq(aiProviderConfigs.userId, dbUser.id), inArray(aiProviderConfigs.provider, [...USER_PROVIDERS]))),
  ]);
  const byProvider = new Map([...globalRows, ...userRows].map((r) => [r.provider, r]));
  const canManageSystem = isSuperAdmin(dbUser);
  const canManagePersonal = isSecretary(dbUser);

  const templates = [
    {
      provider: 'deepseek',
      displayName: 'DeepSeek',
      kind: 'openai_compatible' as const,
      defaultBaseUrl: 'https://api.deepseek.com/v1',
      defaultModel: 'deepseek-chat',
      scope: 'global' as const,
      canEdit: canManageSystem,
    },
    {
      provider: 'openai',
      displayName: 'OpenAI (GPT)',
      kind: 'openai_compatible' as const,
      defaultBaseUrl: 'https://api.openai.com/v1',
      defaultModel: 'gpt-4o-mini',
      scope: 'global' as const,
      canEdit: canManageSystem,
    },
    {
      provider: 'anthropic',
      displayName: 'Anthropic (Claude)',
      kind: 'anthropic' as const,
      defaultBaseUrl: 'https://api.anthropic.com',
      defaultModel: 'claude-sonnet-4-6',
      scope: 'user' as const,
      canEdit: canManagePersonal,
    },
  ];

  const data = templates.map((t) => serializeProvider(byProvider.get(t.provider), t));

  return c.json({ data });
});

app.put('/:provider', async (c) => {
  const dbUser = await requireApprovedUser(c);
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  const provider = c.req.param('provider');
  const isGlobal = isGlobalProvider(provider);
  const isPersonal = isUserProvider(provider);
  if (!isGlobal && !isPersonal) return c.json({ error: 'Provider tidak dikenal.' }, 400);
  if (isGlobal && !isSuperAdmin(dbUser)) return c.json({ error: 'Hanya Super Admin yang dapat mengatur provider default sistem.' }, 403);
  if (isPersonal && !isSecretary(dbUser)) return c.json({ error: 'Hanya Secretary yang dapat mengatur provider personal.' }, 403);

  const body = await c.req.json();
  const parsed = upsertAiProviderSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
  if (isGlobal && parsed.data.kind !== 'openai_compatible') {
    return c.json({ error: 'DeepSeek/GPT harus memakai transport OpenAI-compatible.' }, 400);
  }
  if (isPersonal && parsed.data.kind !== 'anthropic') {
    return c.json({ error: 'Provider personal Secretary saat ini hanya Claude/Anthropic.' }, 400);
  }

  const ownerWhere = isGlobal ? isNull(aiProviderConfigs.userId) : eq(aiProviderConfigs.userId, dbUser.id);
  const ownerValue = isGlobal ? null : dbUser.id;

  const [existing] = await db
    .select()
    .from(aiProviderConfigs)
    .where(and(ownerWhere, eq(aiProviderConfigs.provider, provider)))
    .limit(1);

  const incomingKey = parsed.data.apiKey?.trim() ?? '';
  const shouldKeepKey = !incomingKey || isMaskedApiKeyInput(incomingKey);
  if (shouldKeepKey && !existing?.apiKey) {
    return c.json({ error: 'API key wajib diisi untuk pertama kali menyimpan provider ini.' }, 400);
  }

  const nextKey = shouldKeepKey ? existing!.apiKey : encrypt(incomingKey);

  const values = {
    userId: ownerValue,
    provider,
    kind: parsed.data.kind,
    displayName: parsed.data.displayName,
    apiKey: nextKey,
    baseUrl: parsed.data.baseUrl ?? null,
    model: parsed.data.model,
    isActive: existing?.isActive ?? false,
    updatedAt: new Date(),
  };

  const [saved] = existing
    ? await db
      .update(aiProviderConfigs)
      .set({
        kind: parsed.data.kind,
        displayName: parsed.data.displayName,
        apiKey: nextKey,
        baseUrl: parsed.data.baseUrl ?? null,
        model: parsed.data.model,
        updatedAt: new Date(),
      })
      .where(eq(aiProviderConfigs.id, existing.id))
      .returning()
    : await db
      .insert(aiProviderConfigs)
      .values(values)
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
      scope: isGlobal ? 'global' : 'user',
      canEdit: true,
    },
  });
});

app.post('/:provider/activate', async (c) => {
  const dbUser = await requireApprovedUser(c);
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  const provider = c.req.param('provider');
  const isGlobal = isGlobalProvider(provider);
  const isPersonal = isUserProvider(provider);
  if (!isGlobal && !isPersonal) return c.json({ error: 'Provider tidak dikenal.' }, 400);
  if (isGlobal && !isSuperAdmin(dbUser)) return c.json({ error: 'Hanya Super Admin yang dapat mengaktifkan provider default sistem.' }, 403);
  if (isPersonal && !isSecretary(dbUser) && !isSuperAdmin(dbUser)) {
    return c.json({ error: 'Hanya Secretary yang dapat mengaktifkan provider personal.' }, 403);
  }

  const ownerWhere = isGlobal ? isNull(aiProviderConfigs.userId) : eq(aiProviderConfigs.userId, dbUser.id);

  const [target] = await db
    .select()
    .from(aiProviderConfigs)
    .where(and(ownerWhere, eq(aiProviderConfigs.provider, provider)))
    .limit(1);

  if (!target?.apiKey) {
    return c.json({ error: 'Provider belum disimpan / API key belum diisi.' }, 400);
  }

  // Nonaktifkan semua provider (global + personal user) agar hanya satu yang aktif — sama seperti routes/ai.ts.
  await Promise.all([
    db
      .update(aiProviderConfigs)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(isNull(aiProviderConfigs.userId), inArray(aiProviderConfigs.provider, [...GLOBAL_PROVIDERS]))),
    db
      .update(aiProviderConfigs)
      .set({ isActive: false, updatedAt: new Date() })
      .where(
        and(eq(aiProviderConfigs.userId, dbUser.id), inArray(aiProviderConfigs.provider, [...USER_PROVIDERS])),
      ),
  ]);

  const [activated] = await db
    .update(aiProviderConfigs)
    .set({ isActive: true, updatedAt: new Date() })
    .where(and(ownerWhere, eq(aiProviderConfigs.provider, provider)))
    .returning();

  return c.json({
    data: {
      provider: activated.provider,
      isActive: activated.isActive,
    },
  });
});

export default app;
