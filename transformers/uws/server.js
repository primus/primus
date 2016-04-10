'use strict';

var parse = require('url').parse
  , http = require('http');

/**
 * Server of µWebSockets transformer.
 *
 * @runat server
 * @api private
 */
module.exports = function server() {
  var uws = require('uws').uws
    , Spark = this.Spark;

  var service = this.service = new uws.Server();

  service.onMessage(function message(socket, msg, binary) {
    var spark = service.getData(socket);
    spark.emit('incoming::data', binary ? msg : msg.toString());
  });

  service.onDisconnection(function close(socket) {
    var spark = service.getData(socket);
    service.setData(socket);
    spark.emit('incoming::end');
  });

  //
  // Listen to upgrade requests.
  //
  this.on('upgrade', function upgrade(req, soc, head) {
    this.service.onConnection(function create(socket) {
      var spark = new Spark(
          req.headers               // HTTP request headers.
        , req                       // IP address location.
        , parse(req.url).query      // Optional query string.
        , null                      // We don't have an unique id.
        , req                       // Reference to the HTTP req.
      );

      service.setData(socket, spark);

      spark.on('outgoing::end', function end() {
        service.close(socket);
      }).on('outgoing::data', function write(data) {
        service.send(socket, data, 'string' === typeof data ? false : true);
      });
    });

    this.service.upgrade(soc._handle.fd, req.headers['sec-websocket-key']);
    soc.destroy();
  });

  //
  // Listen to non-upgrade requests.
  //
  this.on('request', function request(req, res) {
    res.writeHead(426, { 'content-type': 'text/plain' });
    res.end(http.STATUS_CODES[426]);
  });

  this.on('close', function close() {
    service.close();
  });
};
