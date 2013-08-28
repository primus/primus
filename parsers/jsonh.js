'use strict';

var JSONH = require('jsonh');

/**
 * Message encoder.
 *
 * @param {Mixed} data The data that needs to be transformed in to a string.
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
 * Message encoder.
 *
 * @param {Mixed} data The data that needs to be transformed in to a string.
 * @param {Function} fn Completion callback.
 * @api public
 */
exports.decoder = function decoder(data, fn) {
  var err;

  try { data = JSONH.parse(data); }
  catch (e) { err = e; }

  fn(err, data);
};

//
// Expose the library so it can be added in our Primus module.
//
exports.library = require('fs').readFileSync(require.resolve('jsonh'), 'utf-8');
