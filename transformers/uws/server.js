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
  const options = this.primus.options;

  //
  // The `maxPayload` option is ignored by `uws` since version 0.10.0.
  // The value has been hardcoded to 16 MiB in version 0.10.9 so using
  // `options.transport.maxPayload` or `options.maxLength` as second
  // argument is useless here.
  //
  const group = native.server.group.create(
    options.compression || options.transport.perMessageDeflate ? 1 : 0
  );

  let upgradeReq = null;

  native.server.group.onConnection(group, (socket) => {
    const spark = new this.Spark(
      upgradeReq.headers,               // HTTP request headers.
      upgradeReq,                       // IP address location.
      url.parse(upgradeReq.url).query,  // Optional query string.
      null,                             // We don't have an unique id.
      upgradeReq                        // Reference to the HTTP req.
    );

    native.setUserData(socket, spark);

    spark.ultron.on('outgoing::end', () => native.server.close(socket));
    spark.on('outgoing::data', (data) => {
      const opcode = Buffer.isBuffer(data)
        ? uws.OPCODE_BINARY
        : uws.OPCODE_TEXT;

      native.server.send(socket, data, opcode);
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

  //
  // Listen to upgrade requests.
  //
  this.on('upgrade', (req, soc) => {
    const secKey = req.headers['sec-websocket-key'];

    if (soc.readable && soc.writable && secKey && secKey.length === 24) {
      soc.setNoDelay(options.transport.noDelay);

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
