import { z } from 'zod';
import { extractFirstJsonCandidate } from './utils/json';

export type AiTransportKind = 'openai_compatible' | 'anthropic';

export interface AiCallConfig {
  kind: AiTransportKind;
  apiKey: string;
  baseUrl?: string | null;
  model: string;
}

function clipText(input: string, maxChars: number) {
  if (input.length <= maxChars) return input;
  return `${input.slice(0, maxChars)}\n\n[TEKS_DIPOTONG_UNTUK_ANALISA]`;
}

function normalizeJsonLike(input: string) {
  // A few conservative repairs:
  // - Remove trailing commas before } or ]
  // - Normalize curly quotes to regular quotes (rare copy/paste)
  return input
    .replace(/\uFEFF/g, '')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/,\s*([}\]])/g, '$1');
}

/** Balanced JSON slice starting exactly at `{` or `[` (handles leading prose before the root object). */
function extractBalancedAt(s: string, start: number): string | null {
  if (start < 0 || start >= s.length) return null;
  const opener = s[start];
  if (opener !== '{' && opener !== '[') return null;
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
      if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === opener) depth++;
    if (ch === closer) depth--;

    if (depth === 0) {
      return s.slice(start, i + 1);
    }
  }

  return null;
}

function tryParseJsonObjectString(chunk: string): unknown | null {
  const trimmed = chunk.trim();

  const parseCandidate = (s: string): unknown | null => {
    const normalized = normalizeJsonLike(s);
    try {
      return JSON.parse(normalized) as unknown;
    } catch {
      const candidate = extractFirstJsonCandidate(normalized);
      if (!candidate) return null;
      try {
        return JSON.parse(normalizeJsonLike(candidate)) as unknown;
      } catch {
        return null;
      }
    }
  };

  const direct = parseCandidate(trimmed);
  if (direct !== null) return direct;

  const summaryRoot = /\{\s*"summary"\s*:/g;
  const starts: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = summaryRoot.exec(trimmed)) !== null) {
    starts.push(m.index);
  }
  for (let si = starts.length - 1; si >= 0; si--) {
    const balanced = extractBalancedAt(trimmed, starts[si]);
    if (!balanced) continue;
    const parsed = parseCandidate(balanced);
    if (parsed !== null) return parsed;
  }

  return null;
}

/** Tries whole string, fenced ``` blocks, and bracket-balanced extraction (DeepSeek/OpenAI prose + JSON). */
function parseModelJsonContent(rawContent: string): unknown {
  const base = rawContent.trim();
  const chunks: string[] = [base.trim()];

  const fenceParts = base.split('```');
  for (let i = 1; i < fenceParts.length; i += 2) {
    const segment = fenceParts[i].replace(/^(json|JSON)\s*\n?/, '').trim();
    if (segment) chunks.push(segment);
  }

  for (const chunk of chunks) {
    const parsed = tryParseJsonObjectString(chunk);
    if (parsed !== null) return parsed;
  }

  throw new Error('AI content was not valid JSON.');
}

async function callOpenAiCompatibleJson(params: {
  cfg: AiCallConfig;
  system: string;
  user: string;
  maxInputChars: number;
}) {
  const base = (params.cfg.baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '');
  const clippedUser = clipText(params.user, params.maxInputChars);
  const maxOut = Math.min(Math.max(Number(process.env.AI_MAX_OUTPUT_TOKENS || 8192), 512), 32768);

  const messages = [
    { role: 'system' as const, content: params.system },
    { role: 'user' as const, content: clippedUser },
  ];

  const post = async (body: Record<string, unknown>) => {
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${params.cfg.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const raw = await res.text();
    return { res, raw };
  };

  let { res, raw } = await post({
    model: params.cfg.model,
    temperature: 0.2,
    max_tokens: maxOut,
    messages,
    response_format: { type: 'json_object' },
  });

  const looksLikeJsonFormatRejection =
    !res.ok &&
    (res.status === 400 || res.status === 422) &&
    /response_format|json_object|unknown.*parameter/i.test(raw);

  if (looksLikeJsonFormatRejection) {
    ({ res, raw } = await post({
      model: params.cfg.model,
      temperature: 0.2,
      max_tokens: maxOut,
      messages,
    }));
  }

  if (!res.ok) throw new Error(`AI request failed (HTTP ${res.status}): ${raw.slice(0, 800)}`);

  let completionJson: unknown;
  try {
    completionJson = JSON.parse(raw) as unknown;
  } catch {
    throw new Error('AI response was not JSON.');
  }

  const content =
    completionJson &&
    typeof completionJson === 'object' &&
    'choices' in completionJson &&
    Array.isArray((completionJson as { choices?: unknown }).choices)
      ? String(
          ((completionJson as { choices: Array<{ message?: { content?: unknown } }> }).choices[0]?.message?.content) ??
            '',
        )
      : '';

  if (!content.trim()) throw new Error('AI returned empty content.');
  return content;
}

async function callAnthropicJson(params: {
  cfg: AiCallConfig;
  system: string;
  user: string;
  maxInputChars: number;
}) {
  const base = (params.cfg.baseUrl || 'https://api.anthropic.com').replace(/\/$/, '');
  const clippedUser = clipText(params.user, params.maxInputChars);

  const res = await fetch(`${base}/v1/messages`, {
    method: 'POST',
    headers: {
      'x-api-key': params.cfg.apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: params.cfg.model,
      max_tokens: 4096,
      temperature: 0.2,
      system: params.system,
      messages: [{ role: 'user', content: clippedUser }],
    }),
  });

  const raw = await res.text();
  if (!res.ok) throw new Error(`AI request failed (HTTP ${res.status}): ${raw.slice(0, 800)}`);

  let json: unknown;
  try {
    json = JSON.parse(raw) as unknown;
  } catch {
    throw new Error('AI response was not JSON.');
  }

  const blocks =
    json && typeof json === 'object' && 'content' in json && Array.isArray((json as { content?: unknown }).content)
      ? ((json as { content: Array<{ type?: unknown; text?: unknown }> }).content ?? [])
      : [];

  const textBlock = blocks.find((b) => String(b.type) === 'text');
  const content = String(textBlock?.text ?? '');
  if (!content.trim()) throw new Error('AI returned empty content.');
  return content;
}

export async function callAiForJson(params: {
  cfg: AiCallConfig;
  system: string;
  user: string;
  maxInputChars?: number;
}) {
  const maxInputChars = params.maxInputChars ?? Number(process.env.AI_MAX_INPUT_CHARS || 25000);

  const content =
    params.cfg.kind === 'anthropic'
      ? await callAnthropicJson({ cfg: params.cfg, system: params.system, user: params.user, maxInputChars })
      : await callOpenAiCompatibleJson({ cfg: params.cfg, system: params.system, user: params.user, maxInputChars });

  return parseModelJsonContent(content);
}

export async function callAiForJsonSchema<T extends z.ZodTypeAny>(params: {
  cfg: AiCallConfig;
  system: string;
  user: string;
  schema: T;
  maxInputChars?: number;
}): Promise<z.infer<T>> {
  const parsed = await callAiForJson({
    cfg: params.cfg,
    system: params.system,
    user: params.user,
    maxInputChars: params.maxInputChars,
  });
  return params.schema.parse(parsed) as z.infer<T>;
}
