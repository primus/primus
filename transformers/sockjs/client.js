'use strict';
/*globals SockJS*/

/**
 * Minimum viable Sockjs client. This function is stringified and written in
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
  var Factory = (function Factory() {
    if ('undefined' !== typeof SockJS) return SockJS;
    try {
      return require('sockjs-client-node');
    } catch (e) { }

    return undefined;
  })();

  if (!Factory) return this.emit('error', new Error('No SockJS client factory'));

  //
  // Connect to the given url.
  //
  primus.on('outgoing::open', function opening() {
    if (socket) socket.close();

    socket = new Factory(primus.uri('http', false), null, {
      websocket: !primus.AVOID_WEBSOCKETS
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
    if (socket) primus.emit('outgoing::close');
    primus.emit('outgoing::open');
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
