'use strict';

var EventEmitter = require('events').EventEmitter
  , PrimusError = require('./errors').PrimusError
  , Transformer = require('./transformer')
  , Spark = require('./spark')
  , fs = require('fs');

/**
 * Primus is a universal wrapper for real-time frameworks that provides a common
 * interface for server and client interaction.
 *
 * @constructor
 * @param {HTTP.Server} server HTTP or HTTPS server instance.
 * @param {Object} options Configuration
 * @api public
 */
function Primus(server, options) {
  if (!(this instanceof Primus)) return new Primus(server, options);

  options = options || {};
  var primus = this;

  this.transformer = null;                    // Reference to the real-time engine instance.
  this.encoder = null;                        // Shorthand to the parser's encoder.
  this.decoder = null;                        // Shorthand to the parser's decoder.
  this.auth = options.authorization || null;  // Do we have an authorization handler.
  this.sparks = 0;                            // Increment id for connection ids.
  this.connected = 0;                         // Connection counter .
  this.connections = Object.create(null);     // Connection storage.
  this.ark = Object.create(null);             // Plugin storage.
  this.whitelist = [];                        // Forwarded-for whitelisting.
  this.options = options;                     // The configuration.
  this.transformers = {                       // Message transformers.
    outgoing: [],
    incoming: []
  };

  this.server = server;
  this.pathname = options.pathname || '/primus';

  //
  // Create a specification file with the information that people might need to
  // connect to the server.
  //
  this.spec = {
    version: this.version,
    pathname: this.pathname
  };

  //
  // Create a pre-bound Spark constructor. Doing a Spark.bind(Spark, this) doesn't
  // work as we cannot extend the constructor of it anymore. The added benefit of
  // approach listed below is that the prototype extensions are only applied to
  // the Spark of this Primus instance.
  //
  this.Spark = function Sparky(headers, address, query, id) {
    Spark.call(this, primus, headers, address, query, id);
  };

  this.Spark.prototype = Object.create(Spark.prototype, {
    constructor: {
      value: this.Spark,
      writable: true,
      enumerable: false,
      configurable: true
    }
  });

  this.parsers(options.parser);
  this.initialise(options.transformer || options.transport, options);

  //
  // If the plugins are supplied through the options, also initialise them. This
  // allows us to do `primus.createSocket({})` to also use plugins.
  //
  if ('object' === typeof options.plugin) for (var key in options.plugin) {
    this.use(key, options.plugin[key]);
  }
}

Primus.prototype.__proto__ = EventEmitter.prototype;

//
// Lazy read the primus.js JavaScript client.
//
Object.defineProperty(Primus.prototype, 'client', {
  get: function read() {
    read.primus = read.primus || fs.readFileSync(__dirname + '/primus.js', 'utf-8');
    return read.primus;
  }
});

//
// Lazy compile the primus.js JavaScript client for Node.js
//
Object.defineProperty(Primus.prototype, 'Socket', {
  get: function () {
    return require('load').compiler(this.library(true), 'primus.js', {
      __filename: 'primus.js',
      __dirname: __dirname
    }).Primus;
  }
});

//
// Expose the current version number.
//
Primus.prototype.version = require('./package.json').version;

//
// A list of supported transformers and the required Node.js modules.
//
Primus.transformers = require('./transformers.json');
Primus.parsers = require('./parsers.json');

/**
 * Simple function to output common errors.
 *
 * @param {String} what What is missing.
 * @param {Object} where Either Primus.parsers or Primus.transformers.
 * @returns {Object}
 * @api private
 */
