'use strict';

const msgpack = require('primus-msgpack');

/**
 * Message encoder.
 *
 * @param {Mixed} data The data that needs to be transformed.
 * @param {Function} fn Completion callback.
 * @api public
 */
exports.encoder = function encoder(data, fn) {
  var err;

  try { data = msgpack.encode(data); }
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

  try {
    data = msgpack.decode(data instanceof ArrayBuffer ? new Uint8Array(data) : data);
  } catch (e) {
    err = e;
  }

  fn(err, data);
};

//
// Expose the library so it can be added in our Primus module.
//
exports.library = `var msgpack = (function () {
  var exports, mp;

  try { mp = Primus.requires('primus-msgpack'); }
  catch (e) {}

  if (mp) return mp;

  exports = {};
  ${msgpack.BrowserSource}
  return exports.msgpack;
})();
`;
