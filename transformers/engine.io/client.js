'use strict';
/*globals eio*/

/**
 * Minimum viable Engine.IO client. This function is stringified and added in
 * our client-side library.
 *
 * @runat client
 * @api private
 */
module.exports = function client() {
  var onmessage = this.emits('incoming::data')
    , onerror = this.emits('incoming::error')
    , onopen = this.emits('incoming::open')
    , onclose = this.emits('incoming::end')
    , primus = this
    , socket;

  //
  // Select an available Engine.IO factory.
  //
  var factory = (function factory() {
    if ('undefined' !== typeof eio) return eio;

    try {
      var Socket = Primus.requires('engine.io-client').Socket;

      return function eio(options) {
        return new Socket(options);
      }
    } catch (e) {}

    return undefined;
  })();

  if (!factory) return primus.critical(new Error(
    'Missing required `engine.io-client` module. ' +
    'Please run `npm install --save engine.io-client`'
  ));

  //
  // Connect to the given URL.
  //
  primus.on('outgoing::open', function opening() {
    primus.emit('outgoing::end');

    primus.socket = socket = factory(primus.merge(primus.transport,
      primus.url,
      primus.uri({ protocol: 'http:', query: true, object: true }), {
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
    // Setup the Event handlers.
    //
    socket.on('message', onmessage);
    socket.on('error', onerror);
    socket.on('close', onclose);
    socket.on('open', onopen);
  });

  //
  // We need to write a new message to the socket.
  //
  primus.on('outgoing::data', function write(message) {
    if (socket) socket.send(message);
  });

  //
  // Attempt to reconnect the socket.
  //
  primus.on('outgoing::reconnect', function reconnect() {
    primus.emit('outgoing::open');
  });

  //
  // We need to close the socket.
  //
  primus.on('outgoing::end', function close() {
    if (!socket) return;

    socket.removeListener('message', onmessage);
    socket.removeListener('error', onerror);
    socket.removeListener('close', onclose);
    socket.removeListener('open', onopen);
    socket.close();
    socket = null;
  });
};
