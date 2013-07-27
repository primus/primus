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
    if ('undefined' !== typeof io && io.connect) return io.connect;
    try { return require('socket.io-client').connect; }
    catch (e) {}

    return undefined;
  })();

  if (!factory) return this.emit('error', new Error('No Socket.IO client factory'));

  //
  // Connect to the given URL.
  //
  primus.on('outgoing::open', function open() {
    if (socket) socket.disconnect();

    //
    // We need to remove the pathname here as Socket.IO will assume that we want
    // to connect to a namespace instead. The name spaces in Socket.IO are known
    // source of issues and cluster failure so we want to do our best in
    // avoiding them.
    //
    socket = factory(primus.uri('http', true).replace(primus.pathname.slice(1), ''), {
      'resource': primus.pathname.slice(1),
      'force new connection': true,
      'reconnect': false
    });

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
  // Attempt to reconnect the socket. It asumes that the `close` event is
  // called if it failed to disconnect. Bypass the namespaces and use
  // socket.socket.
  //
  primus.on('outgoing::reconnect', function reconnect() {
    if (socket) {
      socket.socket.disconnect();
      socket.connected = socket.socket.connecting = socket.socket.reconnecting = false;
      socket.socket.connect();
    }
  });

  //
  // We need to close the socket. Bypass the namespaces and disconnect using
  // socket.socket.
  //
  primus.on('outgoing::end', function close() {
    if (socket) {
      socket.socket.disconnect();
      socket = null;
    }
  });
};
