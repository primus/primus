'use strict';

var Spark = require('./spark');

/**
 * Primus is a unversal wrapper for real-time frameworks that provides a common
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

  this.transformer = null;
  this.encoder = null;
  this.decoder = null;

  this.sparks = 0;
  this.server = server;
  this.parsers(options.parser);
  this.pathname = options.pathname || '/primus';
  this.Spark = Spark.bind(Spark, this);
  this.connections = Object.create(null);

  this.initialise(options.transformer || options.transport);
}

Primus.prototype.__proto__ = require('events').EventEmitter.prototype;

//
// Lazy read the primus.js JavaScript client.
//
Object.defineProperty(Primus.prototype, 'client', {
  get: function read() {
    return require('fs').readFileSync('./primus.js', 'utf-8');
  }
});

//
// Expose the current version number.
//
Primus.prototype.version = require('./package.json').version;

/**
 * Initialise the real-time transport that was choosen.
 *
 * @param {String} transformer The name of the transformer
 * @api private
 */
Primus.prototype.initialise = function initialise(transformer) {
  var Transformer = require('./transformers/'+ (transformer || 'websockets').toLowerCase());

  this.transformer = new Transformer(this);

  this.on('connection', function connection(stream) {
    this.connections[stream.id] = stream;
  });

  this.on('disconnected', function disconnected(stream) {
    delete this.connections[stream.id];
  });
};

/**
 * Iterate over the connections.
 *
 * @param {Function} fn
 * @api public
 */
Primus.prototype.forEach = function forEach(fn) {
  for (var stream in this.connections) {
    fn(this.connections[stream], stream);
  }

  return this;
};

/**
 * Install message parsers.
 *
 * @param {String} type Parse name.
 * @api private
 */
Primus.prototype.parsers = function parsers(type) {
  this.parser = require('./parsers/'+ (type || 'json').toLowerCase());
  this.encoder = this.parser.encoder;
  this.decoder = this.parser.decoder;
};

/**
 * Generate a front-end library.
 *
 * @returns {String} The client side library.
 * @api public
 */
Primus.prototype.library = function compile() {
  var encoder = this.encoder.client || this.encoder
    , decoder = this.decoder.client || this.decoder
    , library = this.transformer.library || ''
    , transport = this.transformer.client
    , parser = this.parser.library || ''
    , client = this.client;

  //
  // Replace some basic content.
  //
  client = client
    .replace('= null; // @import {primus::pathname}', this.pathname.toString())
    .replace('= null; // @import {primus::version}', '"'+ this.version +'"')
    .replace('= null; // @import {primus::transport}', transport.toString())
    .replace('= null; // @import {primus::encoder}', encoder.toString())
    .replace('= null; // @import {primus::decoder}', decoder.toString())
    .replace('/* {primus::library} */', library.toString())
    .replace('/* {primus::parser} */', parser.toString());

  return client;
};

//
// Expose the module.
//
module.exports = Primus;
