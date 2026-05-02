/**
 * applyFindingsToDocument
 *
 * Menerapkan temuan (findings) yang disetujui ke dokumen asli dan mengisi
 * seksi KEPUTUSAN dari CTA yang disetujui:
 * - DOCX: manipulasi XML langsung via PizZip — mempertahankan formatting
 *   Untuk bagian KEPUTUSAN, mencari paragraf placeholder "1. " di bagian
 *   KEPUTUSAN template dan menggantinya dengan kalimat keputusan formal.
 * - PDF : ekstrak teks → terapkan koreksi → generate DOCX baru via `docx`
 *
 * Mengembalikan Buffer berisi file hasil koreksi beserta mime type-nya.
 */

export type ApprovedFinding = {
  originalText: string;
  suggestedText: string;
};

export type ApprovedCta = {
  title: string;
  action: string;
  picName: string | null;
  unit: string | null;
  deadline: string | null;
  priority: 'low' | 'medium' | 'high';
};

export type ApplyResult = {
  buffer: Buffer;
  mimeType: string;
  filename: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Builds an action paragraph XML by cloning the template paragraph's pPr and rPr,
 * then replacing the text content with the action text.
 * Falls back to a plain paragraph if template extraction fails.
 */
function buildActionParaFromTemplate(templateParaXml: string, actionText: string): string {
  // Extract <w:pPr>...</w:pPr>
  const pPrMatch = templateParaXml.match(/<w:pPr[\s\S]*?<\/w:pPr>/);
  const pPr = pPrMatch ? pPrMatch[0] : '';

  // Extract <w:rPr>...</w:rPr> from inside the run (not the one in pPr)
  // Find the run block first, then extract its rPr
  const rBlock = templateParaXml.match(/<w:r[\s\S]*?<\/w:r>/);
  let rPr = '';
  if (rBlock) {
    const rPrMatch = rBlock[0].match(/<w:rPr[\s\S]*?<\/w:rPr>/);
    rPr = rPrMatch ? rPrMatch[0] : '';
  }

  const escaped = escapeXml(actionText);
  const hasLeadingOrTrailingSpace = actionText.startsWith(' ') || actionText.endsWith(' ');
  const tTag = hasLeadingOrTrailingSpace
    ? `<w:t xml:space="preserve">${escaped}</w:t>`
    : `<w:t>${escaped}</w:t>`;

  return `<w:p>${pPr}<w:r>${rPr}${tTag}</w:r></w:p>`;
}

/**
 * Fallback KEPUTUSAN XML when no template is found in the document.
 * Appends a minimal plain-text KEPUTUSAN section with numbered items.
 */
function buildFallbackKeputusanXml(ctas: ApprovedCta[]): string {
  if (ctas.length === 0) return '';

  const lines: string[] = [];
  ctas.forEach((cta, idx) => {
    const numbered = `${idx + 1}. ${cta.action}`;
    lines.push(
      `<w:p><w:r><w:t xml:space="preserve">${escapeXml(numbered)}</w:t></w:r></w:p>`,
      `<w:p><w:r><w:t></w:t></w:r></w:p>`,
    );
  });
  return lines.join('');
}

// ─── DOCX via PizZip XML manipulation ────────────────────────────────────────

async function applyToDocx(
  bytes: Uint8Array,
  findings: ApprovedFinding[],
  originalFilename: string,
  approvedCtas: ApprovedCta[],
): Promise<ApplyResult> {
  const PizZip = (await import('pizzip')).default;

  const zip = new PizZip(Buffer.from(bytes));

  const xmlFile = zip.file('word/document.xml');
  if (!xmlFile) {
    throw new Error('word/document.xml tidak ditemukan di dalam file DOCX.');
  }

  let xml = xmlFile.asText();

  // ── 1. Apply typo/ambiguous corrections ────────────────────────────────────
  for (const finding of findings) {
    if (!finding.originalText || !finding.suggestedText) continue;
    const escapedOrig = escapeXml(finding.originalText);
    const escapedSugg = escapeXml(finding.suggestedText);
    xml = xml.split(escapedOrig).join(escapedSugg);
  }

  // ── 2. Fill KEPUTUSAN section with approved CTA actions ───────────────────
  if (approvedCtas.length > 0) {
    let injected = false;

    // Strategy A: Find "1. " placeholder paragraph (UGM rapim notula template pattern).
    // This placeholder is typically the last <w:p> before <w:sectPr> and contains "1. " text.
    const sectPrIdx = xml.lastIndexOf('<w:sectPr');
    if (sectPrIdx >= 0) {
      const bodyBeforeSect = xml.substring(0, sectPrIdx);
      const lastParaEndIdx = bodyBeforeSect.lastIndexOf('</w:p>');

      if (lastParaEndIdx >= 0) {
        // IMPORTANT: Use character-after check to distinguish <w:p> from <w:pPr>, <w:pStyle>, etc.
        // lastIndexOf('<w:p') alone would wrongly match <w:pPr> inside the paragraph.
        let lastParaStartIdx = -1;
        let searchFrom = lastParaEndIdx;
        while (searchFrom >= 0) {
          const candidateIdx = bodyBeforeSect.lastIndexOf('<w:p', searchFrom);
          if (candidateIdx < 0) break;
          const nextChar = bodyBeforeSect[candidateIdx + 4];
          if (nextChar === '>' || nextChar === ' ' || nextChar === '\t') {
            lastParaStartIdx = candidateIdx;
            break;
          }
          searchFrom = candidateIdx - 1;
        }

        if (lastParaStartIdx >= 0) {
          const lastParaXml = bodyBeforeSect.substring(lastParaStartIdx, lastParaEndIdx + '</w:p>'.length);

          // Check that this paragraph is the template placeholder (contains "1. " or "1.")
          const isTemplate = />\s*1\s*\.[\s<]/.test(lastParaXml);

          if (isTemplate) {
            // Build numbered action paragraphs using the template style, with blank line separators
            const emptyPara = `<w:p><w:r><w:t></w:t></w:r></w:p>`;
            const actionParas = approvedCtas
              .map((cta, idx) => {
                const numbered = `${idx + 1}. ${cta.action}`;
                return buildActionParaFromTemplate(lastParaXml, numbered) + emptyPara;
              })
              .join('');

            // Replace the template placeholder with our action paragraphs
            xml = xml.substring(0, lastParaStartIdx) +
              actionParas +
              xml.substring(lastParaEndIdx + '</w:p>'.length);

            injected = true;
          }
        }
      }
    }

    // Strategy B: Fallback — append action paragraphs before <w:sectPr>
    if (!injected) {
      const fallbackXml = buildFallbackKeputusanXml(approvedCtas);
      const insertAt = xml.lastIndexOf('<w:sectPr');
      if (insertAt >= 0) {
        xml = xml.slice(0, insertAt) + fallbackXml + xml.slice(insertAt);
      } else {
        const bodyClose = xml.lastIndexOf('</w:body>');
        if (bodyClose >= 0) {
          xml = xml.slice(0, bodyClose) + fallbackXml + xml.slice(bodyClose);
        }
      }
    }
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
  approvedCtas: ApprovedCta[],
): Promise<ApplyResult> {
  const { default: pdfParse } = await import('pdf-parse');
  const parsed = await pdfParse(Buffer.from(bytes));
  let text: string = parsed.text ?? '';

  for (const finding of findings) {
    if (!finding.originalText || !finding.suggestedText) continue;
    text = text.split(finding.originalText).join(finding.suggestedText);
  }

  const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = await import('docx');

  const paragraphs = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .map((line) => {
      if (!line) return new Paragraph({});
      const looksLikeHeading = line === line.toUpperCase() && line.length < 80 && line.length > 2;
      if (looksLikeHeading) {
        return new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun({ text: line, bold: true })],
        });
      }
      return new Paragraph({ children: [new TextRun({ text: line })] });
    });

  // Append KEPUTUSAN section — plain kalimat formal, one paragraph each
  if (approvedCtas.length > 0) {
    paragraphs.push(new Paragraph({}));
    paragraphs.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: 'KEPUTUSAN', bold: true })],
      }),
    );
    paragraphs.push(new Paragraph({}));

    approvedCtas.forEach((cta, idx) => {
      paragraphs.push(new Paragraph({ children: [new TextRun({ text: `${idx + 1}. ${cta.action}` })] }));
      paragraphs.push(new Paragraph({}));
    });
  }

  const doc = new Document({ sections: [{ properties: {}, children: paragraphs }] });
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
  approvedCtas?: ApprovedCta[];
}): Promise<ApplyResult> {
  const { bytes, mimeType, filename, findings, approvedCtas = [] } = params;

  if (findings.length === 0 && approvedCtas.length === 0) {
    throw new Error('Tidak ada temuan atau keputusan yang disetujui untuk diterapkan.');
  }

  const lower = filename.toLowerCase();
  const isDocx =
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    lower.endsWith('.docx');
  const isPdf = mimeType === 'application/pdf' || lower.endsWith('.pdf');

  if (isDocx) return applyToDocx(bytes, findings, filename, approvedCtas);
  if (isPdf) return applyToPdf(bytes, findings, filename, approvedCtas);

  throw new Error(`Tipe file tidak didukung untuk koreksi: ${mimeType}`);
}