Primus.prototype.is = function is(what, where) {
  var missing = Primus.parsers !== where
      ? 'transformer'
      : 'parser'
    , dependency = where[what];

  return {
    missing: function write() {
      console.error('Primus:');
      console.error('Primus: Missing required npm dependency for '+ what);
      console.error('Primus: Please run the following command and try again:');
      console.error('Primus:');
      console.error('Primus:   npm install --save %s', dependency.server);
      console.error('Primus:');

      return 'Missing dependencies for '+ missing +': "'+ what + '"';
    },

    unknown: function write() {
      console.error('Primus:');
      console.error('Primus: Unsupported %s: "%s"', missing, what);
      console.error('Primus: We only support the following %ss:', missing);
      console.error('Primus:');
      console.error('Primus:   %s', Object.keys(where).join(', '));
      console.error('Primus:');

      return 'Unsupported '+ missing +': "'+ what +'"';
    }
  };
};

/**
 * Initialise the real-time transport that was chosen.
 *
 * @param {Mixed} Transformer The name of the transformer or a constructor;
 * @param {Object} options Options.
 * @api private
 */
Primus.prototype.initialise = function initialise(Transformer, options) {
  Transformer = Transformer || 'websockets';

  var primus = this
    , transformer;

  if ('string' === typeof Transformer) {
    Transformer = transformer = Transformer.toLowerCase();
    this.spec.transformer = transformer;

    //
    // This is a unknown transporter, it could be people made a typo.
    //
    if (!(Transformer in Primus.transformers)) {
      throw new PrimusError(this.is(Transformer, Primus.transformers).unknown(), this);
    }

    try {
      Transformer = require('./transformers/'+ transformer);
      this.transformer = new Transformer(this);
    } catch (e) {
      if (e.code === 'MODULE_NOT_FOUND') {
        throw new PrimusError(this.is(transformer, Primus.transformers).missing(), this);
      } else {
        throw e;
      }
    }
  } else {
    this.spec.transformer = 'custom';
  }

  if ('function' !== typeof Transformer) {
    throw new PrimusError('The given transformer is not a constructor', this);
  }

  this.transformer = this.transformer || new Transformer(this);

  this.on('connection', function connection(stream) {
    this.connected++;
    this.connections[stream.id] = stream;
  });

  this.on('disconnection', function disconnected(stream) {
    this.connected--;
    delete this.connections[stream.id];
  });

  //
  // Emit the initialised event after the next tick so we have some time to
  // attach listeners.
  //
  process.nextTick(function tock() {
    primus.emit('initialised', primus.transformer, primus.parser, options);
  });
};

/**
 * Add a new authorization handler.
 *
 * @param {Function} auth The authorization handler.
 * @api public
 */
Primus.prototype.authorize = function authorize(auth) {
  if ('function' !== typeof auth) {
    throw new PrimusError('Authorize only accepts functions', this);
  }

  if (auth.length < 2) {
    throw new PrimusError('Authorize function requires more arguments', this);
  }

  this.auth = auth;
  return this;
};

/**
 * Iterate over the connections.
 *
 * @param {Function} fn The function that is called every iteration.
 * @api public
 */
Primus.prototype.forEach = function forEach(fn) {
  for (var stream in this.connections) {
    fn(this.connections[stream], stream, this.connections);
  }

  return this;
};

/**
 * Broadcast the message to all connections.
 *
 * @param {Mixed} data The data you want to send.
 * @api public
 */
Primus.prototype.write = function write(data) {
  this.forEach(function forEach(spark) {
    spark.write(data);
  });

  return this;
};

/**
 * Install message parsers.
 *
 * @param {Mixed} parser Parse name or parser Object.
 * @api private
 */
