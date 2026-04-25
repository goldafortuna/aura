export {
  loadActiveAiCallConfig,
  loadDocumentReviewSystemPrompt,
  loadMinutesReviewSystemPrompt,
} from '../../../../lib/aiConfig';
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
