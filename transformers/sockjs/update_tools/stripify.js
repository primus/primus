'use strict';

var remove = require('rocambole-node-remove')
  , rocambole = require('rocambole')
  , through = require('through2');

//
// Expose the function.
//
module.exports = stripify;

/**
 * Browserify transform to remove all debug statements.
 *
 * @param {String} file File name
 * @returns {Stream} Transform stream
 * @api public
 */
function stripify(file) {
  if (/\.json$/.test(file)) return through();

  var code = '';

  function transform(chunk, encoding, next) {
    code += chunk;
    next();
  }

  function flush(done) {
    /* jshint validthis: true */
    var ast = rocambole.parse(code);

    code = rocambole.moonwalk(ast, function strip(node) {
      if (( // var debug = function() {};
          'VariableDeclaration' === node.type
        && 'debug' === node.declarations[0].id.name
      ) || ( // if (process.env.NODE_ENV !== 'production') { debug = ... }
          'IfStatement' === node.type
        && 'BinaryExpression' === node.test.type
        && 'production' === node.test.right.value
      ) || ( // debug( ... );
          'ExpressionStatement' === node.type
        && 'CallExpression' === node.expression.type
        && 'debug' === node.expression.callee.name
      )) {
        return remove(node);
      }
    });

    this.push(code.toString());
    done();
  }

  return through(transform, flush);
}