Primus.prototype.parsers = function parsers(parser) {
  parser = parser || 'json';

  if ('string' === typeof parser) {
    parser = parser.toLowerCase();
    this.spec.parser = parser;

    //
    // This is a unknown parser, it could be people made a typo.
    //
    if (!(parser in Primus.parsers)) {
      throw new PrimusError(this.is(parser, Primus.parsers).unknown(), this);
    }

    try { parser = require('./parsers/'+ parser); }
    catch (e) {
      if (e.code === 'MODULE_NOT_FOUND') {
        throw new PrimusError(this.is(parser, Primus.parsers).missing(), this);
      } else {
        throw e;
      }
    }
  } else {
    this.spec.parser = 'custom';
  }

  if ('object' !== typeof parser) {
    throw new PrimusError('The given parser is not an Object', this);
  }

  this.encoder = parser.encoder;
  this.decoder = parser.decoder;
  this.parser = parser;

  return this;
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
  if (!(type in this.transformers)) {
    throw new PrimusError('Invalid transformer type', this);
  }

  if (~this.transformers[type].indexOf(fn)) return this;

  this.transformers[type].push(fn);
  return this;
};

/**
 * Generate a client library.
 *
 * @param {Boolean} nodejs Don't include the library, as we're running on Node.js.
 * @returns {String} The client library.
 * @api public
 */
Primus.prototype.library = function compile(nodejs) {
  var encoder = this.encoder.client || this.encoder
    , decoder = this.decoder.client || this.decoder
    , library = [ !nodejs ? this.transformer.library : null ]
    , transport = this.transformer.client
    , parser = this.parser.library || '';

  //
  // Add a simple export wrapper so it can be used as Node.js, AMD or browser
  // client.
  //
  var client = '(function (name, context, definition) {'
    + '  context[name] = definition();'
    + '  if (typeof module !== "undefined" && module.exports) {'
    + '    module.exports = context[name];'
    + '  } else if (typeof define == "function" && define.amd) {'
    + '    define(definition);'
    + '  }'
    + '})("Primus", this, function PRIMUS() {'
    + this.client;

  //
  // Replace some basic content.
  //
  client = client
    .replace('null; // @import {primus::pathname}', '"'+ this.pathname.toString() +'"')
    .replace('null; // @import {primus::version}', '"'+ this.version +'"')
    .replace('null; // @import {primus::transport}', transport.toString())
    .replace('null; // @import {primus::auth}', (!!this.auth).toString())
    .replace('null; // @import {primus::encoder}', encoder.toString())
    .replace('null; // @import {primus::decoder}', decoder.toString());

  //
  // Add the parser inside the closure, to prevent global leaking.
  //
  if (parser && parser.length) client += parser;

  //
  // Iterate over the parsers, and register the client side plugins. If there's
  // a library bundled, add it the library array as there were some issues with
  // frameworks that get included in module wrapper as it forces strict mode.
  //
  var name, plugin;
  for (name in this.ark) {
    plugin = this.ark[name];
    name = JSON.stringify(name);

    if (!plugin.client) continue;
    if (plugin.library) library.push(plugin.library);

    client += 'Primus.prototype.ark['+ name +'] = '+ plugin.client.toString() + '\n';
  }

  //
  // Close the export wrapper and return the client. If we need to add
  // a library, we should add them after we've created our closure and module
  // exports. Some libraries seem to fail hard once they are wrapped in our
  // closure so I'll rather expose a global variable instead of having to monkey
  // patch to much code.
  //
  return client +' return Primus; });'+ library.filter(Boolean).join('\n');
};

/**
 * Save the library to disk.
 *
 * @param {String} dir The location that we need to save the library.
 * @param {function} fn Optional callback, if you want an async save.
 * @api public
 */
Primus.prototype.save = function save(path, fn) {
  if (!fn) fs.writeFileSync(path, this.library(), 'utf-8');
  else fs.writeFile(path, this.library(), 'utf-8', fn);

  return this;
};

/**
 * Register a new Primus plugin.
 *
 * ```js
 * primus.use('ack', {
 *   //
 *   // Only ran on the server.
 *   //
 *   server: function (primus, options) {
 *      // do stuff
 *   },
 *
 *   //
 *   // Runs on the client, it's automatically bundled.
 *   //
 *   client: function (primus, options) {
 *      // do client stuff
 *   },
 *
 *   //
 *   // Optional library that needs to be bundled on the client (should be a string)
 *   //
 *   library: ''
 * });
 * ```
 *
 * @param {String} name The name of the plugin.
 * @param {Object} energon The plugin that contains client and server extensions.
 * @api public
 */
