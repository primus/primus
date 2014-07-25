'use strict';

var EJSON = require('ejson');

/**
 * Message encoder.
 *
 * @param {Mixed} data The data that needs to be transformed into a string.
 * @param {Function} fn Completion callback.
 * @api public
 */
exports.encoder = function encoder(data, fn) {
  var err;

  try { data = EJSON.stringify(data); }
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

  try { data = EJSON.parse(data); }
  catch (e) { err = e; }

  fn(err, data);
};

//
// Expose the library which is compiled for global consumption instead of
// browserify.
//
exports.library = require('ejson/source');
