'use strict';

const sockjs = require('sockjs');
const url = require('url');

const PrimusError = require('../../errors').PrimusError;

/**
 * Minimum viable Sockjs server for Node.js that works through the primus
 * interface.
 *
 * @runat server
 * @api private
 */
module.exports = function server() {
  let fayeOptions = { maxLength: this.primus.options.maxLength };
  let prefix = this.primus.pathname;

  if (this.primus.options.compression) {
    try {
      fayeOptions.extensions = [ require('permessage-deflate') ];
    } catch (e) {
      [
        '',
        'Missing required npm dependency for sockjs',
        'To use the permessage-deflate extension with the sockjs transformer, ',
        'you have to install an additional dependency.',
        'Please run the following command and try again:',
        '',
        '  npm install --save permessage-deflate',
        ''
      ].forEach((line) => console.error(`Primus: ${line}`));

      throw new PrimusError(
        'Missing dependencies for transformer: "sockjs"',
        this.primus
      );
    }
  }

  if (prefix.charAt(prefix.length - 1) !== '/') prefix += '(?:[^/]+)?';

  this.service = sockjs.createServer();

  //
  // We've received a new connection, create a new Spark. The Spark will
  // automatically announce it self as a new connection once it's created (after
  // the next tick).
  //
  this.service.on('connection', (socket) => {
    const headers = socket.headers.via;

    headers.via = headers._via;
    socket.headers.via = null;

    const spark = new this.Spark(
        headers                      // HTTP request headers.
      , socket                       // IP address location.
      , url.parse(socket.url).query  // Optional query string.
      , socket.id                    // Unique connection id.
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
  // Listen to requests.
  //
  const handle = this.service.listener(Object.assign({
    faye_server_options: fayeOptions
  }, this.primus.options.transport, {
    log: this.logger.plain,
    prefix: prefix
  })).getHandler();

  //
  // Here be demons. SockJS has this really horrible "security" feature where it
  // limits the HTTP headers that you're allowed to see and use in your
  // applications. I whole heartly disagree with this decision so we're hacking
  // around this by storing the full header in an accepted header key and re-use
  // that when we construct a Primus Spark.
  //
  this.on('upgrade', (req, socket, head) => {
    req.headers._via = req.headers.via;
    req.headers.via = req.headers;

    handle.call(this, req, socket, head);
  }).on('request', (req, res) => {
    req.headers._via = req.headers.via;
    req.headers.via = req.headers;

    handle.call(this, req, res);
  });
};
