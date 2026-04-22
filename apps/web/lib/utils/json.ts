export function stripCodeFences(input: string) {
  const s = input.trim();
  if (!s.startsWith('```')) return input;
  const lines = s.split('\n');
  if (lines.length <= 2) return input;
  if (!lines[lines.length - 1].trim().startsWith('```')) return input;
  return lines.slice(1, -1).join('\n').trim();
}

export function extractFirstJsonCandidate(input: string) {
  const s = stripCodeFences(input).trim();
  const idxs = [s.indexOf('{'), s.indexOf('[')].filter((i) => i >= 0);
  if (idxs.length === 0) return null;
  const start = Math.min(...idxs);
  const opener = s[start];
  const closer = opener === '{' ? '}' : ']';

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < s.length; i++) {
    const ch = s[i];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === '"') inString = false;
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === opener) depth++;
    if (ch === closer) depth--;
    if (depth === 0) return s.slice(start, i + 1);
  }

  return null;
}

export function parseAiJsonRelaxed(content: string) {
  try {
    return JSON.parse(content) as unknown;
  } catch {
    const candidate = extractFirstJsonCandidate(content);
    if (!candidate) throw new Error('AI content was not valid JSON.');
    return JSON.parse(candidate) as unknown;
  }
}