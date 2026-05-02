import { Hono } from 'hono';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../../../db';
import { aiMessageBatches, aiProviderConfigs, aiPromptSettings, documents } from '../../../../db/schema';
import { encrypt, decrypt } from '../../../../lib/encryption';
import {
  DEFAULT_DOCUMENT_REVIEW_SYSTEM_PROMPT,
  DEFAULT_MINUTES_REVIEW_SYSTEM_PROMPT,
} from '../../../../lib/defaultAiPrompts';
import {
  anthropicDownloadBatchResults,
  anthropicRetrieveMessageBatch,
} from '../../../../lib/anthropicBatches';
import { isSecretary, isSuperAdmin, requireApprovedUser, requireSuperAdmin } from '../_lib/auth';
import { maskApiKey, isMaskedApiKeyInput, loadActiveAiCallConfig, parseAiJsonRelaxed } from '../_lib/helpers';

const upsertAiProviderSchema = z.object({
  displayName: z.string().min(1),
  kind: z.enum(['openai_compatible', 'anthropic']),
  apiKey: z.string().optional().default(''),
  baseUrl: z.string().optional().nullable(),
  model: z.string().min(1),
});

const upsertAiPromptsSchema = z.object({
  documentReview: z.string().min(1),
  minutesReview: z.string().min(1),
});

const router = new Hono();

const GLOBAL_PROVIDERS = ['deepseek', 'openai'] as const;
const USER_PROVIDERS = ['anthropic'] as const;

function isGlobalProvider(provider: string): provider is (typeof GLOBAL_PROVIDERS)[number] {
  return GLOBAL_PROVIDERS.includes(provider as (typeof GLOBAL_PROVIDERS)[number]);
}

function isUserProvider(provider: string): provider is (typeof USER_PROVIDERS)[number] {
  return USER_PROVIDERS.includes(provider as (typeof USER_PROVIDERS)[number]);
}

router.get('/providers', async (c) => {
  const dbUser = await requireApprovedUser();
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  const [globalRows, userRows] = await Promise.all([
    db.select().from(aiProviderConfigs).where(and(isNull(aiProviderConfigs.userId), inArray(aiProviderConfigs.provider, [...GLOBAL_PROVIDERS]))),
    db.select().from(aiProviderConfigs).where(and(eq(aiProviderConfigs.userId, dbUser.id), inArray(aiProviderConfigs.provider, [...USER_PROVIDERS]))),
  ]);
  const byProvider = new Map([...globalRows, ...userRows].map((r) => [r.provider, r]));
  const canManageSystem = isSuperAdmin(dbUser);
  const canManagePersonal = isSecretary(dbUser);

  const templates = [
    { provider: 'deepseek', displayName: 'DeepSeek', kind: 'openai_compatible' as const, defaultBaseUrl: 'https://api.deepseek.com/v1', defaultModel: 'deepseek-chat', scope: 'global' as const, canEdit: canManageSystem },
    { provider: 'openai', displayName: 'OpenAI (GPT)', kind: 'openai_compatible' as const, defaultBaseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4o-mini', scope: 'global' as const, canEdit: canManageSystem },
    { provider: 'anthropic', displayName: 'Anthropic (Claude)', kind: 'anthropic' as const, defaultBaseUrl: 'https://api.anthropic.com', defaultModel: 'claude-3-5-sonnet-20241022', scope: 'user' as const, canEdit: canManagePersonal },
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
      scope: t.scope,
      canEdit: t.canEdit,
    };
  });

  return c.json({ data });
});

