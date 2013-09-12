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
    if (socket) socket.close();

    primus.socket = socket = factory(primus.uri({ protocol: 'ws', query: true }), {
      path: this.pathname,
      transports: !primus.AVOID_WEBSOCKETS
        ? ['polling', 'websocket']
        : ['polling']
    });

    //
    // Setup the Event handlers.
    //
    socket.onopen = primus.emits('open');
    socket.onerror = primus.emits('error');
    socket.onclose = primus.emits('end');
    socket.onmessage = primus.emits('data', function parse(evt) {
      return evt.data;
    });
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
    }
  });

  //
  // We need to close the socket.
  //
  primus.on('outgoing::end', function close() {
    if (socket) {
      socket.close();
      socket = null;
    }
  });
};
