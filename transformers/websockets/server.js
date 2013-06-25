'use strict';

/**
 * Minimum viable WebSocket server for Node.js that works through the Primus
 * interface.
 *
 * @runat server
 * @api private
 */
module.exports = function server() {
  var WebSocketServer = require('ws').Server
    , Spark = this.Spark
    , primus = this.primus;

  this.service = new WebSocketServer({ noServer: true, clientTracking: false });

  //
  // Listen to upgrade requests
  //
  this.on('upgrade', function upgrade(req, socket, head) {
    this.service.handleUpgrade(req, socket, head, function create(socket) {
      var spark = new Spark(
        socket.upgradeReq.headers,
        socket.upgradeReq.address()
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
};
