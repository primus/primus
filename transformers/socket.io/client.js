'use strict';
/*globals io*/

/**
 * Minimum viable Socket.IO client. This function is stringified and added
 * in our client-side library.
 *
 * @runat client
 * @api private
 */
module.exports = function client() {
  var ondisconnect = this.emits('incoming::end')
    , onconnect = this.emits('incoming::open')
    , onmessage = this.emits('incoming::data')
    , onerror = this.emits('incoming::error')
    , primus = this
    , socket;

  //
  // Select an available Socket.IO factory.
  //
  var factory = (function factory() {
    if ('undefined' !== typeof io && io.Socket) return io;

    try { return Primus.requires('primus-socket.io-client'); }
    catch (e) {
      try { return Primus.requires('socket.io-client'); }
      catch (e) {}
    }

    return undefined;
  })();

  if (!factory) return primus.critical(new Error(
    'Missing required `primus-socket.io-client` or `socket.io-client` module. ' +
    'Please run `npm i primus-socket.io-client --save` or ' +
    '`npm i socket.io-client@0.9.x --save`'
  ));

  //
  // Connect to the given URL.
  //
  primus.on('outgoing::open', function open() {
    primus.emit('outgoing::end');

    var transports = factory.transports
      , Socket = factory.Socket;

    if (primus.AVOID_WEBSOCKETS) {
      transports = transports.join(',').replace(/\,?websocket\,?/gim, '').split(',');
    }

    //
    // We need to directly use the parsed URL details here to generate the
    // correct urls for Socket.IO to use.
    //
    primus.socket = socket = (new Socket(primus.merge(primus.transport,
      primus.url, {
        host: primus.url.hostname
      }, primus.uri({ protocol: 'http:', query: true, object: true }), {
      'resource': primus.pathname.slice(1),
      'force new connection': true,
      'flash policy port': 843,
      'transports': transports,
      'reconnect': false
    }))).of(''); // Force namespace

    //
    // Setup the Event handlers.
    //
    socket.on('disconnect', ondisconnect);
    socket.on('connect_failed', onerror);
    socket.on('connect', onconnect);
    socket.on('message', onmessage);
    socket.on('error', onerror);
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
  // We need to close the socket. Bypass the namespaces and disconnect using
  // socket.socket.
  //
  primus.on('outgoing::end', function close() {
    if (!socket) return;

    socket.removeListener('disconnect', ondisconnect);
    socket.removeListener('connect_failed', onerror);
    socket.removeListener('connect', onconnect);
    socket.removeListener('message', onmessage);
    socket.removeListener('error', onerror);

    //
    // This method can throw an error if it failed to connect to the server.
    //
    try { socket.socket.disconnect(); }
    catch (e) {}

    socket = null;
  });
};
