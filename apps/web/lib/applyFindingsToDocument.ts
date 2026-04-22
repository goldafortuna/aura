/**
 * applyFindingsToDocument
 *
 * Menerapkan temuan (findings) yang disetujui ke dokumen asli:
 * - DOCX: manipulasi XML langsung via PizZip — mempertahankan formatting
 * - PDF : ekstrak teks → terapkan koreksi → generate DOCX baru via `docx`
 *
 * Mengembalikan Buffer berisi file hasil koreksi beserta mime type-nya.
 */

export type ApprovedFinding = {
  originalText: string;
  suggestedText: string;
};

export type ApplyResult = {
  buffer: Buffer;
  mimeType: string;
  filename: string;
};

// ─── DOCX via PizZip XML manipulation ────────────────────────────────────────

async function applyToDocx(
  bytes: Uint8Array,
  findings: ApprovedFinding[],
  originalFilename: string,
): Promise<ApplyResult> {
  const PizZip = (await import('pizzip')).default;

  const zip = new PizZip(Buffer.from(bytes));

  // Dokumen utama ada di word/document.xml
  const xmlFile = zip.file('word/document.xml');
  if (!xmlFile) {
    throw new Error('word/document.xml tidak ditemukan di dalam file DOCX.');
  }

  let xml = xmlFile.asText();

  // Di DOCX, teks berada di dalam tag <w:t>…</w:t>.
  // Pendekatan: replace langsung di raw XML — cukup handal untuk koreksi typo
  // (kalimat pendek) selama teks tidak di-split antar run.
  for (const finding of findings) {
    if (!finding.originalText || !finding.suggestedText) continue;
    // Escape karakter XML khusus agar search cocok dengan isi XML
    const escapedOrig = escapeXml(finding.originalText);
    const escapedSugg = escapeXml(finding.suggestedText);
    // Global replace — jika muncul lebih dari sekali, semua diganti
    xml = xml.split(escapedOrig).join(escapedSugg);
  }

  zip.file('word/document.xml', xml);

  const correctedBuf = zip.generate({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  }) as Buffer;

  const stem = originalFilename.replace(/\.docx$/i, '');
  return {
    buffer: correctedBuf,
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    filename: `${stem}_terkoreksi.docx`,
  };
}

// ─── PDF → corrected DOCX ─────────────────────────────────────────────────────

async function applyToPdf(
  bytes: Uint8Array,
  findings: ApprovedFinding[],
  originalFilename: string,
): Promise<ApplyResult> {
  // 1. Ekstrak teks dari PDF
  const { default: pdfParse } = await import('pdf-parse');
  const parsed = await pdfParse(Buffer.from(bytes));
  let text: string = parsed.text ?? '';

  // 2. Terapkan koreksi
  for (const finding of findings) {
    if (!finding.originalText || !finding.suggestedText) continue;
    text = text.split(finding.originalText).join(finding.suggestedText);
  }

  // 3. Generate DOCX dari teks terkoreksi
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import('docx');

  const paragraphs = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .map((line) => {
      if (!line) return new Paragraph({});
      // Deteksi baris yang terlihat seperti heading (semua huruf kapital atau pendek)
      const looksLikeHeading = line === line.toUpperCase() && line.length < 80 && line.length > 2;
      if (looksLikeHeading) {
        return new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun({ text: line, bold: true })],
        });
      }
      return new Paragraph({
        children: [new TextRun({ text: line })],
      });
    });

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: paragraphs,
      },
    ],
  });

  const correctedBuf = await Packer.toBuffer(doc);

  const stem = originalFilename.replace(/\.pdf$/i, '');
  return {
    buffer: correctedBuf,
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    filename: `${stem}_terkoreksi.docx`,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function applyFindingsToDocument(params: {
  bytes: Uint8Array;
  mimeType: string;
  filename: string;
  findings: ApprovedFinding[];
}): Promise<ApplyResult> {
  const { bytes, mimeType, filename, findings } = params;

  if (findings.length === 0) {
    throw new Error('Tidak ada temuan yang disetujui untuk diterapkan.');
  }

  const lower = filename.toLowerCase();
  const isDocx =
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    lower.endsWith('.docx');
  const isPdf = mimeType === 'application/pdf' || lower.endsWith('.pdf');

  if (isDocx) return applyToDocx(bytes, findings, filename);
  if (isPdf) return applyToPdf(bytes, findings, filename);

  throw new Error(`Tipe file tidak didukung untuk koreksi: ${mimeType}`);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
