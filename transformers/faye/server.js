'use strict';

/**
 * Minimum viable WebSocket server for Node.js that works through the primus
 * interface.
 *
 * @runat server
 * @api private
 */
module.exports = function server() {
  var faye = require('faye')
    , primus = this.primus
    , Spark = this.Spark;

  this.service = new faye.NodeAdapter({
      mount: primus.pathname
    , timeout: 45
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
  this.service.attach(this);
};
