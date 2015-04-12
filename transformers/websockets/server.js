'use strict';

var http = require('http')
  , parse = require('url').parse;

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
    , Spark = this.Spark;

  var service = this.service = new WebSocketServer({
    perMessageDeflate: !!this.primus.options.compression,
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
  // Listen to upgrade requests.
  //
  this.on('upgrade', function upgrade(req, socket, head) {
    this.service.handleUpgrade(req, socket, head, function create(socket) {
      var spark = new Spark(
          socket.upgradeReq.headers               // HTTP request headers.
        , socket.upgradeReq                       // IP address location.
        , parse(socket.upgradeReq.url).query      // Optional query string.
        , null                                    // We don't have an unique id.
        , socket.upgradeReq                       // Reference to the HTTP req.
      );

      spark.on('outgoing::end', function end() {
        if (socket) socket.close();
      }).on('outgoing::data', function write(data) {
        if (socket.readyState !== socket.OPEN) return;
        if ('string' === typeof data) return socket.send(data, noop);

        socket.send(data, { binary: true }, noop);
      });

      socket.on('message', spark.emits('incoming::data'));
      socket.on('error', spark.emits('incoming::error'));
      socket.on('ping', spark.emits('incoming::ping', function strip(next) {
        next(undefined, null);
      }));
      socket.on('close', spark.emits('incoming::end', function clear(next) {
        socket.removeAllListeners();
        socket = null;
        next();
      }));
    });
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
