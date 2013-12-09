'use strict';

var querystring = require('querystring').parse
  , url = require('url').parse;

//
// Used to fake middleware's as we don't have a next callback.
//
function noop() {}

/**
 * Transformer skeletons
 *
 * @constructor
 * @param {Primus} primus Reference to the Primus.
 * @api public
 */
function Transformer(primus) {
  this.Spark = primus.Spark;    // Used by the Server to create a new connection.
  this.primus = primus;         // Reference to the Primus instance.
  this.primusjs = null;         // Path to the client library.
  this.specfile = null;         // Path to the Primus specification.
  this.service = null;          // Stores the real-time service.
  this.buffer = null;           // Buffer of the library.

  this.initialise();
}

Transformer.prototype.__proto__ = require('events').EventEmitter.prototype;

//
// Simple logger shortcut.
//
Object.defineProperty(Transformer.prototype, 'logger', {
  get: function logger() {
    return {
      error: this.log.bind(this.primus, 'log', 'error'),  // Log error <line>.
      warn:  this.log.bind(this.primus, 'log', 'warn'),   // Log warn <line>.
      info:  this.log.bind(this.primus, 'log', 'info'),   // Log info <line>.
      debug: this.log.bind(this.primus, 'log', 'debug'),  // Log debug <line>.
      plain: this.log.bind(this.primus, 'log')            // Log x <line>.
    };
  }
});

/**
 * Simple log handler that will emit log messages under the given `type`.
 *
 * @api private
 */
Transformer.prototype.log = function log(type) {
  this.emit.apply(this, arguments);
};

/**
 * Create the server and attach the appropriate event listeners.
 *
 * @api private
 */
Transformer.prototype.initialise = function initialise() {
  if (this.server) this.server();

  var server = this.primus.server
    , transformer = this;

  server.listeners('request').map(this.on.bind(this, 'previous::request'));
  server.listeners('upgrade').map(this.on.bind(this, 'previous::upgrade'));

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

  //
  // Create a client URL, this where we respond with our library. The path to
  // the server specification which can be used to retrieve the transformer that
  // was used.
  //
  var pathname = this.primus.pathname.split('/').filter(Boolean)
    , client = pathname.slice(0)
    , spec = pathname.slice(0);

  client.push('primus.js');
  spec.push('spec');

  this.primusjs = '/'+ client.join('/');
  this.specfile = '/'+ spec.join('/');

  //
  // Listen for static requests.
  //
  this.on('static', function serve(req, res) {
    this.buffer = this.buffer || new Buffer(this.primus.library());
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
    res.end(this.buffer);
  });

  this.on('spec', function spec(req, res) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(this.primus.spec));
  });
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
  if (!this.test(req)) return this.emit('previous::request', req, res);
  if (req.uri.pathname === this.primusjs) return this.emit('static', req, res);
  if (req.uri.pathname === this.specfile) return this.emit('spec', req, res);
  if (!this.primus.auth) return this.emit('request', req, res, noop);

  var transformer = this;
  this.primus.auth(req, function authorized(err) {
    if (!err) return transformer.emit('request', req, res, noop);

    res.statusCode = err.statusCode || 401;
    res.setHeader('Content-Type', 'application/json');

    if ((res.statusCode === 401) && err.authenticate) {
      res.setHeader('WWW-Authenticate', err.authenticate);
    }

    res.end(JSON.stringify({ error: err.message || err }));
  });
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
  //
  // Copy buffer to prevent large buffer retention in Node core.
  // @see jmatthewsr-ms/node-slab-memory-issues
  //
  var buffy = new Buffer(head.length);
  head.copy(buffy);

  if (!this.test(req)) return this.emit('previous::upgrade', req, socket, buffy);
  if (!this.primus.auth) return this.emit('upgrade', req, socket, buffy, noop);

  var transformer = this;
  this.primus.auth(req, function authorized(err) {
    if (!err) return transformer.emit('upgrade', req, socket, buffy, noop);

    var message = JSON.stringify({ error: err.message || err });
    var code = err.statusCode || 401;

    socket.write('HTTP/' + req.httpVersion + ' ');
    socket.write(code + ' ' + require('http').STATUS_CODES[code] + '\r\n');
    socket.write('Connection: close\r\n');
    socket.write('Content-Type: application/json\r\n');
    socket.write('Content-Length: ' + message.length + '\r\n');

    if ((code === 401) && err.authenticate) {
      socket.write('WWW-Authenticate: ' + err.authenticate + '\r\n');
    }

    socket.write('\r\n');
    socket.write(message);
    socket.destroy();
  });
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

  var pathname = req.uri.pathname || '/'
    , route = this.primus.pathname
    , accepted = pathname.slice(0, route.length) === route;

  if (!accepted) this.emit('unknown', req);

  //
  // Make sure that the first part of the path matches.
  //
  return accepted;
};

//
// Make the transporter extendable.
//
Transformer.extend = require('extendable');

//
// Expose the transformer's skeleton.
//
module.exports = Transformer;
