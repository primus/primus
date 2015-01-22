'use strict';

var PrimusError = require('../../errors').PrimusError
  , parse = require('url').parse
  , http = require('http');

/**
 * Minimum viable WebSocket server that works through the Primus interface.
 *
 * @runat server
 * @api private
 */
module.exports = function server() {
  var Faye = require('faye-websocket')
    , primus = this.primus
    , Spark = this.Spark
    , options = {};

  if (primus.options.compression) {
    try {
      options.extensions = [ require('permessage-deflate') ];
    } catch (e) {
      [
        '',
        'Missing required npm dependency for faye',
        'To use the permessage-deflate extension with the faye transformer, ',
        'you have to install an additional dependency.',
        'Please run the following command and try again:',
        '',
        '  npm install --save permessage-deflate',
        ''
      ].forEach(function each(line) {
        console.error('Primus: '+ line);
      });

      throw new PrimusError('Missing dependencies for transformer: "faye"', primus);
    }
  }

  //
  // Listen to upgrade requests.
  //
  this.on('upgrade', function upgrade(req, socket, head) {
    if (!Faye.isWebSocket(req)) return socket.destroy();

    var websocket = new Faye(req, socket, head, null, options);

    //
    // The WebSocket handshake is complete only when the `open` event is fired.
    //
    websocket.on('open', function open() {
      var spark = new Spark(
          req.headers          // HTTP request headers.
        , req                  // IP address location.
        , parse(req.url).query // Optional query string.
        , null                 // We don't have an unique id.
        , req                  // Reference to the HTTP req.
      );

      spark.on('outgoing::end', function end() {
        if (websocket) websocket.close();
      }).on('outgoing::data', function write(data) {
        if ('string' === typeof data) return websocket.send(data);

        websocket.send(data, { binary: true });
      });

      websocket.on('error', spark.emits('incoming::error'));
      websocket.on('message', spark.emits('incoming::data', function parse(next, evt) {
        next(undefined, evt.data);
      }));
      websocket.on('close', spark.emits('incoming::end', function close(next) {
        websocket.removeAllListeners();
        websocket = null;
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
};
