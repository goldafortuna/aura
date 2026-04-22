declare module 'pdf-parse' {
  // pdf-parse@1.x default export is a function(buffer) => Promise<PdfParseResult>
  // Keep this intentionally loose; we validate behavior at runtime in tests/manual runs.
  const pdfParse: (data: Buffer | Uint8Array, options?: unknown) => Promise<{ text?: string }>;
  export default pdfParse;
}
