'use strict';

var browserchannel = require('browserchannel')
  , http = require('http');

/**
 * Minimum viable Browserchannel server for Node.js that works through the primus
 * interface.
 *
 * @runat server
 * @api private
 */
module.exports = function server() {
  var primus = this.primus
    , Spark = this.Spark;

  //
  // We've received a new connection, create a new Spark. The Spark will
  // automatically announce it self as a new connection once it's created (after
  // the next tick).
  //
  this.service = browserchannel.server(Object.assign(primus.options.transport, {
    base: primus.pathname
  }), function connection(socket) {
    var spark = new Spark(
        socket.headers                          // HTTP request headers.
      , {                                       // IP address Location.
          remoteAddress: socket.address,
          remotePort: 1337
        }
      , socket.query                            // Optional query string.
      , socket.id                               // Unique connection id.
    );

    spark.on('outgoing::end', function end() {
      if (socket) socket.stop();
    }).on('outgoing::data', function write(data) {
      socket.send(data);
    });

    socket.on('message', spark.emits('incoming::data'));
    socket.on('error', spark.emits('incoming::error'));
    socket.on('close', spark.emits('incoming::end', function parser(next) {
      socket.removeAllListeners();
      socket = null;
      next();
    }));
  });

  //
  // Listen to upgrade requests.
  //
  this.on('request', function request(req, res) {
    //
    // The browser.channel returns a middleware layer.
    //
    this.service(req, res, function next() {
      res.writeHead(404, {'content-type': 'text/plain'});
      res.end(http.STATUS_CODES[404]);
    });
  });
};