Primus.prototype.use = function use(name, energon) {
  if ('object' === typeof name && !energon) {
    energon = name;
    name = energon.name;
  }

  if (!name) {
    throw new PrimusError('Plugin should be specified with a name', this);
  }

  if ('string' !== typeof name) {
    throw new PrimusError('Plugin names should be a string', this);
  }

  if ('string' === typeof energon) energon = require(energon);

  //
  // Plugin accepts an object or a function only.
  //
  if (!/^(object|function)$/.test(typeof energon)) {
    throw new PrimusError('Plugin should be an object or function', this);
  }

  //
  // Plugin require a client, server or both to be specified in the object.
  //
  if (!('server' in energon || 'client' in energon)) {
    throw new PrimusError('The plugin in missing a client or server function', this);
  }

  if (name in this.ark) {
    throw new PrimusError('The plugin name was already defined', this);
  }

  this.ark[name] = energon;
  if (!energon.server) return this;

  energon.server.call(this, this, this.options);
  return this;
};

/**
 * Return the given plugin.
 *
 * @param {String} name The name of the plugin.
 * @returns {Mixed}
 * @api public
 */
Primus.prototype.plugin = function plugin(name) {
  if (name) return this.ark[name];

  var plugins = {};

  for (name in this.ark) {
    plugins[name] = this.ark[name];
  }

  return plugins;
};

/**
 * Destroy the created Primus instance.
 *
 * Options:
 * - close (boolean)  Close the given server.
 * - end (boolean)    Shut down all active connections.
 * - timeout (number) Forcefully close all connections after a given x MS.
 *
 * @param {Object} options Destruction instructions.
 * @param {Function} fn Callback.
 * @api public
 */
Primus.prototype.destroy = Primus.prototype.end = function destroy(options, fn) {
  if ('function' === typeof options) {
    fn = options;
    options = null;
  }

  options = options || {};
  var primus = this;

  /**
   * Clean up connections that are left open.
   *
   * @api private
   */
  function cleanup() {
    if (options.end !== false) {
      primus.forEach(function shutdown(spark) {
        spark.end();
      });
    }

    //
    // Emit some final closing events right before we remove all listener
    // references from all the event emitters.
    //
    primus.emit('close', options);
    primus.transformer.emit('close', options);

    if (fn && options.close === false) fn();
  }

  if (options.close !== false) {
    primus.server.close(function closed() {
      primus.transformer.removeAllListeners();
      primus.server.removeAllListeners();
      primus.removeAllListeners();

      //
      // Null some potentially heavy objects to free some more memory instantly
      //
      primus.transformers.outgoing.length = primus.transformers.incoming.length = 0;
      primus.transformer = primus.encoder = primus.decoder = primus.server = null;
      primus.sparks = primus.connected = 0;

      primus.connections = Object.create(null);
      primus.ark = Object.create(null);

      if (fn) fn();
    });
  }

  if (+options.timeout) {
    setTimeout(cleanup, +options.timeout);
  } else {
    cleanup();
  }

  return this;
};

/**
 * Add a createSocket interface so we can create a Server client with the
 * specified `transformer` and `parser`.
 *
 * ```js
 * var Socket = Primus.createSocket({ transformer: transformer, parser: parser })
 *   , socket = new Socket(url);
 * ```
 *
 * @param {Object} options The transformer / parser we need.
 * @returns {Socket}
 * @api public
 */
Primus.createSocket = function createSocket(options) {
  options = options || {};

  var primus = new Primus(new EventEmitter(), options);
  return primus.Socket;
};

//
// Expose the constructors of our Spark and Transformer so it can be extended by
// a third party if needed.
//
Primus.Transformer = Transformer;
Primus.Spark = Spark;

//
// Expose the module.
//
module.exports = Primus;
