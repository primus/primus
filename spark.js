'use strict';

var ParserError = require('./errors').ParserError
  , parse = require('querystring').parse
  , forwarded = require('forwarded-for')
  , predefine = require('predefine')
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
  var readable = predefine(this, predefine.READABLE)
    , writable = predefine(this, predefine.WRITABLE)
    , spark = this;

  readable('primus', primus);         // References to Primus.
  readable('headers', headers || {}); // The request headers.
  readable('remote', address || {});  // The remote address location.
  readable('id', id || this.uuid());  // Unique id for socket.
  readable('writable', true);         // Silly stream compatibility.
  readable('readable', true);         // Silly stream compatibility.
  writable('query', query || {});     // The query string.
  writable('timeout', null);          // Heartbeat timeout.

  //
  // Parse our query string.
  //
  if ('string' === typeof this.query) {
    this.query = parse(this.query);
  }

  this.heartbeat().__initialise.forEach(function execute(initialise) {
    initialise.call(spark);
  });
}

Spark.prototype.__proto__ = require('stream').prototype;
Spark.readable = predefine(Spark.prototype, predefine.READABLE);
Spark.writable = predefine(Spark.prototype, predefine.WRITABLE);

//
// Internal readyState's to prevent writes against close sockets.
//
Spark.OPENING = 1;    // Only here for primus.js readyState number compatibility.
Spark.CLOSED  = 2;    // The connection is closed.
Spark.OPEN    = 3;    // The connection is open.

//
// Make sure that we emit `readyState` change events when a new readyState is
// checked. This way plugins can correctly act according to this.
//
Spark.readable('readyState', {
  get: function get() {
    return this.__readyState;
  },
  set: function set(readyState) {
    if (this.__readyState === readyState) return readyState;

    this.__readyState = readyState;
    this.emit('readyStateChange');

    return readyState;
  }
}, true);

Spark.writable('__readyState', Spark.OPEN);

//
// Lazy parse interface for IP address information. As nobody is always
// interested in this, we're going to defer parsing until it's actually needed.
//
Spark.readable('address', { get: function address() {
  return forwarded(this.remote, this.headers, this.primus.whitelist);
}}, true);

/**
 * Set a timer to forcibly disconnect the spark if no data is received from the
 * client within the given timeout.
 *
 * @api private
 */
Spark.readable('heartbeat', function heartbeat() {
  clearTimeout(this.timeout);

  if ('number' !== typeof this.primus.timeout) return this;

  var spark = this;
  this.timeout = setTimeout(function timeout() {
    if (spark.readyState === Spark.CLOSED) return;

    spark.readyState = Spark.CLOSED;
    spark.emit('outgoing::end');
    spark.emit('end');
  }, this.primus.timeout);

  return this;
});

/**
 * Checks if the given event is an emitted event by Primus.
 *
 * @param {String} evt The event name.
 * @returns {Boolean}
 * @api public
 */
Spark.readable('reserved', function reserved(evt) {
  return (/^(incoming|outgoing)::/).test(evt)
  || evt in reserved.events;
});

/**
 * The actual events that are used by the Spark.
 *
 * @type {Object}
 * @api public
 */
Spark.prototype.reserved.events = {
  readyStateChange: 1,
  error: 1,
  data: 1,
  end: 1
};

/**
 * Allows for adding initialise listeners without people overriding our default
 * initializer. If they are feeling adventures and really want want to hack it
 * up, they can remove it from the __initialise array.
 *
 * @returns {Function} The last added initialise hook.
 * @api public
 */
Spark.readable('initialise', {
  get: function get() {
    return this.__initialise[this.__initialise.length - 1];
  },
  set: function set(initialise) {
    if ('function' === typeof initialise) this.__initialise.push(initialise);
  }
}, true);

/**
 * Attach hooks and automatically announce a new connection.
 *
 * @type {Array}
 * @api private
 */
