'use strict';

var ParserError = require('./errors').ParserError
  , parse = require('querystring').parse
  , forwarded = require('./forwarded')
  , u2028 = /\u2028/g
  , u2029 = /\u2029/g;

/**
 * The Spark is an indefinable, indescribable energy or soul of a transformer
 * which can be used to create new transformers. In our case, it's a simple
 * wrapping interface.
 *
 * @constructor
 * @param {Primus} primus Reference to the Primus server. (Set using .bind)
 * @param {Object} headers The request headers for this connection.
 * @param {Object} address The object that holds the remoteAddress and port.
 * @param {Object} query The query string of request.
 * @param {String} id An optional id of the socket, or we will generate one.
 * @api public
 */
function Spark(primus, headers, address, query, id) {
  this.primus = primus;         // References to the primus.
  this.headers = headers || {}; // The request headers.
  this.remote = address || {};  // The remote address location.
  this.query = query || {};     // The query string.
  this.id = id || this.uuid();  // Unique id for socket.
  this.readyState = Spark.OPEN; // The readyState of the connection.

  this.writable = true;         // Silly stream compatibility.
  this.readable = true;         // Silly stream compatibility.

  //
  // Parse our query string.
  //
  if ('string' === typeof this.query) this.query = parse(this.query);

  this.initialise();
}

Spark.prototype.__proto__ = require('stream').prototype;

//
// Internal readyState's to prevent writes against close sockets.
//
Spark.OPEN   = 1;
Spark.CLOSED = 2;

//
// Lazy parse interface for IP address information. As nobody is always
// interested in this, we're going to defer parsing until it's actually needed.
//
Object.defineProperty(Spark.prototype, 'address', {
  get: function address() {
    return forwarded(this.remote, this.headers, this.primus.whitelist);
  }
});

/**
 * Attach hooks and automatically announce a new connection.
 *
 * @api private
 */
Spark.prototype.initialise = function initialise() {
  var primus = this.primus
    , spark = this;

  //
  // We've received new data from our client, decode and emit it.
  //
  spark.on('incoming::data', function message(raw) {
    primus.decoder(raw, function decoding(err, data) {
      //
      // Do a "save" emit('error') when we fail to parse a message. We don't
      // want to throw here as listening to errors should be optional.
      //
      if (err) return new ParserError('Failed to decode incoming data: '+ err.message, spark, err);

      //
      // Handle client-side heartbeats by answering them as fast as possible.
      //
      if ('string' === typeof data && data.indexOf('primus::ping::') === 0) {
        return spark.write('primus::pong::'+ data.slice(14));
      }

      for (var i = 0, length = primus.transformers.incoming.length; i < length; i++) {
        var packet = { data: data };

        if (false === primus.transformers.incoming[i].call(spark, packet)) {
          //
          // When false is returned by an incoming transformer it means that's
          // being handled by the transformer and we should not emit the `data`
          // event.
          //
          return;
        }

        data = packet.data;
      }

      spark.emit('data', data, raw);
    });
  });

  //
  // The client has disconnected.
  //
  spark.on('incoming::end', function disconnect() {
    spark.readyState = Spark.CLOSED;
    spark.emit('end');
  });

  spark.on('incoming::error', function error(err) {
    //
    // Ensure that the error we emit is always an Error instance. There are
    // transformers that used to emit only strings. A string is not an Error.
    //
    if ('string' === typeof err) {
      err = new Error(err);
    }

    if (spark.listeners('error').length) spark.emit('error', err);
    spark.primus.emit('log', 'error', err);

    spark.end();
  });

  //
  // End is triggered by both incoming and outgoing events.
  //
  spark.on('end', function () {
    spark.removeAllListeners();
    primus.emit('disconnection', spark);
  });

  //
  // Announce a new connection.
  //
  process.nextTick(function tick() {
    primus.emit('connection', spark);
  });
};

/**
 * Generate a unique uuid.
 *
 * @returns {String} uuid.
 * @api private
 */
Spark.prototype.uuid = function uuid() {
  return Date.now() +'$'+ this.primus.sparks++;
};

/**
 * Simple emit wrapper that returns a function that emits an event once it's
 * called. This makes it easier for transports to emit specific events. The
 * scope of this function is limited as it will only emit one single argument.
 *
 * @param {String} event Name of the event that we should emit.
 * @param {Function} parser Argument parser.
 * @api public
 */
Spark.prototype.emits = function emits(event, parser) {
  var spark = this;

  return function emit(arg) {
    var data = parser ? parser.apply(spark, arguments) : arg;

    spark.emit('incoming::'+ event, data);
  };
};

/**
 * Send a new message to a given spark.
 *
 * @param {Mixed} data The data that needs to be written.
 * @returns {Boolean} Always returns true.
 * @api public
 */
Spark.prototype.write = function write(data) {
  var primus = this.primus
    , packet;

  //
  // The connection is closed, return false.
  //
  if (Spark.CLOSED === this.readyState) return false;

  for (var i = 0, length = primus.transformers.outgoing.length; i < length; i++) {
    packet = { data: data };

    if (false === primus.transformers.outgoing[i].call(this, packet)) {
      //
      // When false is returned by an incoming transformer it means that's
      // being handled by the transformer and we should not emit the `data`
      // event.
      //
      return;
    }

    data = packet.data;
  }

  this._write(data);
  return true;
};

/**
 * The actual message writer.
 *
 * @param {Mixed} data The message that needs to be written.
 * @api private
 */
Spark.prototype._write = function _write(data) {
  var primus = this.primus
    , spark = this;

  //
  // The connection is closed, normally this would already be done in the
  // `spark.write` method, but as `_write` is used internally, we should also
  // add the same check here to prevent potential crashes by writing to a dead
  // socket.
  //
  if (Spark.CLOSED === spark.readyState) return false;

  primus.encoder(data, function encoded(err, packet) {
    //
    // Do a "save" emit('error') when we fail to parse a message. We don't
    // want to throw here as listening to errors should be optional.
    //
    if (err) return new ParserError('Failed to encode outgoing data: '+ err.message, spark, err);
    if (!packet) return;

    //
    // Hack 1: \u2028 and \u2029 are allowed inside string in JSON. But JavaScript
    // defines them as newline separators. Because no literal newlines are allowed
    // in a string this causes a ParseError. We work around this issue by replacing
    // these characters with a properly escaped version for those chars. This can
    // cause errors with JSONP requests or if the string is just evaluated.
    //
    if ('string' === typeof packet) {
      if (~packet.indexOf('\u2028')) packet = packet.replace(u2028, '\\u2028');
      if (~packet.indexOf('\u2029')) packet = packet.replace(u2029, '\\u2029');
    }

    spark.emit('outgoing::data', packet);
  });
};

/**
 * End the connection.
 *
 * @param {Mixed} data Optional closing data.
 * @api public
 */
Spark.prototype.end = function end(data) {
  var spark = this;

  if (data) spark.write(data);

  //
  // Bypass the .write method as this message should not be transformed.
  //
  spark._write('primus::server::close');
  spark.readyState = Spark.CLOSED;

  process.nextTick(function tick() {
    spark.emit('outgoing::end');
    spark.emit('end');
  });
};

//
// Expose the module.
//
module.exports = Spark;
