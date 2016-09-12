'use strict';

const http = require('http');
const url = require('url');
const uws = require('uws');

/**
 * Server of µWebSockets transformer.
 *
 * @runat server
 * @api private
 */
module.exports = function server() {
  const options = this.primus.options;
  const maxLength = options.transport.maxPayload || options.maxLength;
  let mask = 0;

  if (options.compression || options.transport.perMessageDeflate) {
    mask = uws.PERMESSAGE_DEFLATE;
    if (options.transport.perMessageDeflate) {
      if (options.transport.perMessageDeflate.serverNoContextTakeover) {
        mask |= uws.SERVER_NO_CONTEXT_TAKEOVER;
      }
      if (options.transport.perMessageDeflate.clientNoContextTakeover) {
        mask |= uws.CLIENT_NO_CONTEXT_TAKEOVER;
      }
    }
  }

  this.service = new uws.uws.Server(0, mask, maxLength);

  this.service.onMessage((msg, spark) => {
    //
    // Binary data is passed zero-copy as an `ArrayBuffer` so we first have to
    // convert it to a `Buffer` and then copy it to a new `Buffer`.
    //
    if ('string' !== typeof msg) msg = Buffer.from(Buffer.from(msg));

    spark.emit('incoming::data', msg);
  });

  this.service.onDisconnection((socket, code, msg, spark) => {
    this.service.setData(socket);
    spark.ultron.remove('outgoing::end');
    spark.emit('incoming::end');
  });

  //
  // Listen to upgrade requests.
  //
  this.on('upgrade', (req, soc) => {
    const secKey = req.headers['sec-websocket-key'];

    if (secKey && secKey.length === 24) {
      soc.setNoDelay(options.transport.noDelay);

      let socketHandle = soc._handle;
      let sslState = null;

      if (soc.ssl) {
        socketHandle = soc._parent._handle;
        sslState = soc.ssl._external;
      }

      const ticket = this.service.transfer(
        socketHandle.fd === -1 ? socketHandle : socketHandle.fd,
        sslState
      );

      soc.on('close', () => {
        this.service.onConnection((socket) => {
          const spark = new this.Spark(
              req.headers               // HTTP request headers.
            , req                       // IP address location.
            , url.parse(req.url).query  // Optional query string.
            , null                      // We don't have an unique id.
            , req                       // Reference to the HTTP req.
          );

          this.service.setData(socket, spark);

          spark.ultron.on('outgoing::end', () => this.service.close(socket));
          spark.on('outgoing::data', (data) => {
            const opcode = Buffer.isBuffer(data)
              ? uws.OPCODE_BINARY
              : uws.OPCODE_TEXT;

            this.service.send(socket, data, opcode);
          });
        });

        this.service.upgrade(ticket, secKey, req.headers['sec-websocket-extensions']);
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

  this.once('close', () => this.service.close());
};
