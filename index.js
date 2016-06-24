'use strict';

var PrimusError = require('./errors').PrimusError
  , EventEmitter = require('eventemitter3')
  , Transformer = require('./transformer')
  , log = require('diagnostics')('primus')
  , Spark = require('./spark')
  , fuse = require('fusing')
  , fs = require('fs')
  , vm = require('vm');

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
  if ('object' !== typeof server) {
    var message = 'The first argument of the constructor must be ' +
      'an HTTP or HTTPS server instance';
    throw new PrimusError(message, this);
  }

  options = options || {};
  options.maxLength = options.maxLength || 10485760;  // Maximum allowed packet size.
  options.transport = options.transport || {};        // Transformer specific options.
  options.timeout = 'timeout' in options              // Heartbeat timeout.
    ? options.timeout
    : 35000;

  this.fuse();

  var primus = this
    , key;

  this.auth = options.authorization || null;  // Do we have an authorization handler.
  this.connections = Object.create(null);     // Connection storage.
  this.ark = Object.create(null);             // Plugin storage.
  this.layers = [];                           // Middleware layers.
  this.transformer = null;                    // Reference to the real-time engine instance.
  this.encoder = null;                        // Shorthand to the parser's encoder.
  this.decoder = null;                        // Shorthand to the parser's decoder.
  this.connected = 0;                         // Connection counter.
  this.whitelist = [];                        // Forwarded-for white listing.
  this.options = options;                     // The configuration.
  this.transformers = {                       // Message transformers.
    outgoing: [],
    incoming: []
  };

  this.server = server;
  this.pathname = 'string' === typeof options.pathname
    ? options.pathname.charAt(0) !== '/'
      ? '/'+ options.pathname
      : options.pathname
    : '/primus';

  //
  // Create a specification file with the information that people might need to
  // connect to the server.
  //
  this.spec = {
    timeout: options.timeout,
    pathname: this.pathname,
    version: this.version
  };

  //
  // Create a pre-bound Spark constructor. Doing a Spark.bind(Spark, this) doesn't
  // work as we cannot extend the constructor of it anymore. The added benefit of
  // approach listed below is that the prototype extensions are only applied to
  // the Spark of this Primus instance.
  //
  this.Spark = function Sparky(headers, address, query, id, request) {
    Spark.call(this, primus, headers, address, query, id, request);
  };

  this.Spark.prototype = Object.create(Spark.prototype, {
    constructor: {
      configurable: true,
      value: this.Spark,
      writable: true
    },
    __initialise: {
      value: Spark.prototype.__initialise.slice(),
      configurable: true,
      writable: true
    }
  });

  //
  // Copy over the original Spark static properties and methods so readable and
  // writable can also be used.
  //
  for (key in Spark) {
    this.Spark[key] = Spark[key];
  }

  this.parsers(options.parser);
  this.initialise(options.transformer, options);

  //
  // If the plugins are supplied through the options, also initialise them.
  // This also allows us to use plugins when creating a client constructor
  // with the `Primus.createSocket({})` method.
  //
  if ('string' === typeof options.plugin) {
    options.plugin.split(/[, ]+/).forEach(function register(name) {
      primus.plugin(name, name);
    });
  } else if ('object' === typeof options.plugin) {
    for (key in options.plugin) {
      this.plugin(key, options.plugin[key]);
    }
  }

  //
  // - Cluster node 0.10 lets the Operating System decide to which worker a request
  //   goes. This can result in a not even distribution where some workers are
  //   used at 10% while others at 90%. In addition to that the load balancing
  //   isn't sticky.
  //
  // - Cluster node 0.12 implements a custom round robin algorithm. This solves the
  //   not even distribution of work but it does not address our sticky session
  //   requirement.
  //
  // Projects like `sticky-session` attempt to implement sticky sessions but they
  // are using `net` server instead of a HTTP server in combination with the
  // remoteAddress of the connection to load balance. This does not work when you
  // address your servers behind a load balancer as the IP is set to the load
  // balancer, not the connecting clients. All in all, it only causes more
  // scalability problems. So we've opted-in to warn users about the
  // risks of using Primus in a cluster.
  //
  if (!options.iknowclusterwillbreakconnections && require('cluster').isWorker) [
    '',
    'The `cluster` module does not implement sticky sessions. Learn more about',
    'this issue at:',
    '',
    'http://github.com/primus/primus#can-i-use-cluster',
    ''
  ].forEach(function warn(line) {
    console.error('Primus: '+ line);
  });
}

