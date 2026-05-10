import { parsePdfBuffer } from '@/lib/pdfParseSafe';

export async function extractDocumentText(params: { bytes: Uint8Array; mimeType: string; filename: string }) {
  const { bytes, mimeType, filename } = params;
  const lower = filename.toLowerCase();

  const isPdf = mimeType === 'application/pdf' || lower.endsWith('.pdf');
  const isDoc = mimeType === 'application/msword' || lower.endsWith('.doc');
  const isDocx =
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || lower.endsWith('.docx');

  if (isPdf) {
    const buf = Buffer.from(bytes);
    const parsed = await parsePdfBuffer(buf);
    return parsed.text ?? '';
  }

  if (isDocx) {
    const buf = Buffer.from(bytes);
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer: buf });
    return result.value ?? '';
  }

  if (isDoc) {
    const buf = Buffer.from(bytes);
    const { default: WordExtractor } = await import('word-extractor');
    const extractor = new WordExtractor();
    const extracted = await extractor.extract(buf);
    return extracted.getBody() ?? '';
  }

  throw new Error(`Unsupported document type for text extraction: ${mimeType || 'unknown'}`);
}
