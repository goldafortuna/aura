import { z } from 'zod';
import { confidence01Optional } from './aiConfidenceSchema';
import type { AiCallConfig } from './aiClient';
import { callAiForJsonSchema } from './aiClient';
import { DEFAULT_DOCUMENT_REVIEW_SYSTEM_PROMPT } from './defaultAiPrompts';

const findingSchema = z.object({
  kind: z.enum(['typo', 'ambiguous']),
  severity: z.enum(['low', 'medium', 'high']).default('medium'),
  locationHint: z.string().min(1),
  originalText: z.string().min(1),
  suggestedText: z.string().min(1),
  explanation: z.string().min(1),
  confidence: confidence01Optional,
});

export const documentReviewSchema = z.object({
  summary: z.string().min(1),
  findings: z.array(findingSchema).default([]),
});

export type DocumentReviewResult = z.infer<typeof documentReviewSchema>;

function defaultCfgFromEnv(): AiCallConfig {
  const provider = (process.env.AI_PROVIDER || 'openai_compatible').toLowerCase();
  if (provider === 'anthropic') {
    return {
      kind: 'anthropic',
      apiKey: process.env.ANTHROPIC_API_KEY || '',
      baseUrl: process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com',
      model: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022',
    };
  }

  return {
    kind: 'openai_compatible',
    apiKey: process.env.OPENAI_API_KEY || '',
    baseUrl: process.env.OPENAI_BASE_URL || 'https://api.deepseek.com/v1',
    model: process.env.OPENAI_MODEL || 'deepseek-chat',
  };
}

function assertCfg(cfg: AiCallConfig) {
  if (!cfg.apiKey) throw new Error('API key AI belum diset (Pengaturan) atau env fallback belum lengkap.');
}

export async function reviewOfficialDocumentText(params: {
  text: string;
  systemPrompt: string;
  cfg?: AiCallConfig;
}): Promise<DocumentReviewResult> {
  if (process.env.E2E_MOCK_AI === '1') {
    return {
      summary: 'Mock review Playwright: ditemukan 1 typo dan 1 kalimat ambigu untuk verifikasi alur Review Dokumen.',
      findings: [
        {
          kind: 'typo',
          severity: 'low',
          locationHint: 'Paragraf 1',
          originalText: 'Kemedikbudristek',
          suggestedText: 'Kemendikbudristek',
          explanation: 'Ejaan singkatan kementerian perlu diperbaiki agar konsisten.',
          confidence: 0.98,
        },
        {
          kind: 'ambiguous',
          severity: 'medium',
          locationHint: 'Paragraf 2',
          originalText: 'segera ditindaklanjuti',
          suggestedText: 'ditindaklanjuti paling lambat 30 April 2026 oleh unit terkait',
          explanation: 'Kalimat perlu batas waktu dan penanggung jawab yang lebih jelas.',
          confidence: 0.94,
        },
      ],
    };
  }

  const cfg = params.cfg ?? defaultCfgFromEnv();
  assertCfg(cfg);

  const user = `Dokumen:\n${params.text}`;
  return callAiForJsonSchema({
    cfg,
    system: params.systemPrompt || DEFAULT_DOCUMENT_REVIEW_SYSTEM_PROMPT,
    user,
    schema: documentReviewSchema,
  });
}

// Back-compat helper name (older codepaths)
export async function reviewOfficialDocumentTextLegacy(text: string): Promise<DocumentReviewResult> {
  return reviewOfficialDocumentText({ text, systemPrompt: DEFAULT_DOCUMENT_REVIEW_SYSTEM_PROMPT });
}
