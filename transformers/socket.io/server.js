'use strict';

/**
 * Minimum viable WebSocket server for Node.js that works through the primus
 * interface.
 *
 * @runat server
 * @api private
 */
module.exports = function server() {
  var EventEmitter = require('events').EventEmitter
    , Engine = require('socket.io').Manager
    , Spark = this.Spark
    , primus = this.primus;

  this.service = new Engine(new EventEmitter(), {
    'resource': primus.pathname,
    'destroy upgrade': false,
    'browser client': false,
    'log level': -1
  });

  //
  // We've received a new connection, create a new Spark. The Spark will
  // automatically announce it self as a new connection once it's created (after
  // the next tick).
  //
  this.service.on('connection', function connection(socket) {
    var spark = new Spark(
        socket.handshake.headers  // HTTP request headers.
      , socket.handshake.address  // IP address.
      , socket.handshake.query    // Optional query string.
      , socket.id                 // Unique connection id
    );

    spark.on('outgoing::end', function end() {
      socket.disconnect();
    }).on('outgoing::data', function write(data) {
      socket.send(data);
    });

    socket.on('disconnect', spark.emits('end'));
    socket.on('message', spark.emits('data'));
  });

  //
  // Listen to upgrade requests.
  //
  this.on('upgrade', function upgrade(req, socket, head) {
    this.service.handleUpgrade(req, socket, head);
  }).on('request', function request(req, res) {
    this.service.handleRequest(req, res);
  });
};
