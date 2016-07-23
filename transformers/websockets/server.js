'use strict';

const http = require('http');
const url = require('url');
const ws = require('ws');

/**
 * Minimum viable WebSocket server for Node.js that works through the Primus
 * interface.
 *
 * @runat server
 * @api private
 */
module.exports = function server() {
  this.service = new ws.Server(Object.assign({
    perMessageDeflate: !!this.primus.options.compression,
    maxPayload: this.primus.options.maxLength
  }, this.primus.options.transport, {
    clientTracking: false,
    noServer: true
  }));

  /**
   * Noop! Pointless, empty function that will actually be really useful.
   *
   * @param {Error} err We failed at something.
   * @api private
   */
  const noop = (err) => err && this.logger.error(err);

  //
  // Listen to upgrade requests.
  //
  this.on('upgrade', (req, socket, head) => {
    this.service.handleUpgrade(req, socket, head, (socket) => {
      const spark = new this.Spark(
          socket.upgradeReq.headers               // HTTP request headers.
        , socket.upgradeReq                       // IP address location.
        , url.parse(socket.upgradeReq.url).query  // Optional query string.
        , null                                    // We don't have an unique id.
        , socket.upgradeReq                       // Reference to the HTTP req.
      );

      spark.on('outgoing::end', () => socket && socket.close());
      spark.on('outgoing::data', (data) => {
        if (socket.readyState !== socket.OPEN) return;
        if ('string' === typeof data) return socket.send(data, noop);

        socket.send(data, { binary: true }, noop);
      });

      socket.on('message', spark.emits('incoming::data'));
      socket.on('error', spark.emits('incoming::error'));
      socket.on('ping', spark.emits('incoming::ping', (next) => {
        next(undefined, null);
      }));
      socket.on('close', spark.emits('incoming::end', (next) => {
        socket.removeAllListeners();
        socket = null;
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

  this.once('close',  () => this.service.close());
};