//
// Fuse and spice-up the Primus prototype with EventEmitter and predefine
// awesomeness.
//
fuse(Primus, EventEmitter);

//
// Lazy read the primus.js JavaScript client.
//
Object.defineProperty(Primus.prototype, 'client', {
  get: function read() {
    if (!read.primus) {
      read.primus = fs.readFileSync(__dirname + '/dist/primus.js', 'utf-8');
    }

    return read.primus;
  }
});

//
// Lazy compile the primus.js JavaScript client for Node.js
//
Object.defineProperty(Primus.prototype, 'Socket', {
  get: function () {
    var sandbox = vm.createContext({
      clearImmediate: clearImmediate,
      clearInterval: clearInterval,
      clearTimeout: clearTimeout,
      setImmediate: setImmediate,
      __dirname: process.cwd(),
      setInterval: setInterval,
      __filename: 'primus.js',
      setTimeout: setTimeout,
      console: console,
      process: process,
      require: require,
      Buffer: Buffer,

      //
      // The following globals are introduced so libraries that use `instanceof`
      // checks for type checking do not fail as the code is run in a new
      // context.
      //
      Uint8Array: Uint8Array,
      Object: Object,
      RegExp: RegExp,
      Array: Array,
      Error: Error,
      Date: Date
    });

    vm.runInContext(this.library(true), sandbox, 'primus.js');
    return sandbox.Primus;
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
Primus.readable('is', function is(what, where) {
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
});

/**
 * Initialise the real-time engine that was chosen.
 *
 * @param {Mixed} Transformer The name of the transformer or a constructor;
 * @param {Object} options Options.
 * @api private
 */
Primus.readable('initialise', function initialise(Transformer, options) {
  Transformer = Transformer || 'websockets';

  var primus = this
    , transformer;

  if ('string' === typeof Transformer) {
    log('transformer `%s` is a string, attempting to resolve location', Transformer);
    Transformer = transformer = Transformer.toLowerCase();
    this.spec.transformer = transformer;

    //
    // This is a unknown transformer, it could be people made a typo.
    //
    if (!(Transformer in Primus.transformers)) {
      log('the supplied transformer %s is not supported, please use %s', transformer, Primus.transformers);
      throw new PrimusError(this.is(Transformer, Primus.transformers).unknown(), this);
    }

    try {
      Transformer = require('./transformers/'+ transformer);
      this.transformer = new Transformer(this);
    } catch (e) {
      if (e.code === 'MODULE_NOT_FOUND') {
        log('the supplied transformer `%s` is missing', transformer);
        throw new PrimusError(this.is(transformer, Primus.transformers).missing(), this);
      } else {
        log(e);
        throw e;
      }
    }
  } else {
    log('received a custom transformer');
    this.spec.transformer = 'custom';
  }

  if ('function' !== typeof Transformer) {
    throw new PrimusError('The given transformer is not a constructor', this);
  }

  this.transformer = this.transformer || new Transformer(this);

  this.on('connection', function connection(stream) {
    this.connected++;
    this.connections[stream.id] = stream;

    log('connection: %s currently serving %d concurrent', stream.id, this.connected);
  });

  this.on('disconnection', function disconnected(stream) {
    this.connected--;
    delete this.connections[stream.id];

    log('disconnection: %s currently serving %d concurrent', stream.id, this.connected);
  });

  //
  // Add our default middleware layers.
  //
  this.use('forwarded', require('./middleware/forwarded'));
  this.use('cors', require('./middleware/access-control'));
  this.use('primus.js', require('./middleware/primus'));
  this.use('spec', require('./middleware/spec'));
  this.use('x-xss', require('./middleware/xss'));
  this.use('no-cache', require('./middleware/no-cache'));
  this.use('authorization', require('./middleware/authorization'));

  //
  // Emit the initialised event after the next tick so we have some time to
  // attach listeners.
  //
  process.nextTick(function tock() {
    primus.emit('initialised', primus.transformer, primus.parser, options);
  });
});

/**
 * Add a new authorization handler.
 *
 * @param {Function} auth The authorization handler.
 * @returns {Primus}
 * @api public
 */
Primus.readable('authorize', function authorize(auth) {
  if ('function' !== typeof auth) {
    throw new PrimusError('Authorize only accepts functions', this);
  }

  if (auth.length < 2) {
    throw new PrimusError('Authorize function requires more arguments', this);
  }

  log('setting an authorization function');
  this.auth = auth;
  return this;
});

/**
 * Iterate over the connections.
 *
 * @param {Function} fn The function that is called every iteration.
 * @param {Function} done Optional callback, if you want to iterate asynchronously.
 * @returns {Primus}
 * @api public
 */
Primus.readable('forEach', function forEach(fn, done) {
  if (!done) {
    for (var id in this.connections) {
      if (fn(this.spark(id), id, this.connections) === false) break;
    }

    return this;
  }

  var ids = Object.keys(this.connections)
    , primus = this;

  log('iterating over %d connections', ids.length);

  function pushId(spark) {
    ids.push(spark.id);
  }

  //
  // We are going to iterate through the connections asynchronously so
  // we should handle new connections as they come in.
  //
  primus.on('connection', pushId);

  (function iterate() {
    var id = ids.shift()
      , spark;

    if (!id) {
      primus.removeListener('connection', pushId);
      return done();
    }

    spark = primus.spark(id);

    //
    // The connection may have already been closed.
    //
    if (!spark) return iterate();

    fn(spark, function next(err, forward) {
      if (err || forward === false) {
        primus.removeListener('connection', pushId);
        return done(err);
      }

      iterate();
    });
  }());

  return this;
});

/**
 * Broadcast the message to all connections.
 *
 * @param {Mixed} data The data you want to send.
 * @returns {Primus}
 * @api public
 */
Primus.readable('write', function write(data) {
  this.forEach(function forEach(spark) {
    spark.write(data);
  });

  return this;
});

/**
 * Install message parsers.
 *
 * @param {Mixed} parser Parse name or parser Object.
 * @returns {Primus}
 * @api private
 */
Primus.readable('parsers', function parsers(parser) {
  parser = parser || 'json';

  if ('string' === typeof parser) {
    log('transformer `%s` is a string, attempting to resolve location', parser);
    parser = parser.toLowerCase();
    this.spec.parser = parser;

    //
    // This is a unknown parser, it could be people made a typo.
    //
    if (!(parser in Primus.parsers)) {
      log('the supplied parser `%s` is not supported please use %s', parser, Primus.parsers);
      throw new PrimusError(this.is(parser, Primus.parsers).unknown(), this);
    }

    try { parser = require('./parsers/'+ parser); }
    catch (e) {
      if (e.code === 'MODULE_NOT_FOUND') {
        log('the supplied parser `%s` is missing', parser);
        throw new PrimusError(this.is(parser, Primus.parsers).missing(), this);
      } else {
        log(e);
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
});

/**
 * Register a new message transformer. This allows you to easily manipulate incoming
 * and outgoing data which is particularity handy for plugins that want to send
 * meta data together with the messages.
 *
 * @param {String} type Incoming or outgoing
 * @param {Function} fn A new message transformer.
 * @returns {Primus}
 * @api public
 */
Primus.readable('transform', function transform(type, fn) {
  if (!(type in this.transformers)) {
    throw new PrimusError('Invalid transformer type', this);
  }

  if (~this.transformers[type].indexOf(fn)) {
    log('the %s message transformer already exists, not adding it', type);
    return this;
  }

  this.transformers[type].push(fn);
  return this;
});

/**
 * Gets a spark by its id.
 *
 * @param {String} id The spark's id.
 * @returns {Spark}
 * @api private
 */
Primus.prototype.spark = function spark(id) {
  return this.connections[id];
};

/**
 * Generate a client library.
 *
 * @param {Boolean} nodejs Don't include the library, as we're running on Node.js.
 * @returns {String} The client library.
 * @api public
 */
Primus.readable('library', function compile(nodejs) {
  var library = [ !nodejs ? this.transformer.library : null ]
    , global = this.options.global || 'Primus'
    , parser = this.parser.library || ''
    , client = this.client;

  //
  // Add a simple export wrapper so it can be used as Node.js, AMD or browser
  // client.
  //
  client = [
    '(function UMDish(name, context, definition, plugins) {',
    '  context[name] = definition.call(context);',
    '  for (var i = 0; i < plugins.length; i++) {',
    '    plugins[i](context[name])',
    '  }',
    '  if (typeof module !== "undefined" && module.exports) {',
    '    module.exports = context[name];',
    '  } else if (typeof define === "function" && define.amd) {',
    '    define(function reference() { return context[name]; });',
    '  }',
    '})("'+ global +'", this || {}, function wrapper() {',
    '  var define, module, exports',
    '    , Primus = '+ client.slice(client.indexOf('return ') + 7, -4) +';',
    ''
  ].join('\n');

  //
  // Replace some basic content.
  //
  client = client
    .replace('null; // @import {primus::pathname}', '"'+ this.pathname.toString() +'"')
    .replace('null; // @import {primus::version}', '"'+ this.version +'"')
    .replace('null; // @import {primus::client}', this.transformer.client.toString())
    .replace('null; // @import {primus::auth}', (!!this.auth).toString())
    .replace('null; // @import {primus::encoder}', this.encoder.toString())
    .replace('null; // @import {primus::decoder}', this.decoder.toString());

  //
  // As we're given a timeout value on the server side, we need to update the
  // `ping` interval of the client to ensure that we've sent the server
  // a message before the timeout gets triggered and we get disconnected.
  //
  if (this.options.timeout) {
    log('updating the default value of the client `ping` option');
    client = client.replace(
      'options.ping : 25e3;',
      'options.ping : '+ (this.options.timeout - 10000) +';'
    );
  } else {
    log('setting the default value of the client `ping` option to `false`');
    client = client.replace('options.ping : 25e3;', 'options.ping : false;');
  }

  //
  // Add the parser inside the closure, to prevent global leaking.
  //
  if (parser && parser.length) {
    log('adding parser to the client file');
    client += parser;
  }

  //
  // Iterate over the parsers, and register the client side plugins. If there's
  // a library bundled, add it the library array as there were some issues with
  // frameworks that get included in module wrapper as it forces strict mode.
  //
  var name, plugin;

  for (name in this.ark) {
    plugin = this.ark[name];
    name = JSON.stringify(name);

    if (plugin.library) {
      log('adding the library of the %s plugin to the client file', name);
      library.push(plugin.library);
    }

    if (!plugin.client) continue;

    log('adding the client code of the %s plugin to the client file', name);
    client += 'Primus.prototype.ark['+ name +'] = '+ plugin.client.toString() +';\n';
  }

  //
  // Close the export wrapper and return the client. If we need to add
  // a library, we should add them after we've created our closure and module
  // exports. Some libraries seem to fail hard once they are wrapped in our
  // closure so I'll rather expose a global variable instead of having to monkey
  // patch too much code.
  //
  return client + [
    '  return Primus;',
    '},',
    '['
  ].concat(library.filter(Boolean).map(function expose(library) {
    return [
      'function (Primus) {',
      library,
      '}'
    ].join('\n');
  }).join(',\n'))
  .concat(']);')
  .join('\n');
});

/**
 * Save the library to disk.
 *
 * @param {String} dir The location that we need to save the library.
 * @param {function} fn Optional callback, if you want an async save.
 * @returns {Primus}
 * @api public
 */
Primus.readable('save', function save(path, fn) {
  if (!fn) fs.writeFileSync(path, this.library(), 'utf-8');
  else fs.writeFile(path, this.library(), 'utf-8', fn);

  return this;
});

/**
 * Register a new Primus plugin.
 *
 * ```js
 * primus.plugin('ack', {
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
 * @returns {Mixed}
 * @api public
 */
Primus.readable('plugin', function plugin(name, energon) {
  if (!name) return this.ark;

  if (!energon) {
    if ('string' === typeof name) return this.ark[name];
    if ('object' === typeof name) {
      energon = name;
      name = energon.name;
    }
  }

  if ('string' !== typeof name || !name) {
    throw new PrimusError('Plugin name must be a non empty string', this);
  }

  if ('string' === typeof energon) {
    log('plugin was passed as a string, attempting to require %s', energon);
    energon = require(energon);
  }

  //
  // Plugin accepts an object or a function only.
  //
  if (!/^(object|function)$/.test(typeof energon)) {
    throw new PrimusError('Plugin should be an object or function', this);
  }

  //
  // Plugin require a client, server or both to be specified in the object.
  //
  if (!energon.server && !energon.client) {
    throw new PrimusError('Plugin is missing a client or server function', this);
  }

  //
  // Don't allow duplicate plugins or plugin override as this is most likely
  // unintentional.
  //
  if (name in this.ark) {
    throw new PrimusError('Plugin name already defined', this);
  }

  log('adding %s as new plugin', name);
  this.ark[name] = energon;
  this.emit('plugin', name, energon);

  if (!energon.server) return this;

  log('calling the %s plugin\'s server code', name);
  energon.server.call(this, this, this.options);

  return this;
});

/**
 * Remove plugin from the ark.
 *
 * @param {String} name Name of the plugin we need to remove from the ark.
 * @returns {Boolean} Successful removal of the plugin.
 * @api public
 */
Primus.readable('plugout', function plugout(name) {
  if (!(name in this.ark)) return false;

  this.emit('plugout', name, this.ark[name]);
  delete this.ark[name];

  return true;
});

/**
 * Add a new middleware layer. If no middleware name has been provided we will
 * attempt to take the name of the supplied function. If that fails, well fuck,
 * just random id it.
 *
 * @param {String} name The name of the middleware.
 * @param {Function} fn The middleware that's called each time.
 * @param {Object} options Middleware configuration.
 * @param {Number} level 0 based optional index for the middleware.
 * @returns {Primus}
 * @api public
 */
Primus.readable('use', function use(name, fn, options, level) {
  if ('function' === typeof name) {
    level = options;
    options = fn;
    fn = name;
    name = fn.name || 'pid_'+ Date.now();
  }

  if (!level && 'number' === typeof options) {
    level = options;
    options = {};
  }

  options = options || {};

  //
  // No or only 1 argument means that we need to initialise the middleware, this
  // is a special initialisation process where we pass in a reference to the
  // initialised Primus instance so a pre-compiling process can be done.
  //
  if (fn.length < 2) {
    log('automatically configuring middleware `%s`', name);
    fn = fn.call(this, options);
  }

  //
  // Make sure that we have a function that takes at least 2 arguments.
  //
  if ('function' !== typeof fn || fn.length < 2) {
    throw new PrimusError('Middleware should be a function that accepts at least 2 args');
  }

  var layer = {
    length: fn.length,                // Amount of arguments indicates if it's async.
    enabled: true,                    // Middleware is enabled by default.
    name: name,                       // Used for lookups.
    fn: fn                            // The actual middleware.
  }, index = this.indexOfLayer(name);

  //
  // Override middleware layer if we already have a middleware layer with
  // exactly the same name.
  //
  if (!~index) {
    if (level >= 0 && level < this.layers.length) {
      log('adding middleware `%s` to the supplied index at %d', name, level);
      this.layers.splice(level, 0, layer);
    } else {
      this.layers.push(layer);
    }
  } else {
    this.layers[index] = layer;
  }

  return this;
});

/**
 * Remove a middleware layer from the stack.
 *
 * @param {String} name The name of the middleware.
 * @returns {Primus}
 * @api public
 */
Primus.readable('remove', function remove(name) {
  var index = this.indexOfLayer(name);

  if (~index) {
    log('removing middleware `%s`', name);
    this.layers.splice(index, 1);
  }

  return this;
});

/**
 * Enable a given middleware layer.
 *
 * @param {String} name The name of the middleware.
 * @returns {Primus}
 * @api public
 */
Primus.readable('enable', function enable(name) {
  var index = this.indexOfLayer(name);

  if (~index) {
    log('enabling middleware `%s`', name);
    this.layers[index].enabled = true;
  }
  return this;
});

/**
 * Disable a given middleware layer.
 *
 * @param {String} name The name of the middleware.
 * @returns {Primus}
 * @api public
 */
Primus.readable('disable', function disable(name) {
  var index = this.indexOfLayer(name);

  if (~index) {
    log('disabling middleware `%s`', name);
    this.layers[index].enabled = false;
  }

  return this;
});

/**
 * Find the index of a given middleware layer by name.
 *
 * @param {String} name The name of the layer.
 * @returns {Number}
 * @api private
 */
Primus.readable('indexOfLayer', function indexOfLayer(name) {
  for (var i = 0, length = this.layers.length; i < length; i++) {
    if (this.layers[i].name === name) return i;
  }

  return -1;
});

/**
 * Destroy the created Primus instance.
 *
 * Options:
 * - close (boolean) Close the given server.
 * - reconnect (boolean) Trigger a client-side reconnect.
 * - timeout (number) Close all active connections after x milliseconds.
 *
 * @param {Object} options Destruction instructions.
 * @param {Function} fn Callback.
 * @returns {Primus}
 * @api public
 */
Primus.readable('destroy', function destroy(options, fn) {
  if ('function' === typeof options) {
    fn = options;
    options = null;
  }

  options = options || {};
  if (options.reconnect) options.close = true;

  var primus = this;

  setTimeout(function close() {
    var transformer = primus.transformer;

    //
    // Ensure that the transformer receives the `close` event only once.
    //
    if (transformer) transformer.ultron.destroy();

    //
    // Close the connections that are left open.
    //
    primus.forEach(function shutdown(spark) {
      spark.end(undefined, { reconnect: options.reconnect });
    });

    if (options.close !== false) {
      //
      // Closing a server that isn't started yet would throw an error.
      //
      try {
        primus.server.close(function closed() {
          primus.close(options, fn);
        });
        return;
      }
      catch (e) {}
    }

    primus.close(options, fn);
  }, +options.timeout || 0);

  return this;
});

/**
 * Free resources after emitting a final `close` event.
 *
 * @param {Object} options Destruction instructions.
 * @param {Function} fn Callback.
 * @returns {Primus}
 * @api private
 */

Primus.readable('close', function close(options, fn) {
  var primus = this;
  //
  // Emit a final `close` event before removing all the listeners
  // from all the event emitters.
  //
  primus.asyncemit('close', options, function done(err) {
    if (err) {
      if (fn) return fn(err);
      throw err;
    }

    var transformer = primus.transformer
      , server = primus.server;

    //
    // If we don't have a server we are most likely destroying an already
    // destroyed Primus instance.
    //
    if (!server) return fn && fn();

    server.removeAllListeners('request');
    server.removeAllListeners('upgrade');

    //
    // Re-add the original listeners so that the server can be used again.
    //
    transformer.listeners('previous::request').forEach(function add(listener) {
      server.on('request', listener);
    });
    transformer.listeners('previous::upgrade').forEach(function add(listener) {
      server.on('upgrade', listener);
    });

    transformer.emit('close', options);
    transformer.removeAllListeners();

    primus.removeAllListeners();

    //
    // Null some potentially heavy objects to free some more memory instantly.
    //
    primus.transformers.outgoing.length = primus.transformers.incoming.length = 0;
    primus.transformer = primus.encoder = primus.decoder = primus.server = null;
    primus.connected = 0;

    primus.connections = Object.create(null);
    primus.ark = Object.create(null);

    if (fn) fn();
  });

  return this;
});

/**
 * Async emit an event. We make a really broad assumption here and that is they
 * have the same amount of arguments as the supplied arguments (excluding the
 * event name).
 *
 * @returns {Primus}
 * @api private
 */
Primus.readable('asyncemit', require('asyncemit'));

//
// Alias for destroy.
//
Primus.readable('end', Primus.prototype.destroy);

/**
 * Checks if the given event is an emitted event by Primus.
 *
 * @param {String} evt The event name.
 * @returns {Boolean}
 * @api public
 */
Primus.readable('reserved', function reserved(evt) {
  return (/^(incoming|outgoing)::/).test(evt)
  || evt in reserved.events;
});

/**
 * The actual events that are used by Primus.
 *
 * @type {Object}
 * @api public
 */
Primus.prototype.reserved.events = {
  'disconnection': 1,
  'initialised': 1,
  'connection': 1,
  'plugout': 1,
  'plugin': 1,
  'close': 1,
  'log': 1
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

/**
 * Create a new Primus server.
 *
 * @param {Function} fn Request listener.
 * @param {Object} options Configuration.
 * @returns {Pipe}
 * @api public
 */
Primus.createServer = function createServer(fn, options) {
  if ('object' === typeof fn) {
    options = fn;
    fn = null;
  }

  options = options || {};

  var server = require('create-server')(Primus.prototype.merge.call(Primus, {
    http: function warn() {
      if (!options.iknowhttpsisbetter) [
        '',
        'We\'ve detected that you\'re using a HTTP instead of a HTTPS server.',
        'Please be aware that real-time connections have less chance of being blocked',
        'by firewalls and anti-virus scanners if they are encrypted (using SSL). If',
        'you run your server behind a reverse and HTTPS terminating proxy ignore',
        'this message, if not, you\'ve been warned.',
        ''
      ].forEach(function each(line) {
        console.log('primus: '+ line);
      });
    }
  }, options));

  //
  // Now that we've got a server, we can setup the Primus and start listening.
  //
  var application = new Primus(server, options);

  if (fn) application.on('connection', fn);
  return application;
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
