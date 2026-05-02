/**
 * Opsi model untuk dropdown Pengaturan — ID mengikuti dokumentasi API masing-masing provider
 * (menghindari salah ketik). Daftar diseleksi untuk kasus umum Secretary SaaS; boleh ditambah seiring rilis API.
 */

import { DEFAULT_ANTHROPIC_MESSAGES_MODEL } from './anthropicModelId';

export type AiProviderSlug = 'deepseek' | 'openai' | 'anthropic';

export type AiModelOption = { value: string; label: string };

/** DeepSeek — transport OpenAI-compatible @ api.deepseek.com/v1 */
const DEEPSEEK_MODELS: AiModelOption[] = [
  { value: 'deepseek-chat', label: 'DeepSeek Chat (deepseek-chat)' },
  { value: 'deepseek-reasoner', label: 'DeepSeek Reasoner (deepseek-reasoner)' },
];

/** OpenAI — chat/completions @ api.openai.com/v1 */
const OPENAI_MODELS: AiModelOption[] = [
  { value: 'gpt-4o-mini', label: 'GPT-4o mini' },
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
  { value: 'o3-mini', label: 'o3-mini' },
];

/**
 * Anthropic — Messages API @ api.anthropic.com/v1/messages
 * Alias resmi (claude-*-4-*) sesuai dokumentasi Anthropic.
 */
const ANTHROPIC_MODELS: AiModelOption[] = [
  { value: DEFAULT_ANTHROPIC_MESSAGES_MODEL, label: 'Claude Sonnet 4.6 (disarankan)' },
  { value: 'claude-opus-4-7', label: 'Claude Opus 4.7' },
  { value: 'claude-opus-4-6', label: 'Claude Opus 4.6' },
  { value: 'claude-haiku-4-5', label: 'Claude Haiku 4.5' },
  { value: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5' },
  { value: 'claude-opus-4-5-20251101', label: 'Claude Opus 4.5 (versi tanggal)' },
  { value: 'claude-sonnet-4-5-20250929', label: 'Claude Sonnet 4.5 (versi tanggal)' },
];

export function getModelOptionsForProvider(provider: string): AiModelOption[] {
  switch (provider) {
    case 'deepseek':
      return DEEPSEEK_MODELS;
    case 'openai':
      return OPENAI_MODELS;
    case 'anthropic':
      return ANTHROPIC_MODELS;
    default:
      return [];
  }
}

/**
 * Opsi untuk `<select>`: jika model tersimpan tidak ada di katalog, tampilkan sebagai opsi pertama
 * agar nilai tidak hilang sampai pengguna memilih dari daftar resmi.
 */
export function getModelSelectOptions(provider: string, currentModel: string): AiModelOption[] {
  const base = getModelOptionsForProvider(provider);
  const cur = currentModel.trim();
  if (!cur) {
    return [{ value: '', label: '— Pilih model —' }, ...base];
  }
  if (base.some((o) => o.value === cur)) return base;
  return [
    {
      value: cur,
      label: `${cur} (model tersimpan — pilih dari daftar resmi jika ingin mengganti)`,
    },
    ...base,
  ];
}
