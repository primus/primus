'use strict';

/**
 * Minimal EventEmitter interface that is molded against the Node.js
 * EventEmitter interface.
 *
 * @constructor
 * @api public
 */
function EventEmitter() {
  this._events = {};
}

/**
 * Return a list of assigned event listeners.
 *
 * @param {String} event The events that should be listed.
 * @returns {Array}
 * @api public
 */
EventEmitter.prototype.listeners = function listeners(event) {
  return (this._events[event] || []).slice(0);
};

/**
 * Emit an event to all registered event listeners.
 *
 * @param {String} event The name of the event.
 * @returns {Boolean} Indication if we've emitted an event.
 * @api public
 */
EventEmitter.prototype.emit = function emit(event) {
  if (!(event in this._events)) return false;

  var args = Array.prototype.slice.call(arguments, 1)
    , length = this._events[event].length
    , i = 0;

  for (; i < length; i++) {
    this._events[event][i].apply(this, args);
  }

  return true;
};

/**
 * Register a new EventListener for the given event.
 *
 * @param {String} event Name of the event.
 * @param {Functon} fn Callback function.
 * @api public
 */
EventEmitter.prototype.on = function on(event, fn) {
  if (!(event in this._events)) this._events[event] = [];
  this._events[event].push(fn);

  return this;
};

/**
 * Add an EventListener that's only called once.
 *
 * @param {String} event Name of the event.
 * @param {Function} fn Callback function.
 * @api public
 */
EventEmitter.prototype.once = function once(event, fn) {
  var ee = this;

  function eject() {
    ee.removeListener(event, eject);
    fn.apply(ee, arguments);
  }

  eject.fn = fn;
  return this.on(event, eject);
};

/**
 * Remove event listeners.
 *
 * @param {String} event The event we want to remove.
 * @param {Function} fn The listener that we need to find.
 * @api public
 */
EventEmitter.prototype.removeListener = function removeListener(event, fn) {
  if (!this._events || !(event in this._events)) return this;

  var listeners = this._events[event]
    , events = [];

  for (var i = 0, length = listeners.length; i < length; i++) {
    if (!fn || listeners[i] === fn || listeners[i].fn === fn) continue;

    events.push(listeners[i]);
  }

  //
  // Reset the array, or remove it completely if we have no more listeners.
  //
  if (events.length) this._events[event] = events;
  else delete this._events[event];

  return this;
};

/**
 * Remove all listeners or only the listeners for the specified event.
 *
 * @param {String} event The event want to remove all listeners for.
 * @api public
 */
EventEmitter.prototype.removeAllListeners = function removeAllListeners(event) {
  if (event) delete this._events[event];
  else this._events = {};

  return this;
};

/**
 * Primus in a real-time library agnostic framework for establishing real-time
 * connections with servers.
 *
 * Options:
 * - reconnect, configuration for the reconnect process.
 * - websockets, force the use of WebSockets, even when you should avoid them.
 *
 * @constructor
 * @param {String} url The URL of your server.
 * @param {Object} options The configuration.
 * @api private
 */
function Primus(url, options) {
  if (!(this instanceof Primus)) return new Primus(url);

  options = options || {};
  var primus = this;

  this.buffer = [];                          // Stores premature send data.
  this.writable = true;                      // Silly stream compatibility.
  this.readable = true;                      // Silly stream compatibility.
  this.url = this.parse(url);                // Parse the URL to a readable format.
  this.auth = this.url.auth;                 // Grab auth if given
  this.backoff = options.reconnect || {};    // Stores the back off configuration.
  this.attempt = null;                       // Current back off attempt.
  this.readyState = Primus.CLOSED;           // The readyState of the connection.
  this.transformers = {                      // Message transformers.
    outgoing: [],
    incoming: []
  };

  //
  // Initialize a stream interface, if we have any or default to our own
  // EventEmitter instance.
  //
  if (Stream) Stream.call(this);
  else EventEmitter.call(this);

  //
  // Force the use of WebSockets, even when we've detected some potential
  // broken WebSocket implementation.
  //
  if (options.websockets) this.AVOID_WEBSOCKETS = false;

  //
  // Check if the user wants to manually initialise a connection. If they don't,
  // we want to do it after a really small timeout so we give the users enough
  // time to listen for `error` events etc.
  //
  if (!options.manual) setTimeout(function open() {
    primus.open();
  }, 0);

  this.initialise(options);
}

//
// It's possible that we're running in Node.js or in a Node.js compatible
// environment such as browserify. In these cases we want to use some build in
// libraries to minimize our dependence on the DOM.
//
var Stream, parse;

