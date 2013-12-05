'use strict';

/**
 * Minimum viable WebSocket server for Node.js that works through the primus
 * interface.
 *
 * @runat server
 * @api private
 */
module.exports = function server() {
  var Engine = require('socket.io').Manager
    , Spark = this.Spark
    , primus = this.primus;

  //
  // Listen to upgrade requests.
  //
  var service = this.service = new Engine(this, {
    'resource': primus.pathname,
    'destroy upgrade': false,
    'browser client': false,
    'logger': this.logger
  });

  //
  // We've received a new connection, create a new Spark. The Spark will
  // automatically announce it self as a new connection once it's created (after
  // the next tick).
  //
  this.service.on('connection', function connection(socket) {
    var spark = new Spark(
        socket.handshake.headers  // HTTP request headers.
      , socket.handshake.address  // IP address location.
      , socket.handshake.query    // Optional query string.
      , socket.id                 // Unique connection id.
    );

    spark.on('outgoing::end', function end() {
      socket.disconnect();
    }).on('outgoing::data', function write(data) {
      socket.send(data);
    });

    socket.on('disconnect', spark.emits('end'));
    socket.on('message', spark.emits('data'));
    socket.on('error', spark.emits('error'));
  });

  this.once('close', function close() {
    service.sockets.clients().forEach(function shutdown(socket) {
      socket.disconnect();
    });

    service.store.destroy();
    service.store.removeAllListeners();
  });
};
