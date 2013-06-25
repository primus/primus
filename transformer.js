'use strict';

/**
 * Transformer skeletons
 *
 * @constructor
 * @param {Primus} primus Reference to the primus
 * @api public
 */
function Transformer(primus) {
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
  this.emit('request', req, res);
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
Transformer.prototype.upgrade = function upgrade(req, res, head) {
  this.emit('upgrade');
};

//
// Make the transporter extendable.
//
Transformer.extend = require('extendable');

//
// Expose the transformer's skeleton.
//
module.exports = Transformer;
