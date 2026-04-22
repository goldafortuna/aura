import { and, eq } from 'drizzle-orm';
import { db } from '../../../../db';
import { aiProviderConfigs, aiPromptSettings } from '../../../../db/schema';
import { decrypt } from '../../../../lib/encryption';
import {
  DEFAULT_DOCUMENT_REVIEW_SYSTEM_PROMPT,
  DEFAULT_MINUTES_REVIEW_SYSTEM_PROMPT,
} from '../../../../lib/defaultAiPrompts';
import type { AiCallConfig } from '../../../../lib/aiClient';
export { parseAiJsonRelaxed } from '../../../../lib/utils/json';

export function parseIsoDateOrNull(input: string | null | undefined) {
  const v = (input ?? '').trim();
  if (!v) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}

export function maskApiKey(key: string) {
  const trimmed = key.trim();
  if (!trimmed) return '';
  if (trimmed.length <= 8) return '••••••••';
  return `${trimmed.slice(0, 4)}…${trimmed.slice(-4)}`;
}

export function isMaskedApiKeyInput(input: string) {
  return input.includes('…') || input.includes('•');
}

export async function loadDocumentReviewSystemPrompt(userId: string) {
  const [row] = await db
    .select()
    .from(aiPromptSettings)
    .where(and(eq(aiPromptSettings.userId, userId), eq(aiPromptSettings.kind, 'document_review')))
    .limit(1);
  return row?.systemPrompt?.trim() ? row.systemPrompt : DEFAULT_DOCUMENT_REVIEW_SYSTEM_PROMPT;
}

export async function loadMinutesReviewSystemPrompt(userId: string) {
  const [row] = await db
    .select()
    .from(aiPromptSettings)
    .where(and(eq(aiPromptSettings.userId, userId), eq(aiPromptSettings.kind, 'minutes_review')))
    .limit(1);
  return row?.systemPrompt?.trim() ? row.systemPrompt : DEFAULT_MINUTES_REVIEW_SYSTEM_PROMPT;
}

export async function loadActiveAiCallConfig(userId: string): Promise<AiCallConfig | undefined> {
  const [row] = await db
    .select()
    .from(aiProviderConfigs)
    .where(and(eq(aiProviderConfigs.userId, userId), eq(aiProviderConfigs.isActive, true)))
    .limit(1);

  if (!row) return undefined;

  const kind = row.kind === 'anthropic' ? 'anthropic' : 'openai_compatible';
  return {
    kind,
    apiKey: decrypt(row.apiKey),
    baseUrl: row.baseUrl,
    model: row.model,
  };
}
