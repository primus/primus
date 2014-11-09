'use strict';

var split = require('binary-split')
  , through = require('through2')
  , pumpify = require('pumpify')
  , regex = /^\s+$/;

//
// Expose the function.
//
module.exports = condenseify;

/**
 * Browserify transform to condense multiple blank lines
 * into a single blank line.
 *
 * @param {String} file File name
 * @returns {Stream} Transform stream
 * @api public
 */
function condenseify(file) {
  if (/\.json$/.test(file)) return through();

  var isBlank = false;

  function transform(line, encoding, next) {
    /* jshint validthis: true */
    if (!line.length) {
      isBlank = true;
      return next();
    }

    line = line.toString();
    if (regex.test(line)) return next();

    if (isBlank) {
      isBlank = false;
      this.push('\n');
    }
    this.push(line +'\n');
    next();
  }

  return pumpify(split(), through(transform));
}