try {
  parse = require('url').parse;
  Stream = require('stream');

  Primus.prototype = new Stream();
} catch (e) {
  Primus.prototype = new EventEmitter();

  //
  // In the browsers we can leverage the DOM to parse the URL for us. It will
  // automatically default to host of the current server when we supply it path
  // etc.
  // Remark: will this work for handling auth as well?
  //
  parse = function parse(url) {
    var a = document.createElement('a');
    a.href = url;

    return a;
  };
}

/**
 * Primus readyStates, used internally to set the correct ready state.
 *
 * @type {Number}
 * @private
 */
Primus.OPENING = 0;   // We're opening the connection.
Primus.CLOSED  = 1;   // No active connection.
Primus.OPEN    = 2;   // The connection is open.

/**
 * Are we working with a potentially broken WebSockets implementation? This
 * boolean can be used by transformers to remove `WebSockets` from their
 * supported transports.
 *
 * @type {Boolean}
 * @api private
 */
Primus.prototype.AVOID_WEBSOCKETS = false;

/**
 * The Ark contains all our plugins definitions. It's namespaced by
 * name=>plugin.
 *
 * @type {Object}
 * @private
 */
Primus.prototype.ark = {};

/**
 * Initialise the Primus and setup all parsers and internal listeners.
 *
 * @param {Object} options The original options object.
 * @api private
 */
Primus.prototype.initialise = function initalise(options) {
  var primus = this;

  /**
   * Start a new reconnect procedure.
   *
   * @api private
   */
  function reconnect() {
    primus.attempt = primus.attempt || primus.clone(primus.backoff);

    primus.reconnect(function reconnect(fail, backoff) {
      // Save the opts again of this back off, so they re-used.
      primus.attempt = backoff;

      if (fail) {
        primus.attempt = null;
        return primus.emit('end');
      }

      //
      // Try to re-open the connection again.
      //
      primus.emit('reconnect', backoff);
      primus.emit('outgoing::reconnect');
    }, primus.attempt);
  }

  primus.on('outgoing::open', function opening() {
    primus.readyState = Primus.OPENING;
  });

  primus.on('incoming::open', function opened() {
    if (primus.attempt) primus.attempt = null;

    primus.readyState = Primus.OPEN;
    primus.emit('open');

    if (primus.buffer.length) {
      for (var i = 0, length = primus.buffer.length; i < length; i++) {
        primus.write(primus.buffer[i]);
      }

      primus.buffer.length = 0;
    }
  });

  primus.on('incoming::error', function error(e) {
    //
    // We're still doing a reconnect attempt, it could be that we failed to
    // connect because the server was down. Failing connect attempts should
    // always emit an `error` event instead of a `open` event.
    //
    if (primus.attempt) return reconnect();
    if (primus.listeners('error').length) primus.emit('error', e);
  });

  primus.on('incoming::data', function message(raw) {
    primus.decoder(raw, function decoding(err, data) {
      //
      // Do a "save" emit('error') when we fail to parse a message. We don't
      // want to throw here as listening to errors should be optional.
      //
      if (err) return primus.listeners('error').length && primus.emit('error', err);

      //
      // The server is closing the connection, forcefully disconnect so we don't
      // reconnect again.
      //
      if ('primus::server::close' === data) {
        return primus.emit('incoming::end', data);
      }

      var transform, result, packet;
      for (transform in primus.transformers.incoming) {
        packet = { data: data };

        if (false === primus.transformers.incoming[transform].call(primus, packet)) {
          //
          // When false is returned by an incoming transformer it means that's
          // being handled by the transformer and we should not emit the `data`
          // event.
          //
          return;
        }

        data = packet.data;
      }

      //
      // The transformers can
      //
      primus.emit('data', data, raw);
    });
  });

  primus.on('incoming::end', function end(intentional) {
    if (primus.readyState !== Primus.OPEN) return;
    primus.readyState = Primus.CLOSED;

    //
    // Some transformers emit garbage when they close the connection. Like the
    // reason why it closed etc. we should explicitly check if WE send an
    // intentional message.
    //
    if ('primus::server::close' === intentional) {
      return primus.emit('end');
    }

    //
    // The disconnect was unintentional, probably because the server shut down.
    // So we should just start a reconnect procedure.
    //
    reconnect();
  });

  //
  // Setup the real-time client.
  //
  primus.client();

  //
  // Process the potential plugins.
  //
  for (var plugin in primus.ark) {
    primus.ark[plugin].call(primus, primus, options);
  }

  return primus;
};

/**
 * Establish a connection with the server. When this function is called we
 * assume that we don't have any open connections. If you do call it when you
 * have a connection open, it could cause duplicate connections.
 *
 * @api public
 */
