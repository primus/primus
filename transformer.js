'use strict';

var querystring = require('querystring').parse
  , url = require('url').parse;

//
// Used to fake middleware's
//
function noop() {}

/**
 * Transformer skeletons
 *
 * @constructor
 * @param {Primus} primus Reference to the primus
 * @api public
 */
function Transformer(primus) {
  this.Spark = primus.Spark;
  this.primus = primus;
  this.service = null;

  this.initialise();
}

Transformer.prototype.__proto__ = require('events').EventEmitter.prototype;

/**
 * Create the server and attach the apropriate event listeners.
 *
 * @api private
 */
Transformer.prototype.initialise = function initialise() {
  if (this.server) this.server();

  //
  // Start listening for incoming requests if we have a listener assigned to us.
  //
  if (this.listeners('request').length) {
    this.primus.server.on('request', this.request.bind(this));
  }

  if (this.listeners('upgrade').length) {
    this.primus.server.on('upgrade', this.upgrade.bind(this));
  }
};

/**
 * Start listening for incoming requests and check if we need to forward them to
 * the transformers.
 *
 * @param {Request} req HTTP request.
 * @param {Response} res HTTP response.
 * @api private
 */
Transformer.prototype.request = function request(req, res) {
  if (!this.test(req)) return;

  this.emit('request', req, res, noop);
};

/**
 * Starting listening for incoming upgrade requests and check if we need to
 * forward them to the transformers.
 *
 * @param {Request} req HTTP request.
 * @param {Socket} socket Socket.
 * @param {Buffer} head Buffered data.
 * @api private
 */
Transformer.prototype.upgrade = function upgrade(req, socket, head) {
  if (!this.test(req)) return socket.end();

  //
  // Copy buffer to prevent large buffer retention in Node core.
  // @see jmatthewsr-ms/node-slab-memory-issues
  //
  var buffy = new Buffer(head.length);
  head.copy(upgrade);

  this.emit('upgrade', req, socket, buffy, noop);
};

/**
 * Check if we should accept this request.
 *
 * @param {Request} req HTTP Request.
 * @returns {Boolean} Do we need to accept this request.
 * @api private
 */
Transformer.prototype.test = function test(req) {
  req.uri = url(req.url);

  //
  // Make sure that the first part of the path matches.
  //
  return req.uri.pathname.slice(0, this.primus.pathname.length) === this.primus.pathname;
};

//
// Make the transporter extendable.
//
Transformer.extend = require('extendable');

//
// Expose the transformer's skeleton.
//
module.exports = Transformer;
