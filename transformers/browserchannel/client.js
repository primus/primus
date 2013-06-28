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
  // Connect to the given url.
  //
  primus.on('outgoing::connect', function connect(url) {
    if (socket) socket.close();

    socket = new BCSocket(url);

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
  primus.on('outgoing::write', function write(message) {
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
  primus.on('outgoing::close', function close() {
    if (socket) {
      socket.close();
      socket = null;
    }
  });
};
