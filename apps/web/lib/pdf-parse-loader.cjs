'use strict';

/**
 * Loader CJS murni: pakai implementasi langsung, bukan entry `pdf-parse/index.js`
 * (ada blok debug yang memanggil fs pada `./test/data/...`).
 */
module.exports = require('pdf-parse/lib/pdf-parse.js');
