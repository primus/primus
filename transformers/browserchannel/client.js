'use strict';
/*globals BCSocket*/

/**
 * Minimum viable Browserclient client. This function is stringified and written in
 * to our client side library.
 *
 * @runat client
 * @api private
 */
module.exports = function client() {
  var primus = this
    , socket;

  //
  // Selects an available Browserchannel factory.
  //
  var Factory = (function factory() {
    if ('undefined' !== typeof BCSocket) return BCSocket;
    try { return require('browserchannel').BCSocket; }
    catch (e) {}

    return undefined;
  })();

  if (!Factory) return this.emit('error', new Error('No Browserchannel client factory'));

  //
  // Connect to the given url.
  //
  primus.on('outgoing::connect', function connect(ws, http) {
    if (socket) socket.close();

    socket = new Factory(http, { reconnect: false });

    //
    // Setup the Event handlers.
    //
    socket.onopen = primus.emits('connect');
    socket.onerror = primus.emits('error');
    socket.onclose = primus.emits('end');
    socket.onmessage = primus.emits('data');
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
  primus.on('outgoing::reconnect', function reconnect(ws, http) {
    if (socket) {
      socket.close();
      socket.open();
    }
  });

  //
  // We need to close the socket.
  //
  primus.on('outgoing::close', function close() {
    if (socket) {
      socket.close();
      socket = null;
    }
  });
};
