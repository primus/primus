'use strict';

/**
 * Minimum viable Sockjs server for Node.js that works through the primus
 * interface.
 *
 * @runat server
 * @api private
 */
module.exports = function server() {
  var sockjs = require('sockjs')
    , Spark = this.Spark
    , primus = this.primus
    , prefix = primus.pathname;

  if (prefix.charAt(prefix.length - 1) !== '/') prefix += '(?:[^/]+)?';

  this.service = sockjs.createServer();

  //
  // We've received a new connection, create a new Spark. The Spark will
  // automatically announce it self as a new connection once it's created (after
  // the next tick).
  //
  this.service.on('connection', function connection(socket) {
    var headers = socket.headers.via;
    headers.via = headers._via;
    socket.headers.via = null;

    var spark = new Spark(
        headers                             // HTTP request headers.
      , socket                              // IP address location.
      , {}                                  // Query string, not allowed by SockJS.
      , socket.id                           // Unique connection id.
    );

    spark.on('outgoing::end', function end() {
      if (socket) socket.close();
    }).on('outgoing::data', function write(data) {
      socket.write(data);
    });

    socket.on('error', spark.emits('error'));
    socket.on('data', spark.emits('data'));
    socket.on('close', spark.emits('end', function parser() {
      socket.removeAllListeners();
      socket = null;
    }));
  });

  //
  // Listen to upgrade requests.
  //
  var handle = this.service.listener({
    prefix: prefix,
    log: this.logger.plain
  }).getHandler();

  //
  // Here be demons. SockJS has this really horrible "security" feature where it
  // limits the HTTP headers that you're allowed to see and use in your
  // applications. I whole heartly disagree with this decision so we're hacking
  // around this by storing the full header in an accepted header key and re-use
  // that when we construct a Primus Spark.
  //
  this.on('upgrade', function upgrade(req, socket, head) {
    var headers = req.headers;
    headers._via = req.headers.via;
    req.headers.via = headers;

    handle.call(this, req, socket, head);
  }).on('request', function request(req, res) {
    var headers = req.headers;
    headers._via = req.headers.via;
    req.headers.via = headers;

    handle.call(this, req, res);
  });
};
