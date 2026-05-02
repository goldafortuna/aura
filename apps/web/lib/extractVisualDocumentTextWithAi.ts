import { loadActiveAiCallConfig } from './aiConfig';
import { anthropicApiRoot } from './aiClient';
import type { AiCallConfig } from './aiClient';
import { resolveAnthropicModelId } from './anthropicModelId';

function toBase64(bytes: Uint8Array) {
  return Buffer.from(bytes).toString('base64');
}

function buildOcrInstruction(filename: string) {
  return `Ekstrak teks yang terlihat dari dokumen ini secara setia. Nama file: ${filename}. Kembalikan teks polos saja tanpa ringkasan, tanpa markdown, tanpa penjelasan tambahan.`;
}

async function callOpenAiCompatibleVisual(params: {
  cfg: AiCallConfig;
  bytes: Uint8Array;
  mimeType: string;
  filename: string;
}) {
  const base = (params.cfg.baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '');
  const dataUrl = `data:${params.mimeType};base64,${toBase64(params.bytes)}`;
  const isPdf = params.mimeType === 'application/pdf';

  const res = await fetch(`${base}/responses`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.cfg.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: params.cfg.model,
      input: [
        {
          role: 'user',
          content: isPdf
            ? [
                {
                  type: 'input_file',
                  filename: params.filename,
                  file_data: dataUrl,
                },
                {
                  type: 'input_text',
                  text: buildOcrInstruction(params.filename),
                },
              ]
            : [
                {
                  type: 'input_text',
                  text: buildOcrInstruction(params.filename),
                },
                {
                  type: 'input_image',
                  image_url: dataUrl,
                },
              ],
        },
      ],
      max_output_tokens: 1200,
    }),
  });

  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`Visual OCR request failed (HTTP ${res.status}): ${raw.slice(0, 400)}`);
  }

  const json = JSON.parse(raw) as {
    output_text?: string;
    output?: Array<{
      content?: Array<{ type?: string; text?: string }>;
    }>;
  };

  if (typeof json.output_text === 'string' && json.output_text.trim()) {
    return json.output_text.trim();
  }

  return (json.output ?? [])
    .flatMap((item) => item.content ?? [])
    .map((item) => (item?.type === 'output_text' || item?.type === 'text' ? String(item.text ?? '') : ''))
    .join('\n')
    .trim();
}

async function callAnthropicVisual(params: {
  cfg: AiCallConfig;
  bytes: Uint8Array;
  mimeType: string;
  filename: string;
}) {
  const root = anthropicApiRoot(params.cfg.baseUrl);
  const isPdf = params.mimeType === 'application/pdf';

  const res = await fetch(`${root}/v1/messages`, {
    method: 'POST',
    headers: {
      'x-api-key': params.cfg.apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: resolveAnthropicModelId(params.cfg.model),
      max_tokens: 1200,
      temperature: 0,
      system:
        'Anda adalah OCR engine. Ekstrak teks yang terlihat pada dokumen secara setia. Kembalikan teks polos saja tanpa ringkasan, tanpa markdown, tanpa penjelasan tambahan.',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: buildOcrInstruction(params.filename),
            },
            isPdf
              ? {
                  type: 'document',
                  source: {
                    type: 'base64',
                    media_type: 'application/pdf',
                    data: toBase64(params.bytes),
                  },
                }
              : {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: params.mimeType,
                    data: toBase64(params.bytes),
                  },
                },
          ],
        },
      ],
    }),
  });

  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`Visual OCR request failed (HTTP ${res.status}): ${raw.slice(0, 400)}`);
  }

  const json = JSON.parse(raw) as {
    content?: Array<{ type?: string; text?: string }>;
  };

  return (json.content ?? [])
    .map((item) => (item?.type === 'text' ? String(item.text ?? '') : ''))
    .join('\n')
    .trim();
}

export async function extractVisualDocumentTextWithAi(params: {
  userId: string;
  bytes: Uint8Array;
  mimeType: string;
  filename: string;
}) {
  const supportedMime = params.mimeType.startsWith('image/') || params.mimeType === 'application/pdf';
  if (!supportedMime) return '';

  const cfg = await loadActiveAiCallConfig(params.userId);
  if (!cfg?.apiKey) return '';

  if (cfg.kind === 'anthropic') {
    return callAnthropicVisual({
      cfg,
      bytes: params.bytes,
      mimeType: params.mimeType,
      filename: params.filename,
    });
  }

  return callOpenAiCompatibleVisual({
    cfg,
    bytes: params.bytes,
    mimeType: params.mimeType,
    filename: params.filename,
  });
}
