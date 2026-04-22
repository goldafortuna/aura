import type { AiCallConfig } from './aiClient';

type CreateBatchRequestParams = {
  model: string;
  max_tokens: number;
  system: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
};

export type AnthropicMessageBatch = {
  id: string;
  type: 'message_batch';
  processing_status: 'in_progress' | 'ended' | 'canceling';
  request_counts?: {
    processing?: number;
    succeeded?: number;
    errored?: number;
    canceled?: number;
    expired?: number;
  };
  ended_at?: string | null;
  created_at?: string;
  expires_at?: string;
  cancel_initiated_at?: string | null;
  results_url?: string | null;
};

export async function anthropicCreateMessageBatch(params: {
  cfg: AiCallConfig;
  requests: Array<{ custom_id: string; params: CreateBatchRequestParams }>;
}) {
  if (params.cfg.kind !== 'anthropic') throw new Error('Anthropic batch requires anthropic transport.');

  const base = (params.cfg.baseUrl || 'https://api.anthropic.com').replace(/\/$/, '');

  const res = await fetch(`${base}/v1/messages/batches`, {
    method: 'POST',
    headers: {
      'x-api-key': params.cfg.apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ requests: params.requests }),
  });

  const raw = await res.text();
  if (!res.ok) throw new Error(`Anthropic batch create failed (HTTP ${res.status}): ${raw.slice(0, 800)}`);

  return JSON.parse(raw) as AnthropicMessageBatch;
}

export async function anthropicRetrieveMessageBatch(params: { cfg: AiCallConfig; batchId: string }) {
  if (params.cfg.kind !== 'anthropic') throw new Error('Anthropic batch requires anthropic transport.');
  const base = (params.cfg.baseUrl || 'https://api.anthropic.com').replace(/\/$/, '');

  const res = await fetch(`${base}/v1/messages/batches/${params.batchId}`, {
    method: 'GET',
    headers: {
      'x-api-key': params.cfg.apiKey,
      'anthropic-version': '2023-06-01',
    },
  });

  const raw = await res.text();
  if (!res.ok) throw new Error(`Anthropic batch retrieve failed (HTTP ${res.status}): ${raw.slice(0, 800)}`);
  return JSON.parse(raw) as AnthropicMessageBatch;
}

export type AnthropicBatchResultLine = {
  custom_id: string;
  result: {
    type: 'succeeded' | 'errored' | 'canceled' | 'expired';
    message?: {
      content?: Array<{ type?: string; text?: string }>;
    };
    error?: unknown;
  };
};

export async function anthropicDownloadBatchResults(params: { cfg: AiCallConfig; resultsUrl: string }) {
  if (params.cfg.kind !== 'anthropic') throw new Error('Anthropic batch requires anthropic transport.');

  const res = await fetch(params.resultsUrl, {
    method: 'GET',
    headers: {
      'x-api-key': params.cfg.apiKey,
      'anthropic-version': '2023-06-01',
    },
  });

  const raw = await res.text();
  if (!res.ok) throw new Error(`Anthropic batch results download failed (HTTP ${res.status}): ${raw.slice(0, 800)}`);

  const lines = raw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  return lines.map((l) => JSON.parse(l) as AnthropicBatchResultLine);
}