Primus.prototype.open = function open() {
  this.emit('outgoing::open');

  return this;
};

/**
 * Send a new message.
 *
 * @param {Mixed} data The data that needs to be written.
 * @returns {Boolean} Always returns true.
 * @api public
 */
Primus.prototype.write = function write(data) {
  var primus = this
    , transform
    , packet;

  if (Primus.OPEN === this.readyState) {
    for (transform in primus.transformers.outgoing) {
      packet = { data: data };

      if (false === primus.transformers.outgoing[transform].call(primus, packet)) {
        //
        // When false is returned by an incoming transformer it means that's
        // being handled by the transformer and we should not emit the `data`
        // event.
        //
        return;
      }

      data = packet.data;
    }

    this.encoder(data, function encoded(err, packet) {
      //
      // Do a "save" emit('error') when we fail to parse a message. We don't
      // want to throw here as listening to errors should be optional.
      //
      if (err) return primus.listeners('error').length && primus.emit('error', err);
      primus.emit('outgoing::data', packet);
    });
  } else {
    primus.buffer.push(data);
  }

  return true;
};

/**
 * Close the connection.
 *
 * @param {Mixed} data last packet of data.
 * @api public
 */
Primus.prototype.end = function end(data) {
  if (this.readyState === Primus.CLOSED) return this;
  if (data) this.write(data);

  this.writable = false;
  this.readyState = Primus.CLOSED;

  this.emit('outgoing::end');
  this.emit('end');

  return this;
};

/**
 * Exponential back off algorithm for retry operations. It uses an randomized
 * retry so we don't DDOS our server when it goes down under pressure.
 *
 * @param {Function} callback Callback to be called after the timeout.
 * @param {Object} opts Options for configuring the timeout.
 * @api private
 */
Primus.prototype.reconnect = function reconnect(callback, opts) {
  opts = opts || {};

  opts.maxDelay = opts.maxDelay || Infinity;  // Maximum delay.
  opts.minDelay = opts.minDelay || 500;       // Minimum delay.
  opts.retries = opts.retries || 10;          // Amount of allowed retries.
  opts.attempt = (+opts.attempt || 0) + 1;    // Current attempt.
  opts.factor = opts.factor || 2;             // Back off factor.

  // Bailout if we are about to make to much attempts. Please note that we use
  // `>` because we already incremented the value above.
  if (opts.attempt > opts.retries || opts.backoff) {
    return callback(new Error('Unable to retry'), opts);
  }

  // Prevent duplicate back off attempts.
  opts.backoff = true;

  //
  // Calculate the timeout, but make it randomly so we don't retry connections
  // at the same interval and defeat the purpose. This exponential back off is
  // based on the work of:
  //
  // http://dthain.blogspot.nl/2009/02/exponential-backoff-in-distributed.html
  //
  opts.timeout = opts.attempt !== 1
    ? Math.min(Math.round(
        (Math.random() * 1) * opts.minDelay * Math.pow(opts.factor, opts.attempt)
      ), opts.maxDelay)
    : opts.minDelay;

  //
  // Emit a `reconnecting` event with current reconnect options. This allows
  // them to update the UI and provide their users with feedback.
  //
  this.emit('reconnecting', opts);

  setTimeout(function delay() {
    opts.backoff = false;
    callback(undefined, opts);
  }, opts.timeout);

  return this;
};

/**
 * Create a shallow clone of a given object.
 *
 * @param {Object} obj The object that needs to be cloned.
 * @returns {Object} Copy.
 * @api private
 */
Primus.prototype.clone = function clone(obj) {
  var copy = {}
    , key;

  for (key in obj) {
    if (obj.hasOwnProperty(key)) copy[key] = obj[key];
  }

  return copy;
};

/**
 * Parse the connection string.
 *
 * @param {String} url Connection URL.
 * @returns {Object} Parsed connection.
 * @api public
 */
Primus.prototype.parse = parse;

/**
 * Generates a connection URI.
 *
 * @param {String} protocol The protocol that should used to crate the URI.
 * @param {Boolean} querystring Do we need to include a query string.
 * @returns {String} The URL.
 * @api private
 */
