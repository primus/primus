/*globals require, define */
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
EventEmitter.prototype.emit = function emit(event, a1, a2, a3, a4, a5) {
  if (!this._events[event]) return false;

  var listeners = this._events[event]
    , length = listeners.length
    , handler = listeners[0]
    , len = arguments.length
    , args
    , i;

  if (1 === length) {
    switch (len) {
      case 1:
        handler.call(this);
      break;
      case 2:
        handler.call(this, a1);
      break;
      case 3:
        handler.call(this, a1, a2);
      break;
      case 4:
        handler.call(this, a1, a2, a3);
      break;
      case 5:
        handler.call(this, a1, a2, a3, a4);
      break;
      case 6:
        handler.call(this, a1, a2, a3, a4, a5);
      break;

      default:
        for (i = 1, args = new Array(len -1); i < len; i++) {
          args[i - 1] = arguments[i];
        }

        handler.apply(this, args);
    }
  } else {
    for (i = 1, args = new Array(len -1); i < len; i++) {
      args[i - 1] = arguments[i];
    }

    for (i = 0; i < length; i++) {
      listeners[i].apply(this, args);
    }
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
  if (!this._events[event]) this._events[event] = [];
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
  return ee.on(event, eject);
};

/**
 * Remove event listeners.
 *
 * @param {String} event The event we want to remove.
 * @param {Function} fn The listener that we need to find.
 * @api public
 */
EventEmitter.prototype.removeListener = function removeListener(event, fn) {
  if (!this._events || !this._events[event]) return this;

  var listeners = this._events[event]
    , events = [];

  for (var i = 0, length = listeners.length; i < length; i++) {
    if (!(!fn || listeners[i] === fn || listeners[i].fn === fn)) {
      events.push(listeners[i]);
    }
  }

  //
  // Reset the array, or remove it completely if we have no more listeners.
  //
  if (events.length) this._events[event] = events;
  else this._events[event] = null;

  return this;
};

/**
 * Remove all listeners or only the listeners for the specified event.
 *
 * @param {String} event The event want to remove all listeners for.
 * @api public
 */
EventEmitter.prototype.removeAllListeners = function removeAllListeners(event) {
  if (event) this._events[event] = null;
  else this._events = {};

  return this;
};

/**
 * Context assertion, ensure that some of our public Primus methods are called
 * with the correct context to ensure that
 *
 * @param {Primus} self The context of the function.
 * @param {String} method The method name.
 * @api private
 */
function context(self, method) {
  if (self instanceof Primus) return;

  var failure = new Error('Primus#'+ method + '\'s context should called with a Primus instance');

  if (!self.listeners('error').length) throw failure;
  self.emit('error', failure);
}

/**
 * Primus in a real-time library agnostic framework for establishing real-time
 * connections with servers.
 *
 * Options:
 * - reconnect, configuration for the reconnect process.
 * - manual, don't automatically call `.open` to start the connection.
 * - websockets, force the use of WebSockets, even when you should avoid them.
 * - timeout, connect timeout, server didn't respond in a timely manner.
 * - ping, The heartbeat interval for sending a ping packet to the server.
 * - pong, The heartbeat timeout for receiving a response to the ping.
 * - network, Use network events as leading method for network connection drops.
 * - strategy, Reconnection strategies.
 *
 * @constructor
 * @param {String} url The URL of your server.
 * @param {Object} options The configuration.
 * @api private
 */
function Primus(url, options) {
  if (!(this instanceof Primus)) return new Primus(url, options);

  var primus = this;

  options = options || {};
  options.timeout = +options.timeout || 10e3;   // Connection timeout duration.
  options.reconnect = options.reconnect || {};  // Stores the back off configuration.
  options.ping = +options.ping || 25e3;         // Heartbeat ping interval.
  options.pong = +options.pong || 10e3;         // Heartbeat pong response timeout.
  options.strategy = options.strategy || [];    // Reconnect strategies.

  primus.buffer = [];                           // Stores premature send data.
  primus.writable = true;                       // Silly stream compatibility.
  primus.readable = true;                       // Silly stream compatibility.
  primus.url = primus.parse(url);               // Parse the URL to a readable format.
  primus.readyState = Primus.CLOSED;            // The readyState of the connection.
  primus.options = options;                     // Reference to the supplied options.
  primus.timers = {};                           // Contains all our timers.
  primus.attempt = null;                        // Current back off attempt.
  primus.socket = null;                         // Reference to the internal connection.
  primus.transformers = {                       // Message transformers.
    outgoing: [],
    incoming: []
  };

  //
  // Parse the reconnection strategy. It can have the following strategies:
  //
  // - timeout: Reconnect when we have a network timeout.
  // - disconnect: Reconnect when we have an unexpected disconnect.
  // - online: Reconnect when we're back online.
  //
  if ('string' === typeof options.strategy) {
    options.strategy = options.strategy.split(/\s?\,\s?/g);
  }

  if (!options.strategy.length) {
    options.strategy.push('disconnect', 'online');

    //
    // Timeout based reconnection should only be enabled conditionally. When
    // authorization is enabled it could trigger.
    //
    if (!this.authorization) options.strategy.push('timeout');
  }

  options.strategy = options.strategy.join(',').toLowerCase();

  //
  // Only initialise the EventEmitter interface if we're running in a plain
  // browser environment. The Stream interface is inherited differently when it
  // runs on browserify and on Node.js.
  //
  if (!Stream) EventEmitter.call(primus);

  //
  // Force the use of WebSockets, even when we've detected some potential
  // broken WebSocket implementation.
  //
  if ('websockets' in options) {
    primus.AVOID_WEBSOCKETS = !options.websockets;
  }

  //
  // Force or disable the use of NETWORK events as leading client side
  // disconnection detection.
  //
  if ('network' in options) {
    primus.NETWORK_EVENTS = options.network;
  }

  //
  // Check if the user wants to manually initialise a connection. If they don't,
  // we want to do it after a really small timeout so we give the users enough
  // time to listen for `error` events etc.
  //
  if (!options.manual) primus.timers.open = setTimeout(function open() {
    primus.clearTimeout('open').open();
  }, 0);

  primus.initialise(options);
}

/**
 * Simple require wrapper to make browserify, node and require.js play nice.
 *
 * @param {String} name The module to require.
 * @api private
 */
Primus.require = function requires(name) {
  if ('function' !== typeof require) return undefined;

  return !('function' === typeof define && define.amd)
    ? require(name)
    : undefined;
};

//
// It's possible that we're running in Node.js or in a Node.js compatible
// environment such as browserify. In these cases we want to use some build in
// libraries to minimize our dependence on the DOM.
//
var Stream, parse;

try {
  Primus.Stream = Stream = Primus.require('stream');
  parse = Primus.require('url').parse;

  //
  // Normally inheritance is done in the same way as we do in our catch
  // statement. But due to changes to the EventEmitter interface in Node 0.10
  // this will trigger annoying memory leak warnings and other potential issues
  // outlined in the issue linked below.
  //
  // @see https://github.com/joyent/node/issues/4971
  //
  Primus.require('util').inherits(Primus, Stream);
} catch (e) {
  Primus.Stream = EventEmitter;
  Primus.prototype = new EventEmitter();

  //
  // In the browsers we can leverage the DOM to parse the URL for us. It will
  // automatically default to host of the current server when we supply it path
  // etc.
  //
  parse = function parse(url) {
    var a = document.createElement('a');
    a.href = url;

    //
    // Browsers do not parse authorization information, so we need to extract
    // that from the URL.
    //
    if (~a.href.indexOf('@') && !a.auth) {
      a.auth = a.href.slice(a.protocol.length + 2, a.href.indexOf(a.pathname)).split('@')[0];
    }

    return a;
  };
}

/**
 * Primus readyStates, used internally to set the correct ready state.
 *
 * @type {Number}
 * @private
 */
Primus.OPENING = 1;   // We're opening the connection.
Primus.CLOSED  = 2;   // No active connection.
Primus.OPEN    = 3;   // The connection is open.

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
 * Some browsers support registering emitting `online` and `offline` events when
 * the connection has been dropped on the client. We're going to detect it in
 * a simple `try {} catch (e) {}` statement so we don't have to do complicated
 * feature detection.
 *
 * @type {Boolean}
 * @api private
 */
Primus.prototype.NETWORK_EVENTS = false;
Primus.prototype.online = true;

try {
  if (Primus.prototype.NETWORK_EVENTS = 'onLine' in navigator && (window.addEventListener || document.body.attachEvent)) {
    if (!navigator.onLine) {
      Primus.prototype.online = false;
    }
  }
} catch (e) { }

/**
 * The Ark contains all our plugins definitions. It's namespaced by
 * name => plugin.
 *
 * @type {Object}
 * @private
 */
Primus.prototype.ark = {};

/**
 * Return the given plugin.
 *
 * @param {String} name The name of the plugin.
 * @returns {Mixed}
 * @api public
 */
Primus.prototype.plugin = function plugin(name) {
  context(this, 'plugin');

  if (name) return this.ark[name];

  var plugins = {};

  for (name in this.ark) {
    plugins[name] = this.ark[name];
  }

  return plugins;
};

/**
 * Initialise the Primus and setup all parsers and internal listeners.
 *
 * @param {Object} options The original options object.
 * @api private
 */
Primus.prototype.initialise = function initalise(options) {
  var primus = this;

  primus.on('outgoing::open', function opening() {
    primus.readyState = Primus.OPENING;
  });

  primus.on('incoming::open', function opened() {
    if (primus.attempt) primus.attempt = null;

    primus.readyState = Primus.OPEN;
    primus.emit('open');
    primus.clearTimeout('ping', 'pong').heartbeat();

    if (primus.buffer.length) {
      for (var i = 0, length = primus.buffer.length; i < length; i++) {
        primus.write(primus.buffer[i]);
      }

      primus.buffer.length = 0;
    }
  });

  primus.on('incoming::pong', function pong(time) {
    primus.online = true;
    primus.clearTimeout('pong').heartbeat();
  });

  primus.on('incoming::error', function error(e) {
    var connect = primus.timers.connect;

    //
    // We're still doing a reconnect attempt, it could be that we failed to
    // connect because the server was down. Failing connect attempts should
    // always emit an `error` event instead of a `open` event.
    //
    if (primus.attempt) return primus.reconnect();
    if (primus.listeners('error').length) primus.emit('error', e);

    //
    // We received an error while connecting, this most likely the result of an
    // unauthorized access to the server. But this something that is only
    // triggered for Node based connections. Browsers trigger the error event.
    //
    if (connect) {
      if (~primus.options.strategy.indexOf('timeout')) primus.reconnect();
      else primus.end();
    }
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
      if ('primus::server::close' === data) return primus.end();

      //
      // We received a pong message from the server, return the id.
      //
      if ('string' === typeof data && data.indexOf('primus::pong::') === 0) {
        return primus.emit('incoming::pong', data.slice(14));
      }

      for (var i = 0, length = primus.transformers.incoming.length; i < length; i++) {
        var packet = { data: data };

        if (false === primus.transformers.incoming[i].call(primus, packet)) {
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
      // We always emit 2 arguments for the data event, the first argument is the
      // parsed data and the second argument is the raw string that we received.
      // This allows you to do some validation on the parsed data and then save
      // the raw string in your database or what ever so you don't have the
      // stringify overhead.
      //
      primus.emit('data', data, raw);
    });
  });

  primus.on('incoming::end', function end(intentional) {
    var readyState = primus.readyState;

    //
    // Always set the readyState to closed, and if we're still connecting, close
    // the connection so we're sure that everything after this if statement block
    // is only executed because our readyState is set to `open`.
    //
    primus.readyState = Primus.CLOSED;
    if (primus.timers.connect) primus.end();
    if (readyState !== Primus.OPEN) return;

    //
    // Some transformers emit garbage when they close the connection. Like the
    // reason why it closed etc. we should explicitly check if WE send an
    // intentional message.
    //
    if ('primus::server::close' === intentional) {
      return primus.emit('end');
    }

    //
    // Always, call the `close` event as an indication of connection disruption.
    // This also emitted by `primus#end` so for all cases above, it's still
    // emitted.
    //
    primus.emit('close');

    //
    // The disconnect was unintentional, probably because the server shut down.
    // So we should just start a reconnect procedure.
    //
    if (~primus.options.strategy.indexOf('disconnect')) primus.reconnect();
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

  //
  // NOTE: The following code is only required if we're supporting network
  // events as it requires access to browser globals.
  //
  if (!primus.NETWORK_EVENTS) return primus;

  /**
   * Handler for offline notifications.
   *
   * @api private
   */
  function offline() {
      primus.online = false;
      primus.emit('offline');
      primus.end();
  }

  /**
   * Handler for online notifications.
   *
   * @api private
   */
  function online() {
    primus.online = true;
    primus.emit('online');

    if (~primus.options.strategy.indexOf('online')) primus.reconnect();
  }

  if (window.addEventListener) {
    window.addEventListener('offline', offline, false);
    window.addEventListener('online', online, false);
  } else if (document.body.attachEvent){
    document.body.attachEvent('onoffline', offline);
    document.body.attachEvent('ononline', online);
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
  context(this, 'open');

  //
  // Only start a `connection timeout` procedure if we're not reconnecting as
  // that shouldn't count as an initial connection. This should be started
  // before the connection is opened to capture failing connections and kill the
  // timeout.
  //
  if (!this.attempt && this.options.timeout) this.timeout();

  return this.emit('outgoing::open');
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
    , packet;

  context(primus, 'write');

  if (Primus.OPEN === primus.readyState) {
    for (var i = 0, length = primus.transformers.outgoing.length; i < length; i++) {
      packet = { data: data };

      if (false === primus.transformers.outgoing[i].call(primus, packet)) {
        //
        // When false is returned by an incoming transformer it means that's
        // being handled by the transformer and we should not emit the `data`
        // event.
        //
        return;
      }

      data = packet.data;
    }

    primus.encoder(data, function encoded(err, packet) {
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
 * Send a new heartbeat over the connection to ensure that we're still
 * connected and our internet connection didn't drop. We cannot use server side
 * heartbeats for this unfortunately.
 *
 * @api private
 */
Primus.prototype.heartbeat = function heartbeat() {
  var primus = this;

  if (!primus.options.ping) return primus;

  /**
   * Exterminate the connection as we've timed out.
   *
   * @api private
   */
  function pong() {
    primus.clearTimeout('pong');

    //
    // The network events already captured the offline event.
    //
    if (primus.online) return;

    primus.online = false;
    primus.emit('offline');
    primus.emit('incoming::end');
  }

  /**
   * We should send a ping message to the server.
   *
   * @api private
   */
  function ping() {
    primus.clearTimeout('ping').write('primus::ping::'+ (+new Date));
    primus.emit('outgoing::ping');
    primus.timers.pong = setTimeout(pong, primus.options.pong);
  }

  primus.timers.ping = setTimeout(ping, primus.options.ping);
};

/**
 * Start a connection timeout.
 *
 * @api private
 */
Primus.prototype.timeout = function timeout() {
  var primus = this;

  /**
   * Remove all references to the timeout listener as we've received an event
   * that can be used to determine state.
   *
   * @api private
   */
  function remove() {
    primus.removeListener('error', remove)
          .removeListener('open', remove)
          .removeListener('end', remove)
          .clearTimeout('connect');
  }

  primus.timers.connect = setTimeout(function setTimeout() {
    remove(); // Clean up old references.

    if (Primus.readyState === Primus.OPEN || primus.attempt) return;

    primus.emit('timeout');

    //
    // We failed to connect to the server.
    //
    if (~primus.options.strategy.indexOf('timeout')) primus.reconnect();
    else primus.end();
  }, primus.options.timeout);

  return primus.on('error', remove)
    .on('open', remove)
    .on('end', remove);
};

/**
 * Properly clean up all `setTimeout` references.
 *
 * @param {String} ..args.. The names of the timeout's we need clear.
 * @api private
 */
Primus.prototype.clearTimeout = function clear() {
  for (var args = arguments, i = 0, l = args.length; i < l; i++) {
    if (this.timers[args[i]]) clearTimeout(this.timers[args[i]]);
    delete this.timers[args[i]];
  }

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
Primus.prototype.backoff = function backoff(callback, opts) {
  opts = opts || {};

  var primus = this;

  //
  // Bailout when we already have a backoff process running. We shouldn't call
  // the callback then as it might cause an unexpected `end` event as another
  // reconnect process is already running.
  //
  if (opts.backoff) return primus;

  opts.maxDelay = opts.maxDelay || Infinity;  // Maximum delay.
  opts.minDelay = opts.minDelay || 500;       // Minimum delay.
  opts.retries = opts.retries || 10;          // Amount of allowed retries.
  opts.attempt = (+opts.attempt || 0) + 1;    // Current attempt.
  opts.factor = opts.factor || 2;             // Back off factor.

  //
  // Bailout if we are about to make to much attempts. Please note that we use
  // `>` because we already incremented the value above.
  //
  if (opts.attempt > opts.retries) {
    callback(new Error('Unable to retry'), opts);
    return primus;
  }

  //
  // Prevent duplicate back off attempts using the same options object.
  //
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
        (Math.random() + 1) * opts.minDelay * Math.pow(opts.factor, opts.attempt)
      ), opts.maxDelay)
    : opts.minDelay;

  //
  // Emit a `reconnecting` event with current reconnect options. This allows
  // them to update the UI and provide their users with feedback.
  //
  primus.emit('reconnecting', opts);

  primus.timers.reconnect = setTimeout(function delay() {
    opts.backoff = false;
    primus.clearTimeout('reconnect');

    callback(undefined, opts);
  }, opts.timeout);

  return primus;
};

/**
 * Start a new reconnect procedure.
 *
 * @api private
 */
Primus.prototype.reconnect = function reconnect() {
  var primus = this;

  //
  // Try to re-use the existing attempt.
  //
  primus.attempt = primus.attempt || primus.clone(primus.options.reconnect);

  primus.backoff(function attempt(fail, backoff) {
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

  return primus;
};

/**
 * Close the connection.
 *
 * @param {Mixed} data last packet of data.
 * @api public
 */
Primus.prototype.end = function end(data) {
  context(this, 'end');

  if (this.readyState === Primus.CLOSED && !this.timers.connect) return this;
  if (data) this.write(data);

  this.writable = false;
  this.readyState = Primus.CLOSED;

  for (var timeout in this.timers) {
    this.clearTimeout(timeout);
  }

  this.emit('outgoing::end');
  this.emit('close');
  this.emit('end');

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
  return this.merge({}, obj);
};

/**
 * Merge different objects in to one target object.
 *
 * @param {Object} target The object where everything should be merged in.
 * @returns {Object} Original target with all merged objects.
 * @api private
 */
Primus.prototype.merge = function merge(target) {
  var args = Array.prototype.slice.call(arguments, 1);

  for (var i = 0, l = args.length, key, obj; i < l; i++) {
    obj = args[i];

    for (key in obj) {
      if (obj.hasOwnProperty(key)) target[key] = obj[key];
    }
  }

  return target;
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
 * Parse a query string.
 *
 * @param {String} query The query string that needs to be parsed.
 * @returns {Object} Parsed query string.
 * @api public
 */
Primus.prototype.querystring = function querystring(query) {
  var parser = /([^=?&]+)=([^&]*)/g
    , result = {}
    , part;

  //
  // Little nifty parsing hack, leverage the fact that RegExp.exec increments
  // the lastIndex property so we can continue executing this loop until we've
  // parsed all results.
  //
  for (; part = parser.exec(query); result[part[1]] = part[2]);

  return result;
};

/**
 * Generates a connection URI.
 *
 * @param {String} protocol The protocol that should used to crate the URI.
 * @param {Boolean} querystring Do we need to include a query string.
 * @returns {String|options} The URL.
 * @api private
 */
Primus.prototype.uri = function uri(options, querystring) {
  var url = this.url
    , server = [];

  //
  // Backwards compatible with Primus 1.4.0
  // @TODO Remove me for Primus 2.0
  //
  if ('string' === typeof options) {
    options = { protocol: options };
    if (querystring) options.query = querystring;
  }

  options = options || {};
  options.protocol = 'protocol' in options ? options.protocol : 'http';
  options.query = url.search && 'query' in options ? (url.search.charAt(0) === '?' ? url.search.slice(1) : url.search) : false;
  options.secure = 'secure' in options ? options.secure : url.protocol === 'https:';
  options.auth = 'auth' in options ? options.auth : url.auth;
  options.pathname = 'pathname' in options ? options.pathname : this.pathname.slice(1);
  options.port = 'port' in options ? options.port : url.port || (options.secure ? 443 : 80);
  options.host = 'host' in options ? options.host : url.hostname || url.host.replace(':'+ url.port, '');

  //
  // Automatically suffix the protocol so we can supply `ws` and `http` and it gets
  // transformed correctly.
  //
  server.push(options.secure ? options.protocol +'s:' : options.protocol +':', '');

  if (options.auth) server.push(options.auth +'@'+ url.host);
  else server.push(url.host);

  //
  // Pathnames are optional as some Transformers would just use the pathname
  // directly.
  //
  if (options.pathname) server.push(options.pathname);

  //
  // Optionally add a search query, again, not supported by all Transformers.
  // SockJS is known to throw errors when a query string is included.
  //
  if (options.query) server.push('?'+ options.query);

  if (options.object) return options;
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
  context(this, 'transform');

  if (!(type in this.transformers)) throw new Error('Invalid transformer type');

  this.transformers[type].push(fn);
  return this;
};

/**
 * A critical error has occurred, if we have an `error` listener, emit it there.
 * If not, throw it, so we get a stack trace + proper error message.
 *
 * @param {Error} err The critical error.
 * @api private
 */
Primus.prototype.critical = function critical(err) {
  if (this.listeners('error').length) return this.emit('error', err);

  throw err;
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
// Expose the EventEmitter so it can be re-used by wrapping libraries we're also
// exposing the Stream interface.
//
Primus.EventEmitter = EventEmitter;

//
// These libraries are automatically are automatically inserted at the
// server-side using the Primus#library method.
//
Primus.prototype.client = null; // @import {primus::transport};
Primus.prototype.authorization = null; // @import {primus::auth};
Primus.prototype.pathname = null; // @import {primus::pathname};
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
  // cancel the operation before it bubbles up to the browsers default handler.
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
