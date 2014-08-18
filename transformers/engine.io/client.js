'use strict';
/*globals eio*/

/**
 * Minimum viable WebSocket client. This function is stringified and written in
 * to our client side library.
 *
 * @runat client
 * @api private
 */
module.exports = function client() {
  var primus = this
    , socket;

  //
  // Selects an available Engine.IO factory.
  //
  var factory = (function factory() {
    if ('undefined' !== typeof eio) return eio;

    try { return Primus.require('engine.io-client'); }
    catch (e) {}

    return undefined;
  })();

  if (!factory) return primus.critical(new Error('Missing required `engine.io-client` module. Please run `npm install --save engine.io-client`'));

  //
  // Connect to the given URL.
  //
  primus.on('outgoing::open', function opening() {
    primus.emit('outgoing::end');

    primus.socket = socket = factory(primus.merge(primus.transport,
      primus.url,
      primus.uri({ protocol: 'http', query: true, object: true }), {
      //
      // Never remember upgrades as switching from a WIFI to a 3G connection
      // could still get your connection blocked as 3G connections are usually
      // behind a reverse proxy so ISP's can optimize mobile traffic by
      // caching requests.
      //
      rememberUpgrade: false,

      //
      // Binary support in Engine.IO breaks a shit things. Turn it off for now.
      //
      forceBase64: true,

      //
      // XDR has been the source of pain for most real-time users. It doesn't
      // support the full CORS spec and is infested with bugs. It cannot connect
      // cross-scheme, does not send ANY authorization information like Cookies,
      // Basic Authorization headers etc. Force this off by default to ensure a
      // stable connection.
      //
      enablesXDR: false,

      //
      // Force timestamps on every single connection. Engine.IO only does this
      // for polling by default, but WebSockets require an explicit `true`
      // boolean.
      //
      timestampRequests: true,
      path: this.pathname,
      transports: !primus.AVOID_WEBSOCKETS
        ? ['polling', 'websocket']
        : ['polling']
    }));

    //
    // Nuke a growing memory leak as Engine.IO pushes instances in to an exposed
    // `sockets` array.
    //
    if (factory.sockets && factory.sockets.length) {
      factory.sockets.length = 0;
    }

    //
    // Setup the Event handlers.
    //
    socket.on('open', primus.emits('open'));
    socket.on('error', primus.emits('error'));
    socket.on('close', primus.emits('end'));
    socket.on('message', primus.emits('data'));
  });

  //
  // We need to write a new message to the socket.
  //
  primus.on('outgoing::data', function write(message) {
    if (socket) socket.send(message);
  });

  //
  // Attempt to reconnect the socket. It assumes that the `close` event is
  // called if it failed to disconnect.
  //
  primus.on('outgoing::reconnect', function reconnect() {
    if (socket) {
      socket.close();
      socket.open();
    } else {
      primus.emit('outgoing::open');
    }
  });

  //
  // We need to close the socket.
  //
  primus.on('outgoing::end', function close() {
    if (socket) {
      socket.removeAllListeners();
      socket.close();
      socket = null;
    }
  });
};
