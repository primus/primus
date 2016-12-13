'use strict';

const remove = require('rocambole-node-remove');
const rocambole = require('rocambole');
const through = require('through2');

/**
 * Browserify transform to remove all debug statements.
 *
 * @param {String} file File name
 * @returns {Stream} Transform stream
 * @public
 */
function stripify(file) {
  if (/\.json$/.test(file)) return through();

  let code = '';

  function transform(chunk, encoding, next) {
    code += chunk;
    next();
  }

  function flush(done) {
    const ast = rocambole.parse(code);

    code = rocambole.moonwalk(ast, function strip(node) {
      if (( // var debug = ...;
          'VariableDeclaration' === node.type
        && 'debug' === node.declarations[0].id.name
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

module.exports = stripify;
