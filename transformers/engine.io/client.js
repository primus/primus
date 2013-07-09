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
  // Selects an available Engine.io factory.
  //
  var factory = (function factory() {
    if ('undefined' !== typeof eio) return eio;
    try { return require('engine.io-client'); }
    catch (e) {}

    return undefined;
  })();

  if (!factory) return this.emit('error', new Error('No Engine.IO client factory'));

  //
  // Connect to the given url.
  //
  primus.on('outgoing::open', function opening() {
    if (socket) socket.close();

    socket = factory(primus.uri('ws', true), {
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
  // Attempt to reconnect the socket. It asumes that the `close` event is
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