router.put('/providers/:provider', async (c) => {
  const dbUser = await requireApprovedUser();
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
  if (isGlobal && parsed.data.kind !== 'openai_compatible') return c.json({ error: 'DeepSeek/GPT harus memakai transport OpenAI-compatible.' }, 400);
  if (isPersonal && parsed.data.kind !== 'anthropic') return c.json({ error: 'Provider personal Secretary saat ini hanya Claude/Anthropic.' }, 400);

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

  const [saved] = existing
    ? await db.update(aiProviderConfigs)
      .set({ kind: parsed.data.kind, displayName: parsed.data.displayName, apiKey: nextKey, baseUrl: parsed.data.baseUrl ?? null, model: parsed.data.model, updatedAt: new Date() })
      .where(eq(aiProviderConfigs.id, existing.id))
      .returning()
    : await db.insert(aiProviderConfigs)
      .values({ userId: ownerValue, provider, kind: parsed.data.kind, displayName: parsed.data.displayName, apiKey: nextKey, baseUrl: parsed.data.baseUrl ?? null, model: parsed.data.model, isActive: false, updatedAt: new Date() })
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

router.post('/providers/:provider/activate', async (c) => {
  const dbUser = await requireApprovedUser();
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  const provider = c.req.param('provider');
  const isGlobal = isGlobalProvider(provider);
  const isPersonal = isUserProvider(provider);
  if (!isGlobal && !isPersonal) return c.json({ error: 'Provider tidak dikenal.' }, 400);
  if (isGlobal && !isSuperAdmin(dbUser)) return c.json({ error: 'Hanya Super Admin yang dapat mengaktifkan provider default sistem.' }, 403);
  if (isPersonal && !isSecretary(dbUser) && !isSuperAdmin(dbUser)) return c.json({ error: 'Hanya Secretary yang dapat mengaktifkan provider personal.' }, 403);
  const ownerWhere = isGlobal ? isNull(aiProviderConfigs.userId) : eq(aiProviderConfigs.userId, dbUser.id);

  const [target] = await db
    .select()
    .from(aiProviderConfigs)
    .where(and(ownerWhere, eq(aiProviderConfigs.provider, provider)))
    .limit(1);

  if (!target?.apiKey) return c.json({ error: 'Provider belum disimpan / API key belum diisi.' }, 400);

  // Deactivate all providers across both scopes so only one is ever active at a time.
  await Promise.all([
    db.update(aiProviderConfigs).set({ isActive: false, updatedAt: new Date() }).where(
      and(isNull(aiProviderConfigs.userId), inArray(aiProviderConfigs.provider, [...GLOBAL_PROVIDERS])),
    ),
    db.update(aiProviderConfigs).set({ isActive: false, updatedAt: new Date() }).where(
      and(eq(aiProviderConfigs.userId, dbUser.id), inArray(aiProviderConfigs.provider, [...USER_PROVIDERS])),
    ),
  ]);

  const [activated] = await db
    .update(aiProviderConfigs)
    .set({ isActive: true, updatedAt: new Date() })
    .where(and(ownerWhere, eq(aiProviderConfigs.provider, provider)))
    .returning();

  return c.json({ data: { provider: activated.provider, isActive: activated.isActive } });
});

router.get('/prompts', async (c) => {
  const dbUser = await requireApprovedUser();
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

router.put('/prompts', async (c) => {
  const dbUser = await requireSuperAdmin();
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  const body = await c.req.json();
  const parsed = upsertAiPromptsSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);

  const now = new Date();
  const upsertGlobalPrompt = async (kind: 'document_review' | 'minutes_review', systemPrompt: string) => {
    const [existing] = await db.select().from(aiPromptSettings).where(and(isNull(aiPromptSettings.userId), eq(aiPromptSettings.kind, kind))).limit(1);
    if (existing) {
      await db.update(aiPromptSettings).set({ systemPrompt, updatedAt: now }).where(eq(aiPromptSettings.id, existing.id));
      return;
    }
    await db.insert(aiPromptSettings).values({ userId: null, kind, systemPrompt, updatedAt: now });
  };

  await upsertGlobalPrompt('document_review', parsed.data.documentReview);
  await upsertGlobalPrompt('minutes_review', parsed.data.minutesReview);

  return c.json({ ok: true });
});

router.get('/batches/:id', async (c) => {
  const dbUser = await requireApprovedUser();
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  const id = c.req.param('id');
  const [row] = await db
    .select()
    .from(aiMessageBatches)
    .where(and(eq(aiMessageBatches.id, id), eq(aiMessageBatches.userId, dbUser.id)))
    .limit(1);
  if (!row) return c.json({ error: 'Batch not found' }, 404);

  const cfg = await loadActiveAiCallConfig(dbUser.id);
  if (!cfg || cfg.kind !== 'anthropic') return c.json({ error: 'Anthropic provider aktif diperlukan.' }, 400);

  const batch = await anthropicRetrieveMessageBatch({ cfg, batchId: id });
  const counts = batch.request_counts ?? {};

  const [updated] = await db
    .update(aiMessageBatches)
    .set({
      processingStatus: batch.processing_status,
      succeededCount: counts.succeeded ?? 0,
      erroredCount: counts.errored ?? 0,
      canceledCount: counts.canceled ?? 0,
      expiredCount: counts.expired ?? 0,
      resultsUrl: batch.results_url ?? null,
      endedAt: batch.ended_at ? new Date(batch.ended_at) : null,
    })
    .where(and(eq(aiMessageBatches.id, id), eq(aiMessageBatches.userId, dbUser.id)))
    .returning();

  return c.json({ data: updated });
});

router.post('/batches/:id/sync', async (c) => {
  const dbUser = await requireApprovedUser();
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  const id = c.req.param('id');
  const [row] = await db
    .select()
    .from(aiMessageBatches)
    .where(and(eq(aiMessageBatches.id, id), eq(aiMessageBatches.userId, dbUser.id)))
    .limit(1);
  if (!row) return c.json({ error: 'Batch not found' }, 404);

  const cfg = await loadActiveAiCallConfig(dbUser.id);
  if (!cfg || cfg.kind !== 'anthropic') return c.json({ error: 'Anthropic provider aktif diperlukan.' }, 400);

  const batch = await anthropicRetrieveMessageBatch({ cfg, batchId: id });
  if (batch.processing_status !== 'ended') return c.json({ error: 'Batch belum selesai.' }, 400);

  const resultsUrl = batch.results_url ?? row.resultsUrl;
  if (!resultsUrl) return c.json({ error: 'Batch results_url belum tersedia.' }, 400);

  const results = await anthropicDownloadBatchResults({ cfg, resultsUrl });

  for (const line of results) {
    const docId = line.custom_id;
    if (!docId) continue;

    if (line.result.type !== 'succeeded') {
      await db.update(documents)
        .set({ status: 'error', analysisError: `Batch result: ${line.result.type}`, updatedAt: new Date() })
        .where(and(eq(documents.id, docId), eq(documents.userId, dbUser.id)));
      continue;
    }

    const blocks = line.result.message?.content ?? [];
    const textBlock = blocks.find((b) => String(b.type) === 'text');
    const content = String(textBlock?.text ?? '');
    if (!content.trim()) {
      await db.update(documents)
        .set({ status: 'error', analysisError: 'Batch result kosong.', updatedAt: new Date() })
        .where(and(eq(documents.id, docId), eq(documents.userId, dbUser.id)));
      continue;
    }

    const parsedJson = parseAiJsonRelaxed(content);
    const review = typeof parsedJson === 'object' && parsedJson ? (parsedJson as { findings?: unknown; summary?: unknown }) : {};
    const findings = Array.isArray(review.findings) ? (review.findings as any[]) : [];
    const typoCount = findings.filter((f) => f && typeof f === 'object' && (f as any).kind === 'typo').length;
    const ambiguousCount = findings.filter((f) => f && typeof f === 'object' && (f as any).kind === 'ambiguous').length;

    await db.update(documents).set({
      status: 'reviewed',
      typoCount,
      ambiguousCount,
      findingsJson: { summary: typeof review.summary === 'string' ? review.summary : 'Review selesai.', findings },
      analysisError: null,
      analyzedAt: new Date(),
      updatedAt: new Date(),
    }).where(and(eq(documents.id, docId), eq(documents.userId, dbUser.id)));
  }

  const counts = batch.request_counts ?? {};
  const [saved] = await db
    .update(aiMessageBatches)
    .set({
      processingStatus: batch.processing_status,
      succeededCount: counts.succeeded ?? row.succeededCount,
      erroredCount: counts.errored ?? row.erroredCount,
      canceledCount: counts.canceled ?? row.canceledCount,
      expiredCount: counts.expired ?? row.expiredCount,
      resultsUrl,
      endedAt: batch.ended_at ? new Date(batch.ended_at) : row.endedAt,
      syncedAt: new Date(),
    })
    .where(and(eq(aiMessageBatches.id, id), eq(aiMessageBatches.userId, dbUser.id)))
    .returning();

  return c.json({ data: saved });
});

export default router;
