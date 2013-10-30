'use strict';
/*globals SockJS*/

/**
 * Minimum viable SockJS client. This function is stringified and written in
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
  var Factory = (function Factory() {
    if ('undefined' !== typeof SockJS) return SockJS;

    try { return Primus.require('sockjs-client-node'); }
    catch (e) {}

    return undefined;
  })();

  if (!Factory) return primus.critical(new Error('Missing required `sockjs-client-node` module. Please run `npm install --save sockjs-client-node`'));

  //
  // Connect to the given URL.
  //
  primus.on('outgoing::open', function opening() {
    if (socket) socket.close();

    primus.socket = socket = new Factory(primus.uri({ protocol: 'http' }), null, {
      websocket: !primus.AVOID_WEBSOCKETS
    });

    //
    // Setup the Event handlers.
    //
    socket.onopen = primus.emits('open');
    socket.onerror = primus.emits('error');
    socket.onclose = function (e) {
      var event = e && e.code === 1002 ? 'error' : 'end';

      //
      // The timeout replicates the behaviour of primus.emits so we're not
      // affected by any timing bugs.
      //
      setTimeout(function timeout() {
        primus.emit('incoming::'+ event, e);
      }, 0);
    };
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
