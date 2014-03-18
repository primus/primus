'use strict';

var querystring = require('querystring').parse
  , EventEmitter = require('eventemitter3')
  , url = require('url').parse
  , fuse = require('fusing');

//
// Used to fake middleware's as we don't have a next callback.
//
function noop() {}

/**
 * Transformer skeletons
 *
 * @constructor
 * @param {Primus} primus Reference to the Primus instance.
 * @api public
 */
function Transformer(primus) {
  this.Spark = primus.Spark;    // Used by the Server to create a new connection.
  this.primus = primus;         // Reference to the Primus instance.
  this.service = null;          // Stores the real-time service.

  EventEmitter.call(this);
  this.initialise();
}

fuse(Transformer, EventEmitter);

//
// Simple logger shortcut.
//
Object.defineProperty(Transformer.prototype, 'logger', {
  get: function logger() {
    return {
      error: this.primus.emits('log', 'error'),  // Log error <line>.
      warn:  this.primus.emits('log', 'warn'),   // Log warn <line>.
      info:  this.primus.emits('log', 'info'),   // Log info <line>.
      debug: this.primus.emits('log', 'debug'),  // Log debug <line>.
      plain: this.primus.emits('log')            // Log x <line>.
    };
  }
});

/**
 * Create the server and attach the appropriate event listeners.
 *
 * @api private
 */
Transformer.readable('initialise', function initialise() {
  if (this.server) this.server();

  var server = this.primus.server
    , transformer = this;

  server.listeners('request').forEach(function each(fn) {
    transformer.on('previous::request', fn);
  });

  server.listeners('upgrade').forEach(function each(fn) {
    transformer.on('previous::upgrade', fn);
  });

  //
  // Remove the old listeners as we want to be the first request handler for all
  // events.
  //
  server.removeAllListeners('request');
  server.removeAllListeners('upgrade');

  //
  // Emit a close event.
  //
  server.on('close', function close() {
    transformer.emit('close');
  });

  //
  // Start listening for incoming requests if we have a listener assigned to us.
  //
  if (this.listeners('request').length || this.listeners('previous::request').length) {
    server.on('request', this.request.bind(this));
  }

  if (this.listeners('upgrade').length || this.listeners('previous::upgrade').length) {
    server.on('upgrade', this.upgrade.bind(this));
  }
});

/**
 * Iterate all the middleware layers that we're set on our Primus instance.
 *
 * @param {String} type Either `http` or `upgrade`
 * @param {Request} req HTTP request.
 * @param {Response} res HTTP response.
 * @param {Function} next Continuation callback.
 * @api private
 */
Transformer.readable('forEach', function (type, req, res, next) {
  var layers = this.primus.layers
    , primus = this.primus;

  if (!layers.length) return next();

  //
  // Async or sync call the middleware layer.
  //
  (function iterate(index) {
    var layer = layers[index++];

    if (!layer) return next();
    if (!layer.enabled || layer[type] === false) return iterate(index);

    if (layer.length === 2) {
      if (layer.fn.call(primus, req, res) === undefined) {
        return iterate(index);
      }
    } else {
      layer.fn.call(primus, req, res, function done(err) {
        if (err) return next(err);

        iterate(index);
      });
    }
  }(0));
});

/**
 * Start listening for incoming requests and check if we need to forward them to
 * the transformers.
 *
 * @param {Request} req HTTP request.
 * @param {Response} res HTTP response.
 * @api private
 */
Transformer.readable('request', function request(req, res) {
  if (!this.test(req)) return this.emit('previous::request', req, res);

  this.forEach('http', req, res, this.emits('request', req, res));
});

/**
 * Starting listening for incoming upgrade requests and check if we need to
 * forward them to the transformers.
 *
 * @param {Request} req HTTP request.
 * @param {Socket} socket Socket.
 * @param {Buffer} head Buffered data.
 * @api private
 */
Transformer.readable('upgrade', function upgrade(req, socket, head) {
  //
  // Copy buffer to prevent large buffer retention in Node core.
  // @see jmatthewsr-ms/node-slab-memory-issues
  //
  var buffy = new Buffer(head.length);
  head.copy(buffy);

  if (!this.test(req)) return this.emit('previous::upgrade', req, socket, buffy);

  this.forEach('upgrade', req, socket, this.emits('upgrade', req, socket, buffy));
});

/**
 * Check if we should accept this request.
 *
 * @param {Request} req HTTP Request.
 * @returns {Boolean} Do we need to accept this request.
 * @api private
 */
Transformer.readable('test', function test(req) {
  req.uri = url(req.url);

  var pathname = req.uri.pathname || '/'
    , route = this.primus.pathname;

  return pathname.slice(0, route.length) === route;
});

//
// Expose the transformer's skeleton.
//
module.exports = Transformer;
