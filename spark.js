'use strict';

/**
 * The Spark is an indefinable, indescribable energy or soul of a transformer
 * which can be used to create new transformers. In our case, it's a simple
 * wrapping interface.
 *
 * @constructor
 * @param {Primus} primus Reference to the Primus server. (Set using .bind)
 * @param {Object} headers The request headers for this connection.
 * @param {Object} address The remoteAddress and port.
 * @api public
 */
function Spark(primus, headers, address) {
  this.primus = primus;     // References to the primus.
  this.headers = headers;   // The request headers.
  this.address = address;   // The remote address.

  this.writable = true;     // Silly stream compatiblity.
  this.readable = true;     // Silly stream compatiblity.

  this.initialise();
}

Spark.prototype.__proto__ = require('events').EventEmitter.prototype;

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
  this.on('primus::data', function message(data) {
    primus.decoder(data, function decoding(err, packet) {
      //
      // Do a "save" emit('error') when we fail to parse a message. We don't
      // want to throw here as listening to errors should be optional.
      //
      if (err) return spark.listeners('error').length && spark.emit('error', err);
      spark.emit('data', packet);
    });
  });

  //
  // The client has disconnected.
  //
  this.on('primus::end', function disconnect() {
    spark.emit('end');
    spark.removeAllListeners();
    primus.emit('disconnection', spark)
  });

  //
  // Announce a new connection.
  //
  process.nextTick(function tick() {
    primus.emit('connection', this);
  });
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

    spark.emit('primus::'+ event, data);
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
  var spark = this;

  this.primus.encoder(data, function encoded(err, packet) {
    //
    // Do a "save" emit('error') when we fail to parse a message. We don't
    // want to throw here as listening to errors should be optional.
    //
    if (err) return spark.listeners('error').length && spark.emit('error', err);
    spark.emit('data', packet);
  });

  return true;
};

/**
 * End the connection.
 *
 * @api private
 */
Spark.prototype.end = function end() {
  this.emit('end');
  this.removeAllListeners();
};

//
// Expose the module.
//
module.exports = Spark;
