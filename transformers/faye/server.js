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
  var Faye = require('faye-websocket')
    , logger = this.logger
    , Spark = this.Spark;

  //
  // Listen to upgrade requests
  //
  this.on('upgrade', function upgrade(req, socket, head) {
    if (Faye.isWebSocket(req)) return socket.destroy();

    var websocket = new Faye(req, socket, head)
      , spark = new Spark(
          req.headers                             // HTTP request headers.
        , req                                     // IP address location.
        , parse(req.url).query                    // Optional query string.
        , null                                    // We don't have an unique id.
        , req                                     // Reference to the HTTP req.
    );

    spark.on('outgoing::end', function end() {
      websocket.close();
    }).on('outgoing::data', function write(data) {
      if (websocket.readyState !== websocket.OPEN) return;
      if ('string' === typeof data) return websocket.send(data);

      websocket.send(data, { binary: true });
    });

    websocket.on('close', spark.emits('end'));
    websocket.on('error', spark.emits('error'));
    websocket.on('message', spark.emits('data', function parse(evt) {
      return evt.data;
    }));
  });
};
