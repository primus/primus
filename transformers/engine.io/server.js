'use strict';

/**
 * Minimum viable Engine.IO server for Node.js that works through the primus
 * interface.
 *
 * @runat server
 * @api private
 */
module.exports = function server() {
  var Engine = require('engine.io').Server
    , Spark = this.Spark;

  var service = this.service = new Engine();

  //
  // We've received a new connection, create a new Spark. The Spark will
  // automatically announce it self as a new connection once it's created (after
  // the next tick).
  //
  this.service.on('connection', function connection(socket) {
    var spark = new Spark(
        socket.request.headers                      // HTTP request headers.
      , socket.request.primus                       // IP Address location.
      , socket.request.query                        // Optional query string.
      , socket.id                                   // Unique connection id.
      , socket.request                              // Reference to the HTTP req.
    );

    spark.on('outgoing::end', function end() {
      if (socket) socket.close();
    }).on('outgoing::data', function write(data) {
      socket.write(data);
    });

    socket.on('error', spark.emits('error'));
    socket.on('data', spark.emits('data'));
    socket.on('close', spark.emits('end', function parser() {
      socket.removeAllListeners();
      socket = null;
    }));
  });

  //
  // Listen to upgrade requests.
  //
  this.on('upgrade', function upgrade(req, socket, head) {
    this.service.handleUpgrade(req, socket, head);
  }).on('request', function request(req, res) {
    //
    // Engine.IO closes the handshake socket before we receive a `connection`
    // event. And as the socket is already answered it can be undefined.
    //
    req.primus = {
      remoteAddress: req.socket.remoteAddress,
      remotePort: req.socket.remotePort
    };

    this.service.handleRequest(req, res);
  }).once('close', function close() {
    service.close();
    if (service.ws) service.ws.close();
  });
};
