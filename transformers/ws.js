'use strict';

/**
 * Minimum viable WebSocket server for Node.js that works through the Primus
 * interface.
 *
 * @runat server
 * @api private
 */
function server() {
  var WebSocketServer = require('ws').Server
    , Spark = this.Spark
    , primus = this.primus;

  this.service = new WebSocketServer({ noServer: true });

  //
  // Listen to upgrade requests
  //
  this.on('upgrade', function upgrade(req, socket, head) {
    this.service.handleUpgrade(req, socket, head, function create(socket) {
      var spark = new Spark(socket.upgradeReq.headers, socket.upgradeReq.address());

      spark.on('end', function end() {
        socket.close();
      }).on('data', function write(data) {
        socket.send(data);
      });

      socket.on('close', spark.emits('end'));
      socket.on('message', spark.emits('data'));
    });
  });
}

/**
 * Minimum viable WebSocket client. This function is stringified and written in
 * to our client side library.
 *
 * @runat client
 * @api private
 */
function client() {
  var primus = this
    , socket;

  //
  // Selects an available WebSocket constructor.
  //
  var Socket = (function ws() {
    if ('undefined' !== typeof WebSocket) return WebSocket;
    if ('undefined' !== typeof MozWebSocket) return MozWebSocket;
    if ('function' === typeof require) return require('ws');

    return undefined;
  })();

  if (!Socket) return this.emit('connection failed');

  primus.on('primus::connect', function connect(url) {
    if (socket) socket.close();

    socket = new Socket(url);

    //
    // Setup the Event handlers.
    //
    socket.onopen = primus.emits('open');
    socket.onerror = primus.emits('error');
    socket.onclose = primus.emits('close');
    socket.onmessage = primus.emits('data', function parse(evt) {
      return evt.data;
    });
  }).on('primus::write', function write(message) {
    if (socket) socket.send(message);
  }).on('primus::reconnect', function reconnect() {
    if (socket) socket.close();
  }).on('primus::close', function close() {
    if (socket) {
      socket.close();
      socket = null;
    }
  });
}

//
// Expose the module as new Transformer instance.
//
module.exports = require('../transformer').extend({
  server: server,
  client: client
});
