'use strict';

var ParserError = require('./errors').ParserError
  , log = require('diagnostics')('primus:spark')
  , parse = require('querystring').parse
  , forwarded = require('forwarded-for')
  , Ultron = require('ultron')
  , fuse = require('fusing')
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
 * @param {Request} request The HTTP Request instance that initialised the spark.
 * @api public
 */
function Spark(primus, headers, address, query, id, request) {
  this.fuse();

  var writable = this.writable
    , spark = this;

  query = query || {};
  id = id || this.uuid(primus);
  headers = headers || {};
  address = address || {};
  request = request || headers['primus::req::backup'];

  writable('id', id);                   // Unique id for socket.
  writable('primus', primus);           // References to Primus.
  writable('remote', address);          // The remote address location.
  writable('headers', headers);         // The request headers.
  writable('request', request);         // Reference to an HTTP request.
  writable('writable', true);           // Silly stream compatibility.
  writable('readable', true);           // Silly stream compatibility.
  writable('query', query);             // The query string.
  writable('timeout', null);            // Heartbeat timeout.
  writable('ultron', new Ultron(this)); // Our event listening cleanup.

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

fuse(Spark, require('stream'), {
  defaults: false
});

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
Spark.get('address', function address() {
  return this.request.forwarded || forwarded(this.remote, this.headers, this.primus.whitelist);
});

/**
 * Set a timer to forcibly disconnect the spark if no data is received from the
 * client within the given timeout.
 *
 * @api private
 */
Spark.readable('heartbeat', function heartbeat() {
  var spark = this;

  clearTimeout(spark.timeout);

  if ('number' !== typeof spark.primus.timeout) return spark;

  log('setting new heartbeat timeout for %s', spark.id);

  this.timeout = setTimeout(function timeout() {
    //
    // Set reconnect to true so we're not sending a `primus::server::close`
    // packet.
    //
    spark.end(undefined, { reconnect: true });
  }, spark.primus.timeout);

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
    , ultron = this.ultron
    , spark = this;

  //
  // Prevent double initialization of the spark. If we already have an
  // `incoming::data` handler we assume that all other cases are handled as well.
  //
  if (this.listeners('incoming::data').length) {
    return log('already has incoming::data listeners, bailing out');
  }

  //
  // We've received new data from our client, decode and emit it.
  //
  ultron.on('incoming::data', function message(raw) {
    //
    // New data has arrived so we're certain that the connection is still alive,
    // so it's save to restart the heartbeat sequence.
    //
    spark.heartbeat();

    primus.decoder.call(spark, raw, function decoding(err, data) {
      //
      // Do a "save" emit('error') when we fail to parse a message. We don't
      // want to throw here as listening to errors should be optional.
      //
      if (err) {
        log('failed to decode the incoming data for %s', spark.id);
        return new ParserError('Failed to decode incoming data: '+ err.message, spark, err);
      }

      //
      // Handle "primus::" prefixed protocol messages.
      //
      if (spark.protocol(data)) return;
      spark.transforms(primus, spark, 'incoming', data, raw);
    });
  });

  //
  // We've received a ping message.
  //
  ultron.on('incoming::ping', function ping(time) {
    spark.emit('outgoing::pong', time);
    spark._write('primus::pong::'+ time);
  });

  //
  // The client has disconnected.
  //
  ultron.on('incoming::end', function disconnect() {
    //
    // The socket is closed, sending data over it will throw an error.
    //
    log('transformer closed connection for %s', spark.id);
    spark.end(undefined, { reconnect: true });
  });

  ultron.on('incoming::error', function error(err) {
    //
    // Ensure that the error we emit is always an Error instance. There are
    // transformers that used to emit only strings. A string is not an Error.
    //
    if ('string' === typeof err) {
      err = new Error(err);
    }

    if (spark.listeners('error').length) spark.emit('error', err);
    spark.primus.emit('log', 'error', err);

    log('transformer received error `%s` for %s', err.message, spark.id);
    spark.end();
  });

  //
  // End is triggered by both incoming and outgoing events.
  //
  ultron.on('end', function end() {
    clearTimeout(spark.timeout);
    primus.emit('disconnection', spark);

    //
    // We are most likely the first `end` event in the EventEmitter stack which
    // will make our callback the first to be execute. If we instantly delete
    // properties it will cause that our users can't access them anymore in
    // their `end` listener. So if they need to un-register something based on
    // the spark.id, that would be impossible. Therefor we delay our deletion
    // with a non scientific amount of milliseconds to give people some time to
    // use these references for the last time.
    //
    setTimeout(function timeout() {
      log('releasing references from our spark object for %s', spark.id);
      //
      // Release references.
      // @TODO also remove the references that we're set by users.
      //
      [
        'id', 'primus', 'remote', 'headers', 'request', 'query'
      ].forEach(function each(key) {
        delete spark[key];
      });
    }, 10);
  });

  //
  // Announce a new connection. This allows the transformers to change or listen
  // to events before we announce it.
  //
  process.nextTick(function tick() {
    primus.asyncemit('connection', spark, function damn(err) {
      if (!err) return;

      spark.emit('incoming::error', err);
    });
  });
}]);

