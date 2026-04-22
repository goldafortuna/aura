import { z } from 'zod';
import { confidence01Optional } from './aiConfidenceSchema';
import type { AiCallConfig } from './aiClient';
import { callAiForJsonSchema } from './aiClient';
import { DEFAULT_MINUTES_REVIEW_SYSTEM_PROMPT } from './defaultAiPrompts';

const findingSchema = z.object({
  kind: z.enum(['typo', 'ambiguous']),
  severity: z.enum(['low', 'medium', 'high']).default('medium'),
  locationHint: z.string().min(1),
  originalText: z.string().min(1),
  suggestedText: z.string().min(1),
  explanation: z.string().min(1),
  confidence: confidence01Optional,
});

const ctaSchema = z.object({
  title: z.string().min(1),
  action: z.string().min(1),
  pic: z.string().nullable().default(null),
  unit: z.string().nullable().default(null),
  deadline: z.string().nullable().default(null),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  status: z.enum(['open', 'in_progress', 'done']).default('open'),
});

export const minutesReviewSchema = z.object({
  summary: z.string().min(1),
  /** Jumlah peserta yang hadir, diekstrak dari Daftar Hadir / Peserta di notula. 0 jika tidak ditemukan. */
  participantsCount: z.number().int().nonnegative().default(0),
  findings: z.array(findingSchema).default([]),
  ctas: z.array(ctaSchema).default([]),
});

export type MinutesReviewResult = z.infer<typeof minutesReviewSchema>;

function assertCfg(cfg: AiCallConfig) {
  if (!cfg.apiKey) throw new Error('API key AI belum diset (Pengaturan) atau env fallback belum lengkap.');
}

export async function reviewMeetingMinutesText(params: {
  text: string;
  systemPrompt: string;
  cfg: AiCallConfig;
  unitHints?: Array<{ name: string; aliases?: string[] }>;
}): Promise<MinutesReviewResult> {
  if (process.env.E2E_MOCK_AI === '1') {
    const hintedUnit = params.unitHints?.[params.unitHints.length - 1]?.name ?? null;
    return {
      summary: 'Mock review notula untuk pengujian end-to-end.',
      participantsCount: 4,
      findings: [
        {
          kind: 'typo',
          severity: 'low',
          locationHint: 'Paragraf pembuka',
          originalText: 'rapim',
          suggestedText: 'rapat pimpinan',
          explanation: 'Perlu diperjelas untuk dokumen resmi.',
          confidence: 0.96,
        },
      ],
      ctas: [
        {
          title: 'Finalisasi tindak lanjut rapat',
          action: 'Unit terkait menyusun tindak lanjut dan melaporkan progres pada pimpinan.',
          pic: 'Sekretariat',
          unit: hintedUnit,
          deadline: '2026-05-01',
          priority: 'high',
          status: 'open',
        },
      ],
    };
  }

  assertCfg(params.cfg);
  const unitInstructions =
    '\n\nInstruksi CTA tambahan:\n' +
    '- Untuk setiap CTA, isi field "unit" dengan nama unit kerja yang paling relevan jika disebut jelas.\n' +
    '- Jika referensi unit kerja resmi diberikan, gunakan nama atau alias dari referensi tersebut.\n' +
    '- Jika unit tidak jelas, isi null.';

  const unitHints =
    params.unitHints && params.unitHints.length > 0
      ? `\n\nReferensi unit kerja resmi yang boleh dipakai untuk field "unit":\n${params.unitHints
          .map((unit, index) => {
            const aliases = unit.aliases?.filter(Boolean) ?? [];
            const aliasText = aliases.length > 0 ? ` (alias: ${aliases.join(', ')})` : '';
            return `${index + 1}. ${unit.name}${aliasText}`;
          })
          .join('\n')}`
      : '';

  const user = `Notula rapat:\n${params.text}${unitInstructions}${unitHints}`;
  return callAiForJsonSchema({
    cfg: params.cfg,
    system: params.systemPrompt || DEFAULT_MINUTES_REVIEW_SYSTEM_PROMPT,
    user,
    schema: minutesReviewSchema,
  });
}

