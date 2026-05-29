/**
 * Ekstraksi teks PDF — hindari `pdf-parse` package main (`index.js`).
 * Muat fungsi dari `pdf-parse-loader.cjs` (CommonJS `require` ke lib asli).
 */

type PdfParseFn = (buf: Buffer, opts?: unknown) => Promise<{ text?: string }>;

let cachedParse: PdfParseFn | null = null;

function resolvePdfParseExport(mod: unknown): PdfParseFn | null {
  if (typeof mod === 'function') return mod as PdfParseFn;
  if (mod && typeof mod === 'object') {
    const withDefault = mod as { default?: unknown };
    if (typeof withDefault.default === 'function') return withDefault.default as PdfParseFn;
  }
  return null;
}

async function getPdfParse(): Promise<PdfParseFn> {
  if (cachedParse) return cachedParse;
  const mod = await import('./pdf-parse-loader.cjs');
  const candidate = resolvePdfParseExport(mod);
  if (!candidate) {
    throw new Error('pdf-parse-loader.cjs tidak mengekspor fungsi parse PDF.');
  }
  cachedParse = candidate;
  return cachedParse;
}

export async function parsePdfBuffer(
  data: Buffer | Uint8Array,
  options?: unknown,
): Promise<{ text?: string }> {
  const pdfParse = await getPdfParse();
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
  return pdfParse(buf, options);
}
