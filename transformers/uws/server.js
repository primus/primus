'use strict';

var parse = require('url').parse
  , http = require('http')
  , uws = require('uws');

/**
 * Server of µWebSockets transformer.
 *
 * @runat server
 * @api private
 */
module.exports = function server() {
  var options = this.primus.options
    , Spark = this.Spark
    , mask = 0;

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

  var service = this.service = new uws.uws.Server(0, mask, options.transport.maxPayload);

  service.onMessage(function message(socket, msg, binary, spark) {
    spark.emit('incoming::data', binary ? msg : msg.toString());
  });

  service.onDisconnection(function close(socket, code, msg, spark) {
    service.setData(socket);
    spark.ultron.remove('outgoing::end');
    spark.emit('incoming::end');
  });

  //
  // Listen to upgrade requests.
  //
  this.on('upgrade', function upgrade(req, soc, head) {
    var secKey = req.headers['sec-websocket-key']
      , ticket;

    if (secKey && secKey.length === 24) {
      soc.setNoDelay(options.transport.noDelay);
      ticket = service.transfer(soc._handle.fd, soc.ssl ? soc.ssl._external : null);

      soc.on('close', function destroy() {
        service.onConnection(function create(socket) {
          var spark = new Spark(
              req.headers               // HTTP request headers.
            , req                       // IP address location.
            , parse(req.url).query      // Optional query string.
            , null                      // We don't have an unique id.
            , req                       // Reference to the HTTP req.
          );

          service.setData(socket, spark);

          spark.ultron.on('outgoing::end', function end() {
            service.close(socket);
          }).on('outgoing::data', function write(data) {
            var opcode = Buffer.isBuffer(data) ? uws.OPCODE_BINARY : uws.OPCODE_TEXT;

            service.send(socket, data, opcode);
          });
        });

        service.upgrade(ticket, secKey);
      });
    }

    soc.destroy();
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
