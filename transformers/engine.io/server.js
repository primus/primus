'use strict';

/**
 * Minimum viable WebSocket server for Node.js that works through the primus
 * interface.
 *
 * @runat server
 * @api private
 */
module.exports = function server() {
  var Engine = require('engine.io').Server
    , Spark = this.Spark
    , primus = this.primus;

  this.service = new Engine();

  //
  // We've received a new connection, create a new Spark. The Spark will
  // automatically announce it self as a new connection once it's created (after
  // the next tick).
  //
  this.service.on('connection', function connection(socket) {
    var spark = new Spark(
        socket.request.headers
      , socket.request.connection.address()
      , socket.id
    );

    spark.on('ougoing::end', function end() {
      socket.end();
    }).on('outgoing::data', function write(data) {
      socket.write(data);
    });

    socket.on('end', spark.emits('end'));
    socket.on('data', spark.emits('data'));
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
