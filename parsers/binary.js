'use strict';

var BinaryPack = require('binarypack')
  , fs = require('fs');

/**
 * Message encoder.
 *
 * @param {Mixed} data The data that needs to be transformed in to a string.
 * @param {Function} fn Completion callback.
 * @api public
 */
exports.encoder = function encoder(data, fn) {
  try { fn(undefined, BinaryPack.pack(data)); }
  catch (e) { fn(e); }
};

/**
 * Message encoder.
 *
 * @param {Mixed} data The data that needs to be transformed in to a string.
 * @param {Function} fn Completion callback.
 * @api public
 */
exports.decoder = function decoder(data, fn) {
  try { fn(undefined, BinaryPack.unpack(data)); }
  catch (e) { fn(e); }
};

//
// Expose the library so it can be added in our Primus module.
//
exports.library = [
  'var BinaryPack = (function () {',
  '  try { return require("binarypack"); }',
  '  catch (e) {}',
  fs.readFileSync(require.resolve('js-binarypack'), 'utf-8'),
  '})();'
].join('\n');
