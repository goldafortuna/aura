'use strict';

/**
 * pdf-parse@1.1.1 index.js memakai `let isDebugMode = !module.parent` yang di serverless/Vercel
 * sering salah true (module.parent undefined), lalu fs.readFileSync('./test/data/...') → ENOENT.
 * Ganti dengan guard standar Node: hanya debug saat file ini dieksekusi sebagai entry (`node index.js`).
 */
const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '..', 'node_modules', 'pdf-parse', 'index.js');
if (!fs.existsSync(indexPath)) {
  console.warn('[patch-pdf-parse-debug] skip: pdf-parse tidak terpasang');
  process.exit(0);
}

let src = fs.readFileSync(indexPath, 'utf8');
const needle = 'let isDebugMode = !module.parent;';
const replacement = 'let isDebugMode = typeof require !== "undefined" && require.main === module;';

if (src.includes(replacement)) {
  console.log('[patch-pdf-parse-debug] sudah diterapkan');
  process.exit(0);
}

if (!src.includes(needle)) {
  console.warn('[patch-pdf-parse-debug] pola tidak dikenali — lewati (cek versi pdf-parse)');
  process.exit(0);
}

fs.writeFileSync(indexPath, src.replace(needle, replacement), 'utf8');
console.log('[patch-pdf-parse-debug] pdf-parse index.js diperbaiki (debug guard aman)');
