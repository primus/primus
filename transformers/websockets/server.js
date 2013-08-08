'use strict';

var parse = require('url').parse;

/**
 * Minimum viable WebSocket server for Node.js that works through the Primus
 * interface.
 *
 * @runat server
 * @api private
 */
module.exports = function server() {
  var WebSocketServer = require('ws').Server
    , primus = this.primus
    , Spark = this.Spark;

  var service = this.service = new WebSocketServer({
    clientTracking: false,
    noServer: true
  });

  //
  // Listen to upgrade requests
  //
  this.on('upgrade', function upgrade(req, socket, head) {
    this.service.handleUpgrade(req, socket, head, function create(socket) {
      var spark = new Spark(
          socket.upgradeReq.headers               // HTTP request headers.
        , socket.upgradeReq                       // IP address location.
        , parse(socket.upgradeReq.url).query      // Optional query string.
      );

      spark.on('outgoing::end', function end() {
        socket.close();
      }).on('outgoing::data', function write(data) {
        socket.send(data);
      });

      socket.on('close', spark.emits('end'));
      socket.on('message', spark.emits('data'));
    });
  });

  this.on('close', function close() {
    service.close();
  });
};
