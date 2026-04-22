export function parseIsoDateOrNull(input: string | null | undefined) {
  const v = (input ?? '').trim();
  if (!v) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}