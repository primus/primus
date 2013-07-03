'use strict';
/*globals faye*/

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
  // Selects an available Socket.io constructor.
  //
  var Factory = (function Factory() {
    if ('undefined' !== typeof faye && faye.Client) return faye.Client;
    try { return require('faye').Client; }
    catch (e) {}

    return undefined;
  })();

  if (!factory) return this.emit('error', new Error('No faye client factory'));

  //
  // Connect to the given url.
  //
  primus.on('outgoing::open', function open() {
    if (socket) socket.disconnect();

    //
    // We need to remove the pathname here as socket.io will assume that we want
    // to connect to a namespace instead.
    //
    socket = new Factory(primus.uri('http', true));

    //
    // Setup the Event handlers.
    //
    socket.subscribe(primus.pathname, primus.emits('data'));
    socket.bind('transport:up', primus.emits('open'));
    socket.bind('transport:down', primus.emits('end'));
  });

  //
  // We need to write a new message to the socket.
  //
  primus.on('outgoing::data', function write(message) {
    if (socket) socket.publish(primus.pathname, message);
  });

  //
  // Attempt to reconnect the socket. It asumes that the `close` event is
  // called if it failed to disconnect. Bypass the namespaces and use
  // socket.socket.
  //
  primus.on('outgoing::reconnect', function reconnect() {
    if (socket) {
      socket.disconnect();
      socket.connect();
    }
  });

  //
  // We need to close the socket. Bypass the namespaces and disconnect using
  // socket.socket.
  //
  primus.on('outgoing::end', function close() {
    if (socket) {
      socket.disconnect();
      socket = null;
    }
  });
};
