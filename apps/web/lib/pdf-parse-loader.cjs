'use strict';

/**
 * Jangan `require('pdf-parse')` — entry index.js punya blok debug berbahaya di serverless.
 * Pakai implementasi di lib/. Patch npm: scripts/patch-pdf-parse-debug.cjs (postinstall).
 */
module.exports = require('pdf-parse/lib/pdf-parse.js');
