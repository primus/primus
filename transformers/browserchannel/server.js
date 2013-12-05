'use strict';

/**
 * Minimum viable Browserchannel server for Node.js that works through the primus
 * interface.
 *
 * @runat server
 * @api private
 */
module.exports = function server() {
  var browserchannel = require('browserchannel')
    , primus = this.primus
    , Spark = this.Spark;

  //
  // We've received a new connection, create a new Spark. The Spark will
  // automatically announce it self as a new connection once it's created (after
  // the next tick).
  //
  this.service = browserchannel.server({
    base: primus.pathname
  }, function connection(socket) {
    var spark = new Spark(
        socket.headers    // HTTP request headers.
      , {                 // IP address Location.
          remoteAddress: socket.address,
          remotePort: 1337
        }
      , socket.query      // Optional query string.
      , socket.id         // Unique connection id.
    );

    spark.on('outgoing::end', function end() {
      socket.stop();
    }).on('outgoing::data', function write(data) {
      socket.send(data);
    });

    socket.on('message', spark.emits('data'));
    socket.on('error', spark.emits('error'));
    socket.on('close', spark.emits('end'));
  });

  //
  // Listen to upgrade requests.
  //
  this.on('request', function request(req, res, next) {
    //
    // The browser.channel returns a middleware layer.
    //
    this.service(req, res, next);
  });
};
