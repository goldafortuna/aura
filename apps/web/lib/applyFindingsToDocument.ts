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

/** Surface PizZip yang dipakai oleh injeksi numbering (hindari `any` tanpa plugin @typescript-eslint). */
type DocxZipFileEntry = {
  asText(): string;
};

type DocxZip = {
  file(path: string): DocxZipFileEntry | null;
  file(path: string, data: string): void;
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
 * Injects a simple decimal (1., 2., 3.) numbering definition into word/numbering.xml.
 * Uses IDs beyond the existing max to avoid collisions.
 * Returns the new numId to reference in <w:numPr>.
 */
function injectDecimalNumbering(zip: DocxZip): number {
  const buildAbstractNum = (abstractId: number) =>
    `<w:abstractNum w:abstractNumId="${abstractId}">` +
    `<w:multiLevelType w:val="singleLevel"/>` +
    `<w:lvl w:ilvl="0">` +
    `<w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/>` +
    `<w:lvlJc w:val="left"/>` +
    `<w:pPr><w:ind w:left="360" w:hanging="360"/></w:pPr>` +
    `<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>` +
    `<w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>` +
    `</w:lvl></w:abstractNum>`;

  const buildNum = (numId: number, abstractId: number) =>
    `<w:num w:numId="${numId}"><w:abstractNumId w:val="${abstractId}"/></w:num>`;

  const numFile = zip.file('word/numbering.xml');

  if (!numFile) {
    // Create numbering.xml from scratch, plus wire up the relationship and content type
    const ns = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
    zip.file(
      'word/numbering.xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
        `<w:numbering ${ns}>\n${buildAbstractNum(1)}\n${buildNum(1, 1)}\n</w:numbering>`,
    );

    // Add relationship
    const relsFile = zip.file('word/_rels/document.xml.rels');
    if (relsFile) {
      let rels = relsFile.asText();
      const numRel =
        `<Relationship Id="rIdNumKep" ` +
        `Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" ` +
        `Target="numbering.xml"/>`;
      rels = rels.replace('</Relationships>', numRel + '</Relationships>');
      zip.file('word/_rels/document.xml.rels', rels);
    }

    // Add content type
    const ctFile = zip.file('[Content_Types].xml');
    if (ctFile) {
      let ct = ctFile.asText();
      const numCt =
        `<Override PartName="/word/numbering.xml" ` +
        `ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>`;
      ct = ct.replace('</Types>', numCt + '</Types>');
      zip.file('[Content_Types].xml', ct);
    }

    return 1;
  }

  let numXml = numFile.asText();

  // Find the current max abstractNumId and numId to avoid collisions
  const abstractIds: number[] = [];
  const abstractIdRe = /w:abstractNum\s+w:abstractNumId="(\d+)"/g;
  let am: RegExpExecArray | null;
  while ((am = abstractIdRe.exec(numXml)) !== null) abstractIds.push(parseInt(am[1]));

  const numIds: number[] = [];
  const numIdRe = /<w:num\s[^>]*w:numId="(\d+)"/g;
  let nm: RegExpExecArray | null;
  while ((nm = numIdRe.exec(numXml)) !== null) numIds.push(parseInt(nm[1]));
  const newAbstractId = (abstractIds.length > 0 ? Math.max(...abstractIds) : 0) + 1;
  const newNumId = (numIds.length > 0 ? Math.max(...numIds) : 0) + 1;

  // Insert abstractNum before the first <w:num> block (OOXML requires abstractNums first)
  const firstNumMatch = numXml.match(/<w:num\s/);
  if (firstNumMatch?.index !== undefined) {
    numXml =
      numXml.slice(0, firstNumMatch.index) +
      buildAbstractNum(newAbstractId) +
      numXml.slice(firstNumMatch.index);
  } else {
    numXml = numXml.replace('</w:numbering>', buildAbstractNum(newAbstractId) + '</w:numbering>');
  }

  // Append <w:num> before </w:numbering>
  numXml = numXml.replace('</w:numbering>', buildNum(newNumId, newAbstractId) + '</w:numbering>');
  zip.file('word/numbering.xml', numXml);
  return newNumId;
}

/**
 * Builds an action paragraph XML by cloning the template paragraph's pPr and rPr.
 * When wordNumId is provided, injects <w:numPr> and drops any existing numPr/ind
 * so Word handles the numbering and hanging indent natively.
 */
function buildActionParaFromTemplate(
  templateParaXml: string,
  actionText: string,
  wordNumId: number,
): string {
  const pPrMatch = templateParaXml.match(/<w:pPr[\s\S]*?<\/w:pPr>/);
  let pPr = pPrMatch ? pPrMatch[0] : '';

  // Strip existing numPr and ind — the injected abstractNum definition provides both
  pPr = pPr.replace(/<w:numPr[\s\S]*?<\/w:numPr>/, '');
  pPr = pPr.replace(/<w:ind(?:\s[^/]*)?\/>/, '');

  // Inject <w:numPr> right after <w:pStyle> if present, otherwise after <w:pPr>
  const numPrXml = `<w:numPr><w:ilvl w:val="0"/><w:numId w:val="${wordNumId}"/></w:numPr>`;
  if (/<\/w:pStyle>/.test(pPr)) {
    pPr = pPr.replace(/<\/w:pStyle>/, `</w:pStyle>${numPrXml}`);
  } else if (pPr) {
    pPr = pPr.replace('<w:pPr>', `<w:pPr>${numPrXml}`);
  } else {
    pPr = `<w:pPr>${numPrXml}<w:spacing w:after="0" w:line="276" w:lineRule="auto"/><w:jc w:val="both"/></w:pPr>`;
  }

  // Clone rPr from the template run
  const rBlock = templateParaXml.match(/<w:r[\s\S]*?<\/w:r>/);
  let rPr = '';
  if (rBlock) {
    const rPrMatch = rBlock[0].match(/<w:rPr[\s\S]*?<\/w:rPr>/);
    rPr = rPrMatch ? rPrMatch[0] : '';
  }

  const escaped = escapeXml(actionText);
  const tTag =
    actionText.startsWith(' ') || actionText.endsWith(' ')
      ? `<w:t xml:space="preserve">${escaped}</w:t>`
      : `<w:t>${escaped}</w:t>`;

  return `<w:p>${pPr}<w:r>${rPr}${tTag}</w:r></w:p>`;
}

/**
 * Fallback KEPUTUSAN XML when no template placeholder is found in the document.
 * Uses Word numbering via wordNumId so items are properly formatted.
 */
function buildFallbackKeputusanXml(ctas: ApprovedCta[], wordNumId: number): string {
  if (ctas.length === 0) return '';

  const pPr =
    `<w:pPr>` +
    `<w:numPr><w:ilvl w:val="0"/><w:numId w:val="${wordNumId}"/></w:numPr>` +
    `<w:spacing w:after="0" w:line="276" w:lineRule="auto"/>` +
    `<w:jc w:val="both"/>` +
    `</w:pPr>`;
  const rPr =
    `<w:rPr>` +
    `<w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>` +
    `<w:sz w:val="24"/><w:szCs w:val="24"/>` +
    `</w:rPr>`;

  const lines: string[] = [];
  ctas.forEach((cta) => {
    const escaped = escapeXml(cta.action);
    lines.push(
      `<w:p>${pPr}<w:r>${rPr}<w:t xml:space="preserve">${escaped}</w:t></w:r></w:p>`,
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
    // Inject a new decimal numbering definition so Word handles "1.", "2.", "3." natively
    const keputusanNumId = injectDecimalNumbering(zip);

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
            // Build numbered action paragraphs — Word numbers them via keputusanNumId
            const emptyPara = `<w:p><w:r><w:t></w:t></w:r></w:p>`;
            const actionParas = approvedCtas
              .map((cta) => buildActionParaFromTemplate(lastParaXml, cta.action, keputusanNumId) + emptyPara)
              .join('');

            // Replace the template placeholder with our action paragraphs
            xml =
              xml.substring(0, lastParaStartIdx) +
              actionParas +
              xml.substring(lastParaEndIdx + '</w:p>'.length);

            injected = true;
          }
        }
      }
    }

    // Strategy B: Fallback — append action paragraphs before <w:sectPr>
    if (!injected) {
      const fallbackXml = buildFallbackKeputusanXml(approvedCtas, keputusanNumId);
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
