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
  try { fn(undefined, JSONH.stringify(data)); }
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
  try { fn(undefined, JSONH.parse(data)); }
  catch (e) { fn(e); }
};

//
// Expose the library so it can be added in our primus module.
//
exports.library = require('fs').readFileSync(require.resolve('jsonh'), 'utf-8');