Primus.prototype.uri = function uri(protocol, querystring) {
  var server = [];

  server.push(this.url.protocol === 'https:' ? protocol +'s:' : protocol +':', '');
  server.push(this.auth ? this.auth + '@' + this.url.host : this.url.host, this.pathname.slice(1));

  //
  // Optionally add a search query.
  //
  if (this.url.search && querystring) server.push(this.url.search);
  return server.join('/');
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
Primus.prototype.emits = function emits(event, parser) {
  var primus = this;

  return function emit(arg) {
    var data = parser ? parser.apply(primus, arguments) : arg;

    //
    // Timeout is required to prevent crashes on WebSockets connections on
    // mobile devices. We need to handle these edge cases in our own library
    // as we cannot be certain that all frameworks fix these issues.
    //
    setTimeout(function timeout() {
      primus.emit('incoming::'+ event, data);
    }, 0);
  };
};

/**
 * Register a new message transformer. This allows you to easily manipulate incoming
 * and outgoing data which is particularity handy for plugins that want to send
 * meta data together with the messages.
 *
 * @param {String} type Incoming or outgoing
 * @param {Function} fn A new message transformer.
 * @api public
 */
Primus.prototype.transform = function transform(type, fn) {
  if (!(type in this.transformers)) throw new Error('Invalid transformer type');

  this.transformers[type].push(fn);
  return this;
};

/**
 * Syntax sugar, adopt a Socket.IO like API.
 *
 * @param {String} url The URL we want to connect to.
 * @param {Object} options Connection options.
 * @returns {Primus}
 * @api public
 */
Primus.connect = function connect(url, options) {
  return new Primus(url, options);
};

//
// Expose the EventEmitter so it can be re-used by wrapping libraries.
//
Primus.EventEmitter = EventEmitter;

//
// These libraries are automatically are automatically inserted at the
// server-side using the Primus#library method.
//
Primus.prototype.pathname = null; // @import {primus::pathname};
Primus.prototype.client = null; // @import {primus::transport};
Primus.prototype.encoder = null; // @import {primus::encoder};
Primus.prototype.decoder = null; // @import {primus::decoder};
Primus.prototype.version = null; // @import {primus::version};

//
// Hack 1: \u2028 and \u2029 are allowed inside string in JSON. But JavaScript
// defines them as newline separators. Because no literal newlines are allowed
// in a string this causes a ParseError. We work around this issue by replacing
// these characters with a properly escaped version for those chars. This can
// cause errors with JSONP requests or if the string is just evaluated.
//
// This could have been solved by replacing the data during the "outgoing::data"
// event. But as it affects the JSON encoding in general I've opted for a global
// patch instead so all JSON.stringify operations are save.
//
if (
    'object' === typeof JSON
 && 'function' === typeof JSON.stringify
 && JSON.stringify(['\u2028\u2029']) === '["\u2028\u2029"]'
) {
  JSON.stringify = function replace(stringify) {
    var u2028 = /\u2028/g
      , u2029 = /\u2029/g;

    return function patched(value, replacer, spaces) {
      var result = stringify.call(this, value, replacer, spaces);

      //
      // Replace the bad chars.
      //
      if (result) {
        if (~result.indexOf('\u2028')) result = result.replace(u2028, '\\u2028');
        if (~result.indexOf('\u2029')) result = result.replace(u2029, '\\u2029');
      }

      return result;
    };
  }(JSON.stringify);
}

if (
     'undefined' !== typeof document
  && 'undefined' !== typeof navigator
) {
  //
  // Hack 2: If you press ESC in FireFox it will close all active connections.
  // Normally this makes sense, when your page is still loading. But versions
  // before FireFox 22 will close all connections including WebSocket connections
  // after page load. One way to prevent this is to do a `preventDefault()` and
  // cancel the operation before it bubbles up to the browsers's default handler.
  // It needs to be added as `keydown` event, if it's added keyup it will not be
  // able to prevent the connection from being closed.
  //
  if (document.addEventListener) {
    document.addEventListener('keydown', function keydown(e) {
      if (e.keyCode !== 27 || !e.preventDefault) return;

      e.preventDefault();
    }, false);
  }

  //
  // Hack 3: This is a Mac/Apple bug only, when you're behind a reverse proxy or
  // have you network settings set to `automatic proxy discovery` the safari
  // browser will crash when the WebSocket constructor is initialised. There is
  // no way to detect the usage of these proxies available in JavaScript so we
  // need to do some nasty browser sniffing. This only affects Safari versions
  // lower then 5.1.4
  //
  var ua = (navigator.userAgent || '').toLowerCase()
    , parsed = ua.match(/.+(?:rv|it|ra|ie)[\/: ](\d+)\.(\d+)(?:\.(\d+))?/) || []
    , version = +[parsed[1], parsed[2]].join('.');

  if (
       !~ua.indexOf('chrome')
    && ~ua.indexOf('safari')
    && version < 534.54
  ) {
    Primus.prototype.AVOID_WEBSOCKETS = true;
  }
}
