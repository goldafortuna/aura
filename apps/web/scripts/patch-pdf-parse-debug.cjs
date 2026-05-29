'use strict';

/**
 * pdf-parse@1.1.1 index.js memakai `let isDebugMode = !module.parent` yang di serverless/Vercel
 * sering salah true (module.parent undefined), lalu fs.readFileSync('./test/data/...') → ENOENT.
 * Matikan selalu — implementasi aman ada di lib/pdf-parse.js (lihat lib/pdf-parse-loader.cjs).
 */
const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '..', 'node_modules', 'pdf-parse', 'index.js');
const patchedLine = 'let isDebugMode = false; /* secretary: disable pdf-parse test harness */';

if (!fs.existsSync(indexPath)) {
  console.warn('[patch-pdf-parse-debug] skip: pdf-parse tidak terpasang');
  process.exit(0);
}

let src = fs.readFileSync(indexPath, 'utf8');

if (src.includes(patchedLine)) {
  console.log('[patch-pdf-parse-debug] sudah diterapkan');
  process.exit(0);
}

const patterns = [
  'let isDebugMode = !module.parent;',
  'let isDebugMode = typeof require !== "undefined" && require.main === module;',
];

let replaced = false;
for (const pattern of patterns) {
  if (src.includes(pattern)) {
    src = src.replace(pattern, patchedLine);
    replaced = true;
    break;
  }
}

if (!replaced) {
  console.warn('[patch-pdf-parse-debug] pola isDebugMode tidak dikenali — lewati (cek versi pdf-parse)');
  process.exit(0);
}

fs.writeFileSync(indexPath, src, 'utf8');
console.log('[patch-pdf-parse-debug] pdf-parse index.js diperbaiki (debug dimatikan)');
