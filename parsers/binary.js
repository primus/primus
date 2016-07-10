'use strict';

const BinaryPack = require('binary-pack');

/**
 * Message encoder.
 *
 * @param {Mixed} data The data that needs to be transformed.
 * @param {Function} fn Completion callback.
 * @api public
 */
exports.encoder = function encoder(data, fn) {
  var err;

  try { data = BinaryPack.pack(data); }
  catch (e) { err = e; }

  fn(err, data);
};

/**
 * Message decoder.
 *
 * @param {Mixed} data The data that needs to be transformed.
 * @param {Function} fn Completion callback.
 * @api public
 */
exports.decoder = function decoder(data, fn) {
  var err;

  try { data = BinaryPack.unpack(data); }
  catch (e) { err = e; }

  fn(err, data);
};

//
// Expose the library so it can be added in our Primus module.
//
exports.library = `var BinaryPack = (function () {
  var exports, bp;

  try { bp = Primus.requires('binary-pack'); }
  catch (e) {}

  if (bp) return bp;

  exports = {};
  (function () {
    ${BinaryPack.BrowserSource}
  }).call(exports);
  return exports.BinaryPack;
})();
`;
