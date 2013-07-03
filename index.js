'use strict';

var Transformer = require('./transformer')
  , Spark = require('./spark');

/**
 * Primus is a universal wrapper for real-time frameworks that provides a common
 * interface for server and client interaction.
 *
 * @constructor
 * @param {HTTP.Server} server HTTP or HTTPS server instance.
 * @param {Object} options Configuration
 * @api public
 */
function Primus(server, options) {
  if (!(this instanceof Primus)) return new Primus(server, options);

  options = options || {};

  this.transformer = null;                // Reference to the real-time engine instance.
  this.encoder = null;                    // Shorthand to the parser's encoder.
  this.decoder = null;                    // Shorthand to the parser's decoder.
  this.sparks = 0;                        // Increment id for connection ids
  this.connected = 0;                     // Connection counter;
  this.connections = Object.create(null); // Connection storage.

  this.server = server;
  this.pathname = options.pathname || '/primus';

  this.parsers(options.parser);
  this.Spark = Spark.bind(Spark, this);
  this.initialise(options.transformer || options.transport);
}

Primus.prototype.__proto__ = require('events').EventEmitter.prototype;

//
// Lazy read the primus.js JavaScript client.
//
Object.defineProperty(Primus.prototype, 'client', {
  get: function read() {
    return require('fs').readFileSync(__dirname + '/primus.js', 'utf-8');
  }
});

//
// Lazy compile the primus.js JavaScript client for Node.js
//
Object.defineProperty(Primus.prototype, 'Socket', {
  get: function () {
    return require('load').compiler(this.library(true), 'primus.js');
  }
});

//
// Expose the current version number.
//
Primus.prototype.version = require('./package.json').version;

/**
 * Initialise the real-time transport that was chosen.
 *
 * @param {Mixed} Transformer The name of the transformer or a constructor;
 * @api private
 */
Primus.prototype.initialise = function initialise(Transformer) {
  Transformer = Transformer || 'websockets';

  if ('string' === typeof Transformer) {
    Transformer = require('./transformers/'+ Transformer.toLowerCase());
  }

  if ('function' !== typeof Transformer) {
    throw new Error('The given transformer is not a constructor');
  }

  this.transformer = new Transformer(this);

  this.on('connection', function connection(stream) {
    this.connected++;
    this.connections[stream.id] = stream;
  });

  this.on('disconnection', function disconnected(stream) {
    this.connected--;
    delete this.connections[stream.id];
  });
};

/**
 * Iterate over the connections.
 *
 * @param {Function} fn The function that is called every iteration.
 * @api public
 */
Primus.prototype.forEach = function forEach(fn) {
  for (var stream in this.connections) {
    fn(this.connections[stream], stream, this.connections);
  }

  return this;
};

/**
 * Install message parsers.
 *
 * @param {Mixed} parser Parse name or parser Object.
 * @api private
 */
Primus.prototype.parsers = function parsers(parser) {
  parser = parser || 'json';

  if ('string' === typeof parser) {
    parser = require('./parsers/'+ parser.toLowerCase());
  }

  if ('object' !== typeof parser) {
    throw new Error('The given parser is not an Object');
  }

  this.encoder = parser.encoder;
  this.decoder = parser.decoder;
  this.parser = parser;

  return this;
};

/**
 * Generate a client library.
 *
 * @param {Boolean} noframework Don't include the library.
 * @returns {String} The client library.
 * @api public
 */
Primus.prototype.library = function compile(noframework) {
  var encoder = this.encoder.client || this.encoder
    , decoder = this.decoder.client || this.decoder
    , library = this.transformer.library || ''
    , transport = this.transformer.client
    , parser = this.parser.library || '';

  //
  // Add a simple export wrapper so it can be used as Node.js, amd or browser
  // client.
  //
  var client = [
    '(function (name, context, definition) {',
    '  if (typeof module !== "undefined" && module.exports) {',
    '    module.exports = definition();',
    '  } else if (typeof define == "function" && define.amd) {',
    '    define(definition);',
    '  } else {',
    '    context[name] = definition();',
    '  }',
    '})("Primus", this, function PRIMUS() {',
    this.client
  ].join('\n');

  //
  // Replace some basic content.
  //
  client = client
    .replace('null; // @import {primus::pathname}', '"'+ this.pathname.toString() +'"')
    .replace('null; // @import {primus::version}', '"'+ this.version +'"')
    .replace('null; // @import {primus::transport}', transport.toString())
    .replace('null; // @import {primus::encoder}', encoder.toString())
    .replace('null; // @import {primus::decoder}', decoder.toString());

  //
  // Add the parser inside the closure, to prevent global leaking.
  //
  if (parser && parser.length) client += parser;

  //
  // Close the export wrapper and return the client. If we need to add
  // a library, we should add them after we've created our closure and module
  // exports. Some libraries seem to fail hard once they are wrapped in our
  // closure so I'll rather expose a global variable instead of having to monkey
  // patch to much code.
  //
  return client + ' return Primus; });' + (noframework ? '' : library);
};

//
// Expose the constructors of our Spark and Transformer so it can be extended by
// a third party if needed.
//
Primus.Transformer = Transformer;
Primus.Spark = Spark;

//
// Expose the module.
//
module.exports = Primus;
