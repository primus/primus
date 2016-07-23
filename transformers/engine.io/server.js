'use strict';

const engine = require('engine.io');

/**
 * Minimum viable Engine.IO server for Node.js that works through the primus
 * interface.
 *
 * @runat server
 * @api private
 */
module.exports = function server() {
  this.service = new engine.Server(Object.assign({
    perMessageDeflate: !!this.primus.options.compression,
    httpCompression: !!this.primus.options.compression,
    maxHttpBufferSize: this.primus.options.maxLength
  }, this.primus.options.transport));

  //
  // We've received a new connection, create a new Spark. The Spark will
  // automatically announce it self as a new connection once it's created (after
  // the next tick).
  //
  this.service.on('connection', (socket) => {
    const spark = new this.Spark(
        socket.request.headers  // HTTP request headers.
      , socket.request.primus   // IP Address location.
      , socket.request.query    // Optional query string.
      , socket.id               // Unique connection id.
      , socket.request          // Reference to the HTTP req.
    );

    spark.on('outgoing::end', () => socket && socket.close());
    spark.on('outgoing::data', (data) => socket.write(data));

    socket.on('error', spark.emits('incoming::error'));
    socket.on('data', spark.emits('incoming::data'));
    socket.on('close', spark.emits('incoming::end', (next) => {
      socket.removeAllListeners();
      socket = null;
      next();
    }));
  });

  //
  // Listen to upgrade requests.
  //
  this.on('upgrade', (req, socket, head) => {
    this.service.handleUpgrade(req, socket, head);
  }).on('request', (req, res) => {
    //
    // Engine.IO closes the handshake socket before we receive a `connection`
    // event. And as the socket is already answered it can be undefined.
    //
    req.primus = {
      remoteAddress: req.socket.remoteAddress,
      remotePort: req.socket.remotePort
    };

    this.service.handleRequest(req, res);
  }).once('close',  () => {
    if (this.service.ws) this.service.ws.close();
    this.service.close();
  });
};
