'use strict';

/**
 * Jangan `require('pdf-parse')` — entry index.js punya blok debug berbahaya di serverless.
 * Muat implementasi lewat path absolut ke lib/pdf-parse.js (bukan package main).
 * Patch npm: scripts/patch-pdf-parse-debug.cjs (postinstall + sebelum build).
 */
const { createRequire } = require('module');

const requireFromHere = createRequire(__filename);
const implPath = requireFromHere.resolve('pdf-parse/lib/pdf-parse.js');

module.exports = requireFromHere(implPath);
