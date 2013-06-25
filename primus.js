(function primus() {
  'use strict';

  /* {primus::library} */

  /**
   * Primus in a real-time library agnostic framework for establishing real-time
   * connections with servers.
   *
   * @param {String} url The url of your server.
   */
  function Primus(url) {
    if (!(this instanceof Primus)) return new Primus(url);

    this.events = {};             // Stores the events.
    this.backoff = {};            // Stores the backoff configuration.
    this.url = this.parse(url);

    this.initialise().connect();
  }

  /**
   * Initialise the Primus and setup all parsers and internal listeners.
   *
   * @api private
   */
  Primus.prototype.initialise = function initalise() {
    var primus = this;

    this.on('primus::data', function message(data) {
      primus.decoder(data, function decoding(err, packet) {
        //
        // Do a "save" emit('error') when we fail to parse a message. We don't
        // want to throw here as listening to errors should be optional.
        //
        if (err) return primus.listeners('error').length && socket.emit('error', err);
        primus.emit('data', packet);
      });
    });

    this.on('primus::end', function end() {
      this.reconnect(function (fail, backoff) {
        primus.backoff = backoff; // Save the opts again of this backoff.
        if (fail) return self.emit('end', fail);

        // Try to re-open the connection again.
        primus.emit('primus::reconnect');
      }, primus.backoff);
    });

    return this;
  };

  /**
   * Establish a connection with the server.
   *
   * @api private
   */
  Primus.prototype.connect = function connect() {
    this.emit('primus::connect', this.uri());
  };

  /**
   * Close the connection.
   *
   * @api public
   */
  Primus.prototype.end = function end() {

  };

  /**
   * Exponential backoff algorithm for retry aperations. It uses an randomized
   * retry so we don't DDOS our server when it goes down under presure.
   *
   * @param {Function} callback Callback to be called after the timeout.
   * @param {Object} opts Options for configuring the timeout.
   * @api private
   */
  Primus.prototype.backoff = function backoff(callback, opts) {
    opts = opts || {};

    opts.maxDelay = opts.maxDelay || Infinity;  // Maximum delay
    opts.minDelay = opts.minDelay || 500;       // Minimum delay
    opts.retries = opts.retries || 25;          // Amount of allowed retries
    opts.attempt = (+opts.attempt || 0) + 1;    // Current attempt
    opts.factor = opts.factor || 2;             // Backoff factor

    // Bailout if we are about to make to much attempts. Please note that we use
    // `>` because we already incremented the value above.
    if (opts.attempt > opts.retries || opts.backoff) {
      return callback(new Error('Unable to retry'), opts);
    }

    // Prevent duplicate backoff attempts.
    opts.backoff = true;

    // Calculate the timeout, but make it randomly so we don't retry connections
    // at the same interval and defeat the purpose. This exponential backoff is
    // based on the work of:
    //
    // http://dthain.blogspot.nl/2009/02/exponential-backoff-in-distributed.html
    opts.timeout = opts.attempt !== 1
      ? Math.min(Math.round(
          (Math.random() * 1) * opts.minDelay * Math.pow(opts.factor, opts.attempt)
        ), opts.maxDelay)
      : opts.minDelay;

    setTimeout(function delay() {
      opts.backoff = false;
      callback(undefined, opts);
    }, opts.timeout);

    return this;
  };

  /**
   * Parse the connection string.
   *
   * @param {String} url Connection url
   * @returns {Object} Parsed connection.
   * @api public
   */
  Primus.prototype.parse = function parse(url) {
    var a = document.createElement('a');
    a.href = url;

    return a;
  };

  /**
   * Generates a connection url.
   *
   * @returns {String} The url.
   * @api private
   */
  Primus.prototype.uri = function uri() {
    var server = [];

    server.push(this.url.protocol === 'https:' ? 'wss:' : 'ws:', '');
    server.push(this.url.host, this.pathname.slice(1));

    //
    // Optionally add a search query
    //
    if (this.url.search) server.push(this.url.search);
    return server.join('/');
  };

  /**
   * Emit an event to all registered event listeners.
   *
   * @param {String} event The name of the event.
   * @returns {Boolean} Indication if we've emitted an event.
   * @api public
   */
  Primus.prototype.emit = function emit(event) {
    if (!(event in this.events)) return false;

    var args = Array.prototype.slice.call(arguments, 1)
      , length = this.events[event].length
      , i = 0;

    for (; i < length; i++) {
      this.events[event][i].apply(this, args);
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
  Primus.prototype.on = function on(event, fn) {
    if (!(event in this.events)) this.events[event] = [];
    this.events[event].push(fn);

    return this;
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
      // mobile devices.
      //
      setTimeout(function timeout() {
        primus.emit('primus::'+ event, data);
      }, 0);
    };
  };

  //
  // These libraries are automatically are automatically inserted at the
  // serverside using the Primus#library method.
  //
  Primus.prototype.client = null; // @import {primus::transport};
  Primus.prototype.pathname = null; // @import {primus::pathname};
  Primus.prototype.encoder = null; // @import {primus::encoder};
  Primus.prototype.decoder = null; // @import {primus::decoder};
  Primus.prototype.version = null; // @import {primus::version};
})(this);
