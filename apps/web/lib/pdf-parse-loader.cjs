'use strict';

/**
 * Jangan `require('pdf-parse')` — entry index.js punya blok debug berbahaya di serverless.
 * Muat lib/pdf-parse.js (bukan package main). Patch: scripts/patch-pdf-parse-debug.cjs.
 * Di Vercel, paket harus ikut outputFileTracingIncludes (next.config.js).
 */
module.exports = require('pdf-parse/lib/pdf-parse.js');
