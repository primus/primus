'use strict';

var parse = require('querystring').parse
  , forwarded = require('./forwarded');

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

  this.writable = true;         // Silly stream compatiblity.
  this.readable = true;         // Silly stream compatiblity.

  //
  // Parse our query string.
  //
  if ('string' === typeof this.query) this.query = parse(this.query);

  this.initialise();
}

Spark.prototype.__proto__ = require('stream').prototype;

//
// Lazy parse interface for ip address information. As nobody is always
// interested in this, we're going to defer parsing until it's actually needed.
//
Object.defineProperty(Spark.prototype, 'address', {
  get: function address() {
    return forwarded(this.remote, this.headers);
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
      if (err) return spark.listeners('error').length && spark.emit('error', err);

      var transform, result, packet;
      for (transform in primus.transformers.incoming) {
        packet = { data: data };

        if (false === primus.transformers.incoming[transform].call(spark, packet)) {
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
    spark.emit('end');
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
    , spark = this
    , transform
    , packet;

  for (transform in primus.transformers.outgoing) {
    packet = { data: data };

    if (false === primus.transformers.outgoing[transform].call(spark, packet)) {
      //
      // When false is returned by an incoming transformer it means that's
      // being handled by the transformer and we should not emit the `data`
      // event.
      //
      return;
    }

    data = packet.data;
  }

  spark.primus.encoder(data, function encoded(err, packet) {
    //
    // Do a "save" emit('error') when we fail to parse a message. We don't
    // want to throw here as listening to errors should be optional.
    //
    if (err) return spark.listeners('error').length && spark.emit('error', err);
    spark.emit('outgoing::data', packet);
  });

  return true;
};

/**
 * End the connection.
 *
 * @param {Mixed} data Optional closing data.
 * @api public
 */
Spark.prototype.end = function end(data) {
  if (data) this.write(data);

  //
  // Tell our connection that this is a intended close and that is shouldn't do
  // any reconnect operations.
  //
  this.write('primus::server::close');

  var spark = this;

  process.nextTick(function tick() {
    spark.emit('outgoing::end');
    spark.emit('end');
  });
};

//
// Expose the module.
//
module.exports = Spark;
