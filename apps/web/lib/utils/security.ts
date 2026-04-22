export function maskApiKey(key: string) {
  const trimmed = key.trim();
  if (!trimmed) return '';
  if (trimmed.length <= 8) return '••••••••';
  return `${trimmed.slice(0, 4)}…${trimmed.slice(-4)}`;
}

export function isMaskedApiKeyInput(input: string) {
  return input.includes('…') || input.includes('•');
}