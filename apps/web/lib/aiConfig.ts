import { db } from '../db';
import { aiPromptSettings, aiProviderConfigs } from '../db/schema';
import { eq, and, inArray, isNull } from 'drizzle-orm';
import { DEFAULT_DOCUMENT_REVIEW_SYSTEM_PROMPT, DEFAULT_MINUTES_REVIEW_SYSTEM_PROMPT } from './defaultAiPrompts';
import type { AiCallConfig } from './aiClient';
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

export async function loadActiveAiCallConfig(userId: string): Promise<AiCallConfig | undefined> {
  const [userClaude] = await db
    .select()
    .from(aiProviderConfigs)
    .where(
      and(
        eq(aiProviderConfigs.userId, userId),
        eq(aiProviderConfigs.provider, 'anthropic'),
        eq(aiProviderConfigs.isActive, true),
      ),
    )
    .limit(1);

  const [globalDefault] = userClaude
    ? []
    : await db
        .select()
        .from(aiProviderConfigs)
        .where(
          and(
            isNull(aiProviderConfigs.userId),
            inArray(aiProviderConfigs.provider, ['deepseek', 'openai']),
            eq(aiProviderConfigs.isActive, true),
          ),
        )
        .limit(1);

  const row = userClaude ?? globalDefault;
  if (!row) return undefined;

  const kind = row.kind === 'anthropic' ? 'anthropic' : 'openai_compatible';
  return {
    kind,
    apiKey: decrypt(row.apiKey),
    baseUrl: row.baseUrl,
    model: row.model,
  };
}
