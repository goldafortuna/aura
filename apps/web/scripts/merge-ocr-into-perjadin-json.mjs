/* eslint-disable no-console */
/**
 * Gabungkan hasil OCR (scripts/ocr-output/*.txt) ke perjadin-guidelines-content.json
 * tanpa menjalankan ulang OCR.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, 'ocr-output');
const CONTENT_PATH = path.join(__dirname, 'perjadin-guidelines-content.json');

const SECTION_FILES = {
  'sbu-dn-1': 'SBU Perjadin1.txt',
  'sbu-dn-2': 'SBU Perjadin2.txt',
  'sbu-dn-3': 'SBU Perjadin3.txt',
  'sbu-dn-4': 'SBU Perjadin4.txt',
  'pdl-1': 'PDLN1.txt',
  'pdl-2': 'PDLN2.txt',
};

function readOcr(name) {
  const p = path.join(OUT_DIR, name);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
}

function normalizeAmount(raw) {
  return raw.replace(/[\]|}\)]/g, '').trim();
}

/** Baris jabatan + 2–4 nominal (tiket, harian, penginapan, representasi) */
function parseSbuTarifRows(text) {
  const rows = [];
  let blockLabel = '';
  let jabatanCategory = '';

  const lines = text.split(/\r?\n/).map((l) => l.replace(/\|/g, ' ').trim()).filter(Boolean);

  for (const line of lines) {
    if (/halaman \d+ dari/i.test(line) || /ditandatangani secara elektronik/i.test(line)) continue;
    if (/^PERJALANAN/i.test(line.replace(/\s/g, ''))) continue;

    const amounts = [...line.matchAll(/\d{1,3}(?:\.\d{3})+/g)].map((m) => normalizeAmount(m[0]));
    if (amounts.length >= 2) {
      const firstIdx = line.search(/\d{1,3}(?:\.\d{3})+/);
      let jabatan = line.slice(0, firstIdx).replace(/[\[\]{}|~]/g, '').trim();
      jabatan = jabatan.replace(/\s+/g, ' ');
      if (!jabatan) continue;
      rows.push({
        blok: blockLabel || undefined,
        kategoriJabatan: jabatanCategory || undefined,
        jabatan,
        tiketPesawat: amounts[0] ?? '',
        uangHarian: amounts[1] ?? '',
        penginapan: amounts[2] ?? '',
        representasi: amounts[3] ?? '',
      });
      continue;
    }

    if (/^(Utama|Madya|Pratama)\b/i.test(line)) {
      jabatanCategory = line;
      continue;
    }
    if (/Jabatan (Non-)?Manajerial/i.test(line) || /Jenjang Eksekutif/i.test(line)) {
      blockLabel = line;
      continue;
    }
    if (/^[A-Z]{2,}\s+[A-Z]{2,}/.test(line) && line.length < 40 && !/\d/.test(line)) {
      blockLabel = line;
    }
  }

  return rows;
}

function sbuRowsToTable(rows) {
  if (rows.length === 0) return null;
  return {
    caption: 'Tarif SBU hasil OCR — verifikasi dengan dokumen resmi',
    headers: ['Blok / Kategori', 'Jabatan', 'Tiket', 'Uang Harian', 'Penginapan', 'Representasi'],
    rows: rows.map((r) => [
      [r.blok, r.kategoriJabatan].filter(Boolean).join(' · ') || '—',
      r.jabatan,
      r.tiketPesawat,
      r.uangHarian,
      r.penginapan || '—',
      r.representasi || '—',
    ]),
  };
}

