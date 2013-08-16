'use strict';

var EJSON = require('e-json');

/**
 * Message encoder.
 *
 * @param {Mixed} data The data that needs to be transformed in to a string.
 * @param {Function} fn Completion callback.
 * @api public
 */
exports.encoder = function encoder(data, fn) {
  try { fn(undefined, EJSON.stringify(data)); }
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
  try { fn(undefined, EJSON.parse(data)); }
  catch (e) { fn(e); }
};

//
// Expose the library so it can be added in our Primus module.
//
exports.library = EJSON.source;
