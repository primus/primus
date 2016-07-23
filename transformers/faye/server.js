'use strict';

const Faye = require('faye-websocket');
const http = require('http');
const url = require('url');

const PrimusError = require('../../errors').PrimusError;

/**
 * Minimum viable WebSocket server that works through the Primus interface.
 *
 * @runat server
 * @api private
 */
module.exports = function server() {
  let options = { maxLength: this.primus.options.maxLength };

  if (this.primus.options.compression) {
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
      ].forEach((line) => console.error(`Primus: ${line}`));

      throw new PrimusError(
        'Missing dependencies for transformer: "faye"',
        this.primus
      );
    }
  }

  options = Object.assign(options, this.primus.options.transport);

  //
  // Listen to upgrade requests.
  //
  this.on('upgrade', (req, socket, head) => {
    if (!Faye.isWebSocket(req)) return socket.destroy();

    let websocket = new Faye(req, socket, head, null, options);

    //
    // The WebSocket handshake is complete only when the `open` event is fired.
    //
    websocket.on('open', () => {
      const spark = new this.Spark(
          req.headers               // HTTP request headers.
        , req                       // IP address location.
        , url.parse(req.url).query  // Optional query string.
        , null                      // We don't have an unique id.
        , req                       // Reference to the HTTP req.
      );

      spark.on('outgoing::end', () => websocket && websocket.close());
      spark.on('outgoing::data', (data) => {
        if ('string' === typeof data) return websocket.send(data);

        websocket.send(data, { binary: true });
      });

      websocket.on('error', spark.emits('incoming::error'));
      websocket.on('message', spark.emits('incoming::data', (next, evt) => {
        next(undefined, evt.data);
      }));
      websocket.on('close', spark.emits('incoming::end', (next) => {
        websocket.removeAllListeners();
        websocket = null;
        next();
      }));
    });
  });

  //
  // Listen to non-upgrade requests.
  //
  this.on('request', (req, res) => {
    res.writeHead(426, { 'content-type': 'text/plain' });
    res.end(http.STATUS_CODES[426]);
  });
};
