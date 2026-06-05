/* eslint-disable no-console */
/**
 * OCR screenshot SBU/PDLN → teks mentah + patch JSON pedoman.
 * Jalankan: node scripts/ocr-perjadin-guidelines.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createWorker } from 'tesseract.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const IMAGE_DIR = path.join(ROOT, 'public', 'pedoman-perjadin');
const OUT_DIR = path.join(__dirname, 'ocr-output');
const CONTENT_PATH = path.join(__dirname, 'perjadin-guidelines-content.json');

const IMAGE_MAP = [
  { file: 'SBU Perjadin1.png', sectionId: 'sbu-dn-1', label: 'SBU Dalam Negeri — 1' },
  { file: 'SBU Perjadin2.png', sectionId: 'sbu-dn-2', label: 'SBU Dalam Negeri — 2' },
  { file: 'SBU Perjadin3.png', sectionId: 'sbu-dn-3', label: 'SBU Dalam Negeri — 3' },
  { file: 'SBU Perjadin4.png', sectionId: 'sbu-dn-4', label: 'SBU Dalam Negeri — 4' },
  { file: 'PDLN1.png', sectionId: 'pdl-1', label: 'PDLN — 1' },
  { file: 'PDLN2.png', sectionId: 'pdl-2', label: 'PDLN — 2' },
];

function normalizeLine(line) {
  return line.replace(/\s+/g, ' ').trim();
}

/** Heuristik: baris dengan banyak pemisah atau angka Rp/$ → baris tabel */
function linesToTable(lines) {
  const cleaned = lines.map(normalizeLine).filter((l) => l.length > 1);
  if (cleaned.length < 2) return null;

  const rows = [];
  for (const line of cleaned) {
    const byPipe = line.split(/\s*\|\s*/).map((c) => c.trim()).filter(Boolean);
    if (byPipe.length >= 2) {
      rows.push(byPipe);
      continue;
    }
    const byTab = line.split(/\t+/).map((c) => c.trim()).filter(Boolean);
    if (byTab.length >= 2) {
      rows.push(byTab);
      continue;
    }
    const byMultiSpace = line.split(/\s{2,}/).map((c) => c.trim()).filter(Boolean);
    if (byMultiSpace.length >= 3) {
      rows.push(byMultiSpace);
      continue;
    }
    if (/Rp[\s.]?\d|USD|\$|€|\d{3,}/i.test(line) && line.length > 8) {
      rows.push([line]);
    }
  }

  if (rows.length < 2) return null;

  const maxCols = Math.max(...rows.map((r) => r.length));
  const normalizedRows = rows.map((r) => {
    const next = [...r];
    while (next.length < maxCols) next.push('');
    return next.slice(0, maxCols);
  });

  const headerCandidate = normalizedRows[0];
  const looksLikeHeader =
    headerCandidate.some((c) => /provinsi|golongan|eselon|negara|komponen|uang|biaya|kelas/i.test(c)) ||
    headerCandidate.filter((c) => /[A-Za-z]{4,}/.test(c)).length >= Math.min(2, maxCols);

  if (looksLikeHeader && maxCols >= 2) {
    return {
      caption: 'Hasil OCR — verifikasi dengan dokumen resmi SBU',
      headers: headerCandidate.map((h, i) => (h || `Kolom ${i + 1}`)),
      rows: normalizedRows.slice(1).filter((r) => r.some((c) => c.length > 0)),
    };
  }

  return {
    caption: 'Data OCR (baris tunggal dikelompokkan)',
    headers: Array.from({ length: maxCols }, (_, i) => `Kolom ${i + 1}`),
    rows: normalizedRows.filter((r) => r.some((c) => c.length > 0)),
  };
}

function textToStructuredBlocks(text) {
  const lines = text.split(/\r?\n/).map(normalizeLine).filter(Boolean);
  const blocks = [];
  let buffer = [];

  const flushParagraph = () => {
    if (buffer.length === 0) return;
    const para = buffer.join(' ');
    if (para.length > 20) blocks.push({ type: 'paragraph', text: para });
    buffer = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isNumberedHeading = /^\d+[\.)]\s+/.test(line) || /^[A-Z][A-Z\s]{3,}$/.test(line);
    const isBullet = /^[-•*]\s+/.test(line) || /^[a-z]\)\s+/i.test(line);

    if (isNumberedHeading && line.length < 120) {
      flushParagraph();
      blocks.push({ type: 'heading', text: line.replace(/^\d+[\.)]\s+/, '') });
      continue;
    }

    if (isBullet) {
      flushParagraph();
      blocks.push({ type: 'bullet', text: line.replace(/^[-•*]\s+/, '').replace(/^[a-z]\)\s+/i, '') });
      continue;
    }

    buffer.push(line);
    if (buffer.join(' ').length > 280) flushParagraph();
  }
  flushParagraph();

  const table = linesToTable(lines);
  if (table && table.rows.length > 0) {
    blocks.push({ type: 'table', table });
  }

  return blocks;
}

