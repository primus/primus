'use strict';
/*globals SockJS*/

/**
 * Minimum viable SockJS client. This function is stringified and added
 * in our client-side library.
 *
 * @runat client
 * @api private
 */
module.exports = function client() {
  var primus = this
    , socket;

  //
  // Select an available SockJS factory.
  //
  var Factory = (function Factory() {
    if ('undefined' !== typeof SockJS) return SockJS;

    try { return Primus.requires('sockjs-client'); }
    catch (e) {}

    return undefined;
  })();

  if (!Factory) return primus.critical(new Error(
    'Missing required `sockjs-client` module. ' +
    'Please run `npm install --save sockjs-client`'
  ));

  //
  // Connect to the given URL.
  //
  primus.on('outgoing::open', function opening() {
    primus.emit('outgoing::end');

    primus.socket = socket = new Factory(
      primus.uri({ protocol: 'http:', query: true }),
      null,
      primus.merge(primus.transport, {
      info: {
        websocket: !primus.AVOID_WEBSOCKETS,  // Prevent WebSocket crashes
        cookie_needed: true                   // Disables xdomainrequest bugs
      }
    }));

    //
    // Setup the Event handlers.
    //
    socket.onopen = primus.emits('incoming::open');
    socket.onerror = primus.emits('incoming::error');
    socket.onclose = function (e) {
      if (e && e.code > 1000) primus.emit('incoming::error', e);
      primus.emit('incoming::end');
    };
    socket.onmessage = primus.emits('incoming::data', function parse(next, evt) {
      next(undefined, evt.data);
    });
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

    socket.onerror = socket.onopen = socket.onclose = socket.onmessage = function () {};
    socket.close();
    socket = null;
  });
};