/** Pasal bernomor dari dokumen ketentuan (SBU3, SBU4, PDLN) */
function parseNumberedKetentuan(text) {
  const items = [];
  let current = null;

  const flush = () => {
    if (!current) return;
    const body = current.parts.join(' ').replace(/\s+/g, ' ').trim();
    if (body.length >= 15) items.push({ no: current.no, text: body });
    current = null;
  };

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/~~\]?/g, '').trim();
    if (!line || /halaman \d+ dari/i.test(line) || /ditandatangani secara elektronik/i.test(line)) continue;

    const startMatch = line.match(/^[\[\|\s]*(\d{1,2})\s*[\|J\.]\s*(.*)$/);
    if (startMatch) {
      flush();
      current = { no: startMatch[1], parts: [startMatch[2].replace(/^\s*J\s*/i, '').trim()] };
      continue;
    }

    if (current) {
      const cont = line.replace(/^[\[\|]+\s*/, '').trim();
      if (cont) current.parts.push(cont);
    }
  }
  flush();

  return items;
}

function ketentuanToSections(items) {
  const points = items.map((it) => `${it.no}. ${it.text}`);
  return { points, count: items.length };
}

function findSection(content, sectionId) {
  for (const chapter of content.chapters) {
    const section = chapter.sections.find((s) => s.id === sectionId);
    if (section) return section;
  }
  return null;
}

function applyToSection(section, text, kind) {
  section.ocrText = text.trim();

  if (kind === 'sbu-table') {
    const rows = parseSbuTarifRows(text);
    const table = sbuRowsToTable(rows);
    section.body =
      'Ringkasan tarif perjadin dari tabel SBU (OCR). Untuk angka pasti per zona/kota, lihat juga lampiran gambar di bawah.';
    section.points = undefined;
    if (table) section.table = table;
    section.sbuTarifRows = rows;
    return;
  }

  if (kind === 'ketentuan') {
    const items = parseNumberedKetentuan(text);
    const { points } = ketentuanToSections(items);
    section.body =
      items.length > 0
        ? `Berikut ${items.length} butir ketentuan hasil transkrip OCR. Verifikasi dengan PDF SBU resmi.`
        : 'Ketentuan dari dokumen resmi — lihat lampiran gambar.';
    section.points = points.length > 0 ? points : undefined;
    section.table = undefined;
    section.sbuTarifRows = undefined;
    return;
  }
}

function main() {
  const content = JSON.parse(fs.readFileSync(CONTENT_PATH, 'utf8'));

  applyToSection(findSection(content, 'sbu-dn-1'), readOcr(SECTION_FILES['sbu-dn-1']), 'sbu-table');
  applyToSection(findSection(content, 'sbu-dn-2'), readOcr(SECTION_FILES['sbu-dn-2']), 'sbu-table');
  const s3 = findSection(content, 'sbu-dn-3');
  if (s3) s3.heading = 'Penjelasan perjadin dalam negeri';
  applyToSection(s3, readOcr(SECTION_FILES['sbu-dn-3']), 'ketentuan');
  applyToSection(findSection(content, 'sbu-dn-4'), readOcr(SECTION_FILES['sbu-dn-4']), 'ketentuan');
  applyToSection(findSection(content, 'pdl-1'), readOcr(SECTION_FILES['pdl-1']), 'ketentuan');
  applyToSection(findSection(content, 'pdl-2'), readOcr(SECTION_FILES['pdl-2']), 'ketentuan');

  for (const chapter of content.chapters) {
    for (const section of chapter.sections) {
      if (section.ocrText || section.table || section.points?.length) {
        section.callout = {
          type: 'info',
          title: 'Transkrip OCR',
          body: 'Data teks/tabel dihasilkan otomatis dari screenshot SBU. Selalu cocokkan dengan dokumen resmi sebelum dipakai untuk pengajuan.',
        };
      }
    }
  }

  const baseVersion = 'SBU Universitas — OCR terstruktur';
  content.meta.version = `${baseVersion} (${new Date().toISOString().slice(0, 10)})`;

  fs.writeFileSync(CONTENT_PATH, JSON.stringify(content, null, 2) + '\n', 'utf8');
  console.log('JSON diperbarui:', CONTENT_PATH);

  console.log(`sbu-dn-1: ${findSection(content, 'sbu-dn-1')?.sbuTarifRows?.length ?? 0} baris tarif`);
  console.log(`sbu-dn-3: ${s3?.points?.length ?? 0} butir ketentuan`);
}

main();