/**
 * Execute the set of message transformers from Primus on the incoming or
 * outgoing message.
 * This function and it's content should be in sync with Primus#transforms in
 * primus.js.
 *
 * @param {Primus} primus Reference to the Primus instance with message transformers.
 * @param {Spark|Primus} connection Connection that receives or sends data.
 * @param {String} type The type of message, 'incoming' or 'outgoing'.
 * @param {Mixed} data The data to send or that has been received.
 * @param {String} raw The raw encoded data.
 * @returns {Spark}
 * @api public
 */
Spark.readable('transforms', function transforms(primus, connection, type, data, raw) {
  var packet = { data: data, raw: raw }
    , fns = primus.transformers[type];

  //
  // Iterate in series over the message transformers so we can allow optional
  // asynchronous execution of message transformers which could for example
  // retrieve additional data from the server, do extra decoding or even
  // message validation.
  //
  (function transform(index, done) {
    var transformer = fns[index++];

    if (!transformer) return done();

    if (1 === transformer.length) {
      if (false === transformer.call(connection, packet)) {
        //
        // When false is returned by an incoming transformer it means that's
        // being handled by the transformer and we should not emit the `data`
        // event.
        //
        return;
      }

      return transform(index, done);
    }

    transformer.call(connection, packet, function finished(err, arg) {
      if (err) return connection.emit('error', err);
      if (false === arg) return;

      transform(index, done);
    });
  }(0, function done() {
    //
    // We always emit 2 arguments for the data event, the first argument is the
    // parsed data and the second argument is the raw string that we received.
    // This allows you, for example, to do some validation on the parsed data
    // and then save the raw string in your database without the stringify
    // overhead.
    //
    if ('incoming' === type) {
      return connection.emit('data', packet.data, packet.raw);
    }

    connection._write(packet.data);
  }));

  return this;
});

/**
 * Generate a unique UUID.
 *
 * @param {Primus} primus Reference to the primus instance.
 * @returns {String} UUID.
 * @api private
 */
Spark.readable('uuid', function uuid(primus) {
  return Date.now() +'$'+ primus.sparks++;
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
      this.emit('incoming::ping', value);
    break;

    case 'id':
      this._write('primus::id::'+ this.id);
    break;

    //
    // Unknown protocol, somebody is probably sending `primus::` prefixed
    // messages.
    //
    default:
      log('message `%s` was prefixed with primus:: but not supported', msg);
      return false;
  }

  log('processed a primus protocol message `%s`', msg);
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
  var primus = this.primus;

  //
  // The connection is closed, return false.
  //
  if (Spark.CLOSED === this.readyState) {
    log('attempted to write but readyState was already set to CLOSED for %s', this.id);
    return false;
  }

  this.transforms(primus, this, 'outgoing', data);

  return true;
});

/**
 * The actual message writer.
 *
 * @param {Mixed} data The message that needs to be written.
 * @returns {Boolean}
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
  if (Spark.CLOSED === spark.readyState) {
    log('attempted to _write but readyState was already set to CLOSED for %s', spark.id);
    return false;
  }

  primus.encoder.call(spark, data, function encoded(err, packet) {
    //
    // Do a "save" emit('error') when we fail to parse a message. We don't
    // want to throw here as listening to errors should be optional.
    //
    if (err) return new ParserError('Failed to encode outgoing data: '+ err.message, spark, err);
    if (!packet) return log('nothing to write, bailing out for %s', spark.id);

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

  return true;
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

  log('end initiated by developer for %s', this.id);

  options = options || {};
  if (data !== undefined) this.write(data);

  //
  // If we want to trigger a reconnect do not send
  // `primus::server::close`, otherwise bypass the .write method
  // as this message should not be transformed.
  //
  if (!options.reconnect) this._write('primus::server::close');

  this.readyState = Spark.CLOSED;
  this.emit('outgoing::end');
  this.emit('end');
  this.ultron.destroy();

  return this;
});

//
// Expose the module.
//
module.exports = Spark;
