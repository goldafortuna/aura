/**
 * Anthropic Messages API memakai ID versi (mis. claude-sonnet-4-6).
 * Alias seperti `claude-3-5-sonnet-latest` (dari UI konsol) dan model Sonnet 3.5 yang sudah retired
 * akan mengembalikan not_found — petakan ke model aktif yang direkomendasikan.
 *
 * @see https://docs.anthropic.com/en/docs/about-claude/model-deprecations
 */
export const DEFAULT_ANTHROPIC_MESSAGES_MODEL = 'claude-sonnet-4-6';

/** ID / alias yang diketahui tidak valid atau sudah retired pada Messages API. */
const LEGACY_TO_CURRENT: Record<string, string> = {
  // Bukan ID API (sering disalin dari UI)
  'claude-3-5-sonnet-latest': DEFAULT_ANTHROPIC_MESSAGES_MODEL,
  'claude-sonnet-latest': DEFAULT_ANTHROPIC_MESSAGES_MODEL,
  // Sonnet 3.5 retired (okt 2025)
  'claude-3-5-sonnet': DEFAULT_ANTHROPIC_MESSAGES_MODEL,
  'claude-3-5-sonnet-20241022': DEFAULT_ANTHROPIC_MESSAGES_MODEL,
  'claude-3-5-sonnet-20240620': DEFAULT_ANTHROPIC_MESSAGES_MODEL,
  // Sonnet 3.7 retired
  'claude-3-7-sonnet-20250219': DEFAULT_ANTHROPIC_MESSAGES_MODEL,
};

export function resolveAnthropicModelId(model: string | null | undefined): string {
  const m = (model ?? '').trim();
  if (!m) return DEFAULT_ANTHROPIC_MESSAGES_MODEL;
  return LEGACY_TO_CURRENT[m] ?? m;
}
