'use strict';

var log = require('diagnostics')('primus:transformer')
  , middlewareError = require('./middleware/error')
  , url = require('url').parse
  , Ultron = require('ultron')
  , fuse = require('fusing');

/**
 * Transformer skeleton
 *
 * @constructor
 * @param {Primus} primus Reference to the Primus instance.
 * @api public
 */
function Transformer(primus) {
  this.fuse();

  this.ultron = new Ultron(primus.server);  // Handles listeners with ease.
  this.Spark = primus.Spark;                // Reference to the Spark constructor.
  this.primus = primus;                     // Reference to the Primus instance.
  this.service = null;                      // Stores the real-time service.

  this.initialise();
}

fuse(Transformer, require('eventemitter3'));

//
// Simple logger shortcut.
//
Object.defineProperty(Transformer.prototype, 'logger', {
  get: function logger() {
    return {
      error: this.primus.emits('log', 'error'), // Log error <line>.
      warn:  this.primus.emits('log', 'warn'),  // Log warn <line>.
      info:  this.primus.emits('log', 'info'),  // Log info <line>.
      debug: this.primus.emits('log', 'debug'), // Log debug <line>.
      log:   this.primus.emits('log', 'log'),   // Log log <line>.
      plain: this.primus.emits('log', 'log')    // Log log <line>.
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
    log('found existing request handlers on the HTTP server, moving Primus as first');
    transformer.on('previous::request', fn, server);
  });

  server.listeners('upgrade').forEach(function each(fn) {
    log('found existing upgrade handlers on the HTTP server, moving Primus as first');
    transformer.on('previous::upgrade', fn, server);
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
  this.ultron.on('close', function close() {
    log('the HTTP server is closing');
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
Transformer.readable('forEach', function forEach(type, req, res, next) {
  var transformer = this
    , layers = transformer.primus.layers
    , primus = transformer.primus;

  req.query = req.uri.query || {};

  //
  // Add some silly HTTP properties for connect.js compatibility.
  //
  req.originalUrl = req.url;

  if (!layers.length) {
    next();
    return transformer;
  }

  //
  // Async or sync call the middleware layer.
  //
  (function iterate(index) {
    var layer = layers[index++];

    if (!layer) return next();
    if (!layer.enabled || layer.fn[type] === false) return iterate(index);

    if (layer.length === 2) {
      log('executing middleware (%s) synchronously', layer.name);

      if (layer.fn.call(primus, req, res)) return;
      return iterate(index);
    }

    log('executing middleware (%s) asynchronously', layer.name);
    layer.fn.call(primus, req, res, function done(err) {
      if (err) return middlewareError(err, req, res);

      iterate(index);
    });
  }(0));

  return transformer;
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

  req.headers['primus::req::backup'] = req;
  res.once('end', function gc() {
    delete req.headers['primus::req::backup'];
  });

  //
  // I want to see you're face when you're looking at the lines of code above
  // while you think, WTF what is this shit, you mad bro!? Let me take a moment
  // to explain this mad and sadness.
  //
  // There are some real-time transformers that do not give us access to the
  // HTTP request that initiated their `socket` connection. They only give us
  // access to the information that they think is useful, we're greedy, we want
  // everything and let developers decide what they want to use instead and
  // therefor want to expose this HTTP request on our `spark` object.
  //
  // The reason it's added to the headers is because it's currently the only
  // field that is accessible through all transformers.
  //

  log('handling HTTP request for url: %s', req.url);
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
  if (!this.test(req)) return this.emit('previous::upgrade', req, socket, head);

  //
  // Copy buffer to prevent large buffer retention in Node core.
  // @see jmatthewsr-ms/node-slab-memory-issues
  //
  var buffy = new Buffer(head.length);
  head.copy(buffy);

  //
  // See Transformer#request for an explanation of this madness.
  //
  req.headers['primus::req::backup'] = req;
  socket.once('end', function gc() {
    delete req.headers['primus::req::backup'];
  });

  log('handling HTTP upgrade for url: %s', req.url);
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
  req.uri = url(req.url, true);

  var pathname = req.uri.pathname || '/'
    , route = this.primus.pathname;

  return pathname.slice(0, route.length) === route;
});

//
// Expose the transformer's skeleton.
//
module.exports = Transformer;
