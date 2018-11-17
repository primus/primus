'use strict';

const http = require('http');
const url = require('url');
const uws = require('uws');

const native = uws.native;

//
// uws v0.12.0+ needs a set "no operation" callback.
//
if (native.setNoop) native.setNoop(() => {});

/**
 * Server of µWebSockets transformer.
 *
 * @runat server
 * @api private
 */
module.exports = function server() {
  const opts = Object.assign({
    perMessageDeflate: !!this.primus.options.compression,
    maxPayload: this.primus.options.maxLength
  }, this.primus.options.transport);

  this.service = native.server;

  let flags = 0;

  if (opts.perMessageDeflate) {
    flags |= uws.PERMESSAGE_DEFLATE;
    if (opts.perMessageDeflate.serverNoContextTakeover === false) {
      flags |= uws.SLIDING_DEFLATE_WINDOW;
    }
  }

  const group = native.server.group.create(flags, opts.maxPayload);
  let upgradeReq = null;

  native.server.group.onConnection(group, (socket) => {
    const spark = new this.Spark(
      upgradeReq.headers,               // HTTP request headers.
      upgradeReq,                       // IP address location.
      url.parse(upgradeReq.url).query,  // Optional query string.
      null,                             // We don't have an unique id.
      upgradeReq,                       // Reference to the HTTP req.
      socket                            // Reference to the socket.
    );

    native.setUserData(socket, spark);

    spark.ultron.on('outgoing::end', () => native.server.close(socket));
    spark.on('outgoing::data', (data) => {
      const opcode = Buffer.isBuffer(data)
        ? uws.OPCODE_BINARY
        : uws.OPCODE_TEXT;

      native.server.send(socket, data, opcode, undefined, true);
    });
  });

  native.server.group.onDisconnection(group, (socket, code, msg, spark) => {
    native.clearUserData(socket);
    spark.ultron.remove('outgoing::end');
    spark.emit('incoming::end');
  });

  native.server.group.onMessage(group, (msg, spark) => {
    //
    // Binary data is passed zero-copy as an `ArrayBuffer` so we first have to
    // convert it to a `Buffer` and then copy it to a new `Buffer`.
    //
    if ('string' !== typeof msg) msg = Buffer.from(Buffer.from(msg));

    spark.emit('incoming::data', msg);
  });

  native.server.group.onPing(group, (msg, spark) => spark.emit('incoming::pong'));

  //
  // Listen to upgrade requests.
  //
  this.on('upgrade', (req, soc) => {
    const secKey = req.headers['sec-websocket-key'];

    if (soc.readable && soc.writable && secKey && secKey.length === 24) {
      soc.setNoDelay(opts.noDelay);

      let socketHandle = soc._handle;
      let sslState = null;

      if (soc.ssl) {
        socketHandle = soc._parent._handle;
        sslState = soc.ssl._external;
      }

      const ticket = native.transfer(
        socketHandle.fd === -1 ? socketHandle : socketHandle.fd,
        sslState
      );

      soc.on('close', () => {
        upgradeReq = req;
        native.upgrade(
          group,
          ticket,
          secKey,
          req.headers['sec-websocket-extensions']
        );

        //
        // Delete references to destroyed socket.
        //
        req.client = req.connection = req.socket = null;
        upgradeReq = null;
      });
    }

    soc.destroy();
  });

  //
  // Listen to non-upgrade requests.
  //
  this.on('request', (req, res) => {
    res.writeHead(426, { 'content-type': 'text/plain' });
    res.end(http.STATUS_CODES[426]);
  });

  this.once('close', () => native.server.group.close(group));
};
