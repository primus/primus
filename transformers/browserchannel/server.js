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
    , Spark = this.Spark
    , primus = this.primus
    , query = {};

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
      , query             // Query string, not allowed by browser channel.
      , socket.id         // Unique connection id.
    );

    spark.on('outgoing::end', function end() {
      socket.stop();
    }).on('outgoing::data', function write(data) {
      socket.send(data);
    });

    socket.on('close', spark.emits('end'));
    socket.on('message', spark.emits('data'));
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
