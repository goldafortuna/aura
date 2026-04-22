type UnitKerjaLike = {
  id: string;
  name: string;
  aliasesJson?: string | null;
};

function normalizeUnitText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseAliases(aliasesJson?: string | null) {
  if (!aliasesJson) return [] as string[];
  try {
    const parsed = JSON.parse(aliasesJson) as unknown;
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : [];
  } catch {
    return [];
  }
}

export function buildUnitKerjaHints<T extends UnitKerjaLike>(rows: T[]) {
  return rows.map((row) => ({
    name: row.name,
    aliases: parseAliases(row.aliasesJson),
  }));
}

export function resolveUnitKerjaMatch<T extends UnitKerjaLike>(params: {
  candidates: Array<string | null | undefined>;
  rows: T[];
}): T | null {
  const normalizedCandidates = params.candidates
    .filter((candidate): candidate is string => typeof candidate === 'string' && candidate.trim().length > 0)
    .map(normalizeUnitText)
    .filter(Boolean);

  if (normalizedCandidates.length === 0 || params.rows.length === 0) return null;

  let best: { row: T; score: number } | null = null;

  for (const row of params.rows) {
    const terms = [row.name, ...parseAliases(row.aliasesJson)]
      .map(normalizeUnitText)
      .filter(Boolean);

    for (const candidate of normalizedCandidates) {
      for (const term of terms) {
        let score = 0;
        if (candidate === term) {
          score = 100;
        } else if (candidate.includes(term) || term.includes(candidate)) {
          score = 80;
        } else {
          const candidateWords = new Set(candidate.split(' '));
          const termWords = new Set(term.split(' '));
          let overlap = 0;
          for (const word of candidateWords) {
            if (termWords.has(word)) overlap += 1;
          }
          if (overlap > 0) {
            score = Math.round((overlap / Math.max(candidateWords.size, termWords.size)) * 60);
          }
        }

        if (score > 0 && (!best || score > best.score)) {
          best = { row, score };
        }
      }
    }
  }

  return best?.score && best.score >= 60 ? best.row : null;
}

export function normalizeDetectedUnit<T extends UnitKerjaLike>(params: {
  detectedUnit?: string | null;
  title?: string | null;
  action?: string | null;
  pic?: string | null;
  rows: T[];
}) {
  const matched = resolveUnitKerjaMatch({
    candidates: [params.detectedUnit, params.title, params.action, params.pic],
    rows: params.rows,
  });

  if (matched) return matched.name;

  const fallback = params.detectedUnit?.trim();
  return fallback ? fallback : null;
}
