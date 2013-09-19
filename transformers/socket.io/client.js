'use strict';
/*globals io*/

/**
 * Minimum viable Socket.IO client. This function is stringified and written in
 * to our client side library.
 *
 * @runat client
 * @api private
 */
module.exports = function client() {
  var primus = this
    , socket;

  //
  // Selects an available Socket.IO constructor.
  //
  var factory = (function factory() {
    if ('undefined' !== typeof io && io.Socket) return io;

    try { return Primus.require('socket.io-client'); }
    catch (e) {}

    return undefined;
  })();

  if (!factory) return primus.critical(new Error('Missing required `socket.io-client` module. Please run `npm install --save socket.io-client`'));

  //
  // Connect to the given URL.
  //
  primus.on('outgoing::open', function open() {
    if (socket) try { socket.disconnect(); }
    catch (e) {}

    var transports = factory.transports
      , Socket = factory.Socket;

    if (primus.AVOID_WEBSOCKETS) {
      transports = transports.join(',').replace(/\,?websocket\,?/gim, '').split(',');
    }

    //
    // We need to directly use the parsed URL details here to generate the
    // correct urls for Socket.IO to use.
    //
    primus.socket = socket = (new Socket(primus.merge({}, primus.url, primus.uri({
      protocol: 'http',
      query: true,
      object: true
    }), {
      'resource': primus.pathname.slice(1),
      'force new connection': true,
      'flash policy port': 843,
      'transports': transports,
      'reconnect': false
    }))).of(''); // Force namespace

    //
    // Setup the Event handlers.
    //
    socket.on('connect', primus.emits('open'));
    socket.on('connect_failed', primus.emits('error'));
    socket.on('error', primus.emits('error'));
    socket.on('message', primus.emits('data'));
    socket.on('disconnect', primus.emits('end', function parser(kind) {
      return kind === 'booted' ? 'primus::server::close' : false;
    }));
  });

  //
  // We need to write a new message to the socket.
  //
  primus.on('outgoing::data', function write(message) {
    if (socket) socket.send(message);
  });

  //
  // Attempt to reconnect the socket. It assumes that the `close` event is
  // called if it failed to disconnect. Bypass the namespaces and use
  // socket.socket.
  //
  primus.on('outgoing::reconnect', function reconnect() {
    try {
      socket.socket.disconnect();
      socket.connected = socket.socket.connecting = socket.socket.reconnecting = false;
      socket.socket.connect();
    } catch (e) {
      socket = null;
      primus.emit('outgoing::open');
    }
  });

  //
  // We need to close the socket. Bypass the namespaces and disconnect using
  // socket.socket.
  //
  primus.on('outgoing::end', function close() {
    if (socket) {
      //
      // This method can throw an error if it failed to connect to the server.
      //
      try { socket.socket.disconnect(); }
      catch (e) {}

      socket = null;
    }
  });
};
