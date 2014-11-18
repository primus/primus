'use strict';
/*globals MozWebSocket */

/**
 * Minimum viable Faye-WebSocket client. This function is stringified and
 * added in our client-side library.
 *
 * @runat client
 * @api private
 */
module.exports = function client() {
  var primus = this
    , socket;

  //
  // Select an available Faye-WebSocket factory.
  //
  var Factory = (function factory() {
    if ('undefined' !== typeof WebSocket) return WebSocket;
    if ('undefined' !== typeof MozWebSocket) return MozWebSocket;

    try { return Primus.require('faye-websocket').Client; }
    catch (e) {}

    return undefined;
  })();

  if (!Factory) return primus.critical(new Error(
    'Missing required `faye-websocket` module. ' +
    'Please run `npm install --save faye-websocket`'
  ));


  //
  // Connect to the given URL.
  //
  primus.on('outgoing::open', function opening() {
    primus.emit('outgoing::end');

    //
    // FireFox will throw an error when we try to establish a connection from
    // a secure page to an unsecured WebSocket connection. This is inconsistent
    // behaviour between different browsers. This should ideally be solved in
    // Primus when we connect.
    //
    try {
      //
      // Only allow primus.transport object in Node.js, it will throw in
      // browsers with a TypeError if we supply to much arguments.
      //
      if (Factory.length === 3) {
        primus.socket = socket = new Factory(
          primus.uri({ protocol: 'ws', query: true }),  // URL
          [],                                           // Sub protocols
          primus.transport                              // options.
        );
      } else {
        primus.socket = socket = new Factory(primus.uri({
          protocol: 'ws',
          query: true
        }));
      }
    } catch (e) { return primus.emit('error', e); }

    //
    // Setup the Event handlers.
    //
    socket.binaryType = 'arraybuffer';
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
    if (!socket || socket.readyState !== 1) return;

    try { socket.send(message); }
    catch (e) { primus.emit('incoming::error', e); }
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
