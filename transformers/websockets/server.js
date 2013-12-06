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
    , logger = this.logger
    , primus = this.primus
    , Spark = this.Spark;

  var service = this.service = new WebSocketServer({
    clientTracking: false,
    noServer: true
  });

  /**
   * Noop! Pointless, empty function that will actually be really useful.
   *
   * @param {Error} err We failed at something.
   * @api private
   */
  function noop(err) {
    if (err) logger.error(err);
  }

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
        if ('string' === typeof data) return socket.send(data, noop);

        socket.send(data, { binary: true }, noop);
      });

      socket.on('close', spark.emits('end'));
      socket.on('error', spark.emits('error'));
      socket.on('message', spark.emits('data'));
    });
  });

  this.on('close', function close() {
    service.close();
  });
};
