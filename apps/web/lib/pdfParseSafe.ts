/**
 * Ekstraksi teks PDF — hindari `pdf-parse` package main (`index.js`).
 * Muat fungsi dari `pdf-parse-loader.cjs` (CommonJS `require` ke lib asli).
 */

type PdfParseFn = (buf: Buffer, opts?: unknown) => Promise<{ text?: string }>;

let cachedParse: PdfParseFn | null = null;

async function getPdfParse(): Promise<PdfParseFn> {
  if (cachedParse) return cachedParse;
  const mod = (await import('./pdf-parse-loader.cjs')) as { default?: unknown };
  const candidate = mod.default;
  if (typeof candidate !== 'function') {
    throw new Error('pdf-parse-loader.cjs tidak mengekspor fungsi parse PDF.');
  }
  cachedParse = candidate as PdfParseFn;
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
