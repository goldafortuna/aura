import { db } from '../db';
import { aiPromptSettings, aiProviderConfigs } from '../db/schema';
import { eq, and, inArray, isNull } from 'drizzle-orm';
import { DEFAULT_DOCUMENT_REVIEW_SYSTEM_PROMPT, DEFAULT_MINUTES_REVIEW_SYSTEM_PROMPT } from './defaultAiPrompts';
import type { AiCallConfig } from './aiClient';
import { resolveAnthropicModelId } from './anthropicModelId';
import { decrypt } from './encryption';

export async function loadDocumentReviewSystemPrompt(_userId: string) {
  const [row] = await db
    .select()
    .from(aiPromptSettings)
    .where(and(isNull(aiPromptSettings.userId), eq(aiPromptSettings.kind, 'document_review')))
    .limit(1);
  return row?.systemPrompt?.trim() ? row.systemPrompt : DEFAULT_DOCUMENT_REVIEW_SYSTEM_PROMPT;
}

export async function loadMinutesReviewSystemPrompt(_userId: string) {
  const [row] = await db
    .select()
    .from(aiPromptSettings)
    .where(and(isNull(aiPromptSettings.userId), eq(aiPromptSettings.kind, 'minutes_review')))
    .limit(1);
  return row?.systemPrompt?.trim() ? row.systemPrompt : DEFAULT_MINUTES_REVIEW_SYSTEM_PROMPT;
}

function toAiCallConfig(row: {
  kind: string;
  apiKey: string;
  baseUrl: string | null;
  model: string;
}): AiCallConfig {
  const kind = row.kind === 'anthropic' ? 'anthropic' : 'openai_compatible';
  return {
    kind,
    apiKey: decrypt(row.apiKey),
    baseUrl: row.baseUrl,
    model: kind === 'anthropic' ? resolveAnthropicModelId(row.model) : row.model,
  };
}

export async function loadAiCallConfigCandidates(userId: string): Promise<AiCallConfig[]> {
  const rows = await loadAiCallConfigCandidateRows(userId);
  return rows.map((r) => r.cfg);
}

/** Kandidat AI beserta label provider/model untuk disimpan ke dokumen setelah review. */
export type AiCallCandidateWithMeta = {
  cfg: AiCallConfig;
  provider: string;
  model: string;
};

async function loadAiCallConfigCandidateRows(userId: string): Promise<AiCallCandidateWithMeta[]> {
  const [personalRows, globalRows] = await Promise.all([
    db
      .select()
      .from(aiProviderConfigs)
      .where(
        and(
          eq(aiProviderConfigs.userId, userId),
          eq(aiProviderConfigs.provider, 'anthropic'),
          eq(aiProviderConfigs.isActive, true),
        ),
      )
      .limit(1),
    db
      .select()
      .from(aiProviderConfigs)
      .where(
        and(
          isNull(aiProviderConfigs.userId),
          inArray(aiProviderConfigs.provider, ['deepseek', 'openai']),
          eq(aiProviderConfigs.isActive, true),
        ),
      ),
  ]);

  return [...personalRows, ...globalRows].map((row) => {
    const cfg = toAiCallConfig(row);
    return {
      cfg,
      provider: row.provider,
      model: cfg.kind === 'anthropic' ? resolveAnthropicModelId(row.model) : row.model,
    };
  });
}

export async function loadAiCallConfigCandidatesWithMeta(userId: string): Promise<AiCallCandidateWithMeta[]> {
  return loadAiCallConfigCandidateRows(userId);
}

export async function loadActiveAiCallConfig(userId: string): Promise<AiCallConfig | undefined> {
  const [primary] = await loadAiCallConfigCandidates(userId);
  return primary;
}
