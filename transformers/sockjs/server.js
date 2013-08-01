'use strict';

/**
 * Minimum viable Sockjs server for Node.js that works through the primus
 * interface.
 *
 * @runat server
 * @api private
 */
module.exports = function server() {
  var sockjs = require('sockjs')
    , Spark = this.Spark
    , primus = this.primus;

  this.service = sockjs.createServer();

  //
  // We've received a new connection, create a new Spark. The Spark will
  // automatically announce it self as a new connection once it's created (after
  // the next tick).
  //
  this.service.on('connection', function connection(socket) {
    var spark = new Spark(
        socket.headers                      // HTTP request headers.
      , socket                              // IP address location.
      , {}                                  // Query string, not allowed by SockJS.
      , socket.id                           // Unique connection id.
    );

    spark.on('outgoing::end', function end() {
      socket.close();
    }).on('outgoing::data', function write(data) {
      socket.write(data);
    });

    socket.on('close', spark.emits('end'));
    socket.on('data', spark.emits('data'));
  });

  //
  // Listen to upgrade requests.
  //
  this.service.installHandlers(this, {
    prefix: primus.pathname,
    log: this.logger.plain
  });
};
