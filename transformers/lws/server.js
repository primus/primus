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
  var WebSocketServer = require('lws').Server
    , logger = this.logger
    , Spark = this.Spark;

  var service = this.service = new WebSocketServer({
    perMessageDeflate: !!this.primus.options.compression
  });

  service.on('message', function (socket, message, binary) {
    var spark = service.getUserData(socket);
    if (binary) {
      spark.emits('incoming::data')(message);
    } else {
      spark.emits('incoming::data')(message.toString());
    }
  });

  service.on('close', function (socket) {
    var spark = service.getUserData(socket);
    spark.emits('incoming::end')();
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
    var socket = this.service.handleUpgrade(socket, req, head);
    if (socket !== undefined) {
      var spark = new Spark(
          req.headers               // HTTP request headers.
        , req                       // IP address location.
        , parse(req.url).query      // Optional query string.
        , null                      // We don't have an unique id.
        , req                       // Reference to the HTTP req.
      );

      service.setUserData(socket, spark);

      spark.on('outgoing::end', function end() {
        service.close(socket);
      }).on('outgoing::data', function write(data) {
        if ('string' === typeof data) {
          // todo: take a string directly
          service.send(socket, new Buffer(data), false);
        } else {
          service.send(socket, data, true);
        }
      });
    }
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
