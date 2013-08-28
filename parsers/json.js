'use strict';

/**
 * Message encoder.
 *
 * @param {Mixed} data The data that needs to be transformed in to a string.
 * @param {Function} fn Completion callback.
 * @api public
 */
exports.encoder = function encoder(data, fn) {
  var err;

  try { data = JSON.stringify(data); }
  catch (e) { err = e; }

  fn(err, data);
};

/**
 * Message encoder.
 *
 * @param {Mixed} data The data that needs to be transformed in to a string.
 * @param {Function} fn Completion callback.
 * @api public
 */
exports.decoder = function decoder(data, fn) {
  var err;

  try { data = JSON.parse(data); }
  catch (e) { err = e; }

  fn(err, data);
};
