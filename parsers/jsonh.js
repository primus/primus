'use strict';

var JSONH = require('jsonh');

/**
 * Message encoder.
 *
 * @param {Mixed} data The data that needs to be transformed into a string.
 * @param {Function} fn Completion callback.
 * @api public
 */
exports.encoder = function encoder(data, fn) {
  var err;

  try { data = JSONH.stringify(data); }
  catch (e) { err = e; }

  fn(err, data);
};

/**
 * Message decoder.
 *
 * @param {Mixed} data The data that needs to be parsed from a string.
 * @param {Function} fn Completion callback.
 * @api public
 */
exports.decoder = function decoder(data, fn) {
  var err;

  if ('string' !== typeof data) return fn(err, data);

  try { data = JSONH.parse(data); }
  catch (e) { err = e; }

  fn(err, data);
};

//
// Expose the library so it can be added in our Primus module.
//
exports.library = require('fs').readFileSync(require.resolve('jsonh'), 'utf-8');
