'use strict';

/**
 * Minimum viable WebSocket server for Node.js that works through the primus
 * interface.
 *
 * @runat server
 * @api private
 */
function server() {
  var Engine = require('engine.io').Server
    , Spark = this.Spark
    , primus = this.primus;

  this.service = new Engine();

  this.engine.on('connection', function connection(socket) {
    var spark = new Spark(socket.request.headers, socket.request.address());

    spark.on('end', function end() {
      socket.end();
    }).on('data', function write(data) {
      socket.write(data);
    });

    socket.on('end', spark.emits('end'));
    socket.on('data', spark.emits('data'));
  });

  //
  // Listen to upgrade requests
  //
  this.on('upgrade', function upgrade(req, socket, head) {
    this.service.handleUpgrade(req, socket, head);
  }).on('request', function request(req, res) {
    this.service.handleRequest(req, res);
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

  if (!Socket) return this.emit('connection failed');

  primus.on('primus::connect', function connect(url) {
    if (socket) socket.close();

    socket = eio(url);

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
    if (socket) {
      socket.close();
      socket.open();
    }
  }).on('primus::close', function close() {
    if (socket) socket.close();
  });
}

//
// Expose the module as new Transporter instance.
//
module.exports = require('../transporter').extend({
  server: server,
  client: client
});