function applyOcrToContent(content, ocrResults) {
  const bySection = new Map(ocrResults.map((r) => [r.sectionId, r]));

  for (const chapter of content.chapters) {
    for (const section of chapter.sections) {
      const ocr = bySection.get(section.id);
      if (!ocr) continue;

      section.ocrText = ocr.text;
      const blocks = ocr.blocks;

      const bullets = blocks.filter((b) => b.type === 'bullet').map((b) => b.text);
      const headings = blocks.filter((b) => b.type === 'heading');
      const paragraphs = blocks.filter((b) => b.type === 'paragraph');
      const tableBlock = blocks.find((b) => b.type === 'table');

      if (headings.length > 0 && !section.body) {
        section.body = paragraphs.map((p) => p.text).join('\n\n') || undefined;
      } else if (paragraphs.length > 0) {
        const extra = paragraphs.map((p) => p.text).join('\n\n');
        section.body = section.body ? `${section.body}\n\n${extra}` : extra;
      }

      if (bullets.length > 0) {
        const existing = Array.isArray(section.points) ? section.points : [];
        section.points = [...existing, ...bullets.filter((b) => !existing.includes(b))];
      }

      if (tableBlock?.table && tableBlock.table.rows.length > 0) {
        section.table = tableBlock.table;
      }

      section.callout = section.callout ?? {
        type: 'info',
        title: 'Transkrip OCR',
        body: 'Tabel/teks di bawah dihasilkan otomatis dari gambar. Silakan verifikasi dengan SBU resmi sebelum dipakai untuk pengajuan anggaran.',
      };
    }
  }

  content.meta.version = `${content.meta.version} + OCR ${new Date().toISOString().slice(0, 10)}`;
  return content;
}

async function ocrImage(worker, imagePath) {
  const { data } = await worker.recognize(imagePath);
  return data.text ?? '';
}

async function main() {
  if (!fs.existsSync(IMAGE_DIR)) {
    throw new Error(`Folder gambar tidak ditemukan: ${IMAGE_DIR}`);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log('Memuat Tesseract (ind+eng)...');
  const worker = await createWorker('ind+eng', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text') {
        process.stdout.write(`\r  ${m.status} ${Math.round((m.progress ?? 0) * 100)}%   `);
      }
    },
  });
  await worker.setParameters({
    tessedit_pageseg_mode: '6',
  });

  const ocrResults = [];

  try {
    for (const item of IMAGE_MAP) {
      const imagePath = path.join(IMAGE_DIR, item.file);
      if (!fs.existsSync(imagePath)) {
        console.warn(`Lewati (tidak ada): ${item.file}`);
        continue;
      }
      console.log(`\nOCR: ${item.file}`);
      const text = await ocrImage(worker, imagePath);
      const blocks = textToStructuredBlocks(text);

      const baseName = item.file.replace(/\.png$/i, '');
      fs.writeFileSync(path.join(OUT_DIR, `${baseName}.txt`), text, 'utf8');
      fs.writeFileSync(path.join(OUT_DIR, `${baseName}.json`), JSON.stringify(blocks, null, 2), 'utf8');

      ocrResults.push({
        sectionId: item.sectionId,
        label: item.label,
        file: item.file,
        text,
        blocks,
      });
      console.log(`  → ${text.length} karakter, ${blocks.length} blok`);
    }
  } finally {
    await worker.terminate();
  }

  fs.writeFileSync(path.join(OUT_DIR, 'all-ocr-results.json'), JSON.stringify(ocrResults, null, 2), 'utf8');

  const content = JSON.parse(fs.readFileSync(CONTENT_PATH, 'utf8'));
  const updated = applyOcrToContent(content, ocrResults);
  fs.writeFileSync(CONTENT_PATH, JSON.stringify(updated, null, 2) + '\n', 'utf8');

  console.log('\nSelesai.');
  console.log(`- Teks mentah: scripts/ocr-output/*.txt`);
  console.log(`- JSON pedoman diperbarui: ${CONTENT_PATH}`);
  console.log('Jalankan: npm run db:seed-perjadin-guidelines');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