Spark.readable('__initialise', [function initialise() {
  var primus = this.primus
    , spark = this;

  //
  // Prevent double initialization of the spark. If we already have an
  // `incoming::data` handler we assume that all other cases are handled as well.
  //
  if (this.listeners('incoming::data').length) return;

  //
  // We've received new data from our client, decode and emit it.
  //
  spark.on('incoming::data', function message(raw) {
    //
    // New data has arrived so we're certain that the connection is still alive,
    // so it's save to restart the heartbeat sequence.
    //
    spark.heartbeat();

    primus.decoder(raw, function decoding(err, data) {
      //
      // Do a "save" emit('error') when we fail to parse a message. We don't
      // want to throw here as listening to errors should be optional.
      //
      if (err) return new ParserError('Failed to decode incoming data: '+ err.message, spark, err);

      //
      // Handle "primus::" prefixed protocol messages.
      //
      if (spark.protocol(data)) return;

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
    if (spark.readyState === Spark.CLOSED) return;

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
  spark.on('end', function end() {
    clearTimeout(spark.timeout);
    spark.removeAllListeners();
    primus.emit('disconnection', spark);
  });

  //
  // Announce a new connection.
  //
  process.nextTick(function tick() {
    primus.emit('connection', spark);
  });
}]);

/**
 * Generate a unique UUID.
 *
 * @returns {String} UUID.
 * @api private
 */
Spark.readable('uuid', function uuid() {
  return Date.now() +'$'+ this.primus.sparks++;
});

/**
 * Really dead simple protocol parser. We simply assume that every message that
 * is prefixed with `primus::` could be used as some sort of protocol definition
 * for Primus.
 *
 * @param {String} msg The data.
 * @returns {Boolean} Is a protocol message.
 * @api private
 */
Spark.readable('protocol', function protocol(msg) {
  if (
       'string' !== typeof msg
    || msg.indexOf('primus::') !== 0
  ) return false;

  var last = msg.indexOf(':', 8)
    , value = msg.slice(last + 2);

  switch (msg.slice(8,  last)) {
    case 'ping':
      this._write('primus::pong::'+ value);
    break;

    case 'id':
      this._write('primus::id::'+ this.id);
    break;

    //
    // Unknown protocol, somebody is probably sending `primus::` prefixed
    // messages.
    //
    default:
      return false;
  }

  return true;
});

/**
 * Simple emit wrapper that returns a function that emits an event once it's
 * called. This makes it easier for transports to emit specific events. The
 * scope of this function is limited as it will only emit one single argument.
 *
 * @param {String} event Name of the event that we should emit.
 * @param {Function} parser Argument parser.
 * @api public
 */
Spark.readable('emits', function emits(event, parser) {
  var spark = this;

  return function emit(arg) {
    var data = parser ? parser.apply(spark, arguments) : arg;

    spark.emit('incoming::'+ event, data);
  };
});

/**
 * Send a new message to a given spark.
 *
 * @param {Mixed} data The data that needs to be written.
 * @returns {Boolean} Always returns true.
 * @api public
 */
Spark.readable('write', function write(data) {
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
});

/**
 * The actual message writer.
 *
 * @param {Mixed} data The message that needs to be written.
 * @api private
 */
Spark.readable('_write', function _write(data) {
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
});

/**
 * End the connection.
 *
 * Options:
 * - reconnect (boolean) Trigger client-side reconnect.
 *
 * @param {Mixed} data Optional closing data.
 * @param {Object} options End instructions.
 * @api public
 */
Spark.readable('end', function end(data, options) {
  if (Spark.CLOSED === this.readyState) return this;

  options = options || {};
  var spark = this;

  if (data) spark.write(data);

  //
  // If we want to trigger a reconnect do not send
  // `primus::server::close`, otherwise bypass the .write method
  // as this message should not be transformed.
  //
  if (!options.reconnect) spark._write('primus::server::close');

  spark.readyState = Spark.CLOSED;

  process.nextTick(function tick() {
    spark.emit('outgoing::end');
    spark.emit('end');
  });

  return this;
});

//
// Expose the module.
//
module.exports = Spark;
