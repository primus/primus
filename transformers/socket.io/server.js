'use strict';

var PrimusError = require('../../errors').PrimusError;

/**
 * Minimum viable WebSocket server for Node.js that works through the Primus
 * interface.
 *
 * @runat server
 * @api private
 */
module.exports = function server() {
  var Engine = require('socket.io').Manager
    , Spark = this.Spark
    , primus = this.primus;

  //
  // Socket.IO is not, and will never be supported as long as it's using
  // Engine.IO.
  //
  if ('function' !== typeof Engine) {
    [
      '',
      'We\'ve detected that you are using Socket.IO 1.x',
      'This version is not supported as it\'s just a layer on top of Engine.IO.',
      'It\'s much more efficient to use Engine.IO directly as all features of Socket.IO',
      'are already available in Primus and it\'s more stable due to our extra patches.',
      '',
      'Either run `npm install --save engine.io` or `npm install --save socket.io@0.9.x`',
      '',
      'See https://github.com/primus/primus#socketio for more information.',
      ''
    ].forEach(function each(line) {
      console.error('Primus: '+ line);
    });
    throw new PrimusError('Unsupported Socket.IO version', primus);
  }

  //
  // Listen to upgrade requests.
  //
  var service = this.service = new Engine(this, {
    'resource': primus.pathname,

    //
    // This is a security feature of Socket.IO which was build to prevent people
    // from spamming your server with data. But as outlined in
    // LearnBoost/socket.io#1519 they forgot to clear the internal _dataLength
    // property. So long running connections or sending frequent data will
    // result in to random disconnects. Setting this property to infinity solves
    // the disconnects for now..
    //
    'destroy buffer size': Infinity,

    //
    // Don't destroy upgrades, this should be handled by Primus so it can return
    // a human readable response.
    //
    'destroy upgrade': false,

    //
    // We're not serving the Socket.IO client, disable this.
    //
    'browser client': false,

    //
    // Use our own custom logger instance so we can emit `log` events instead of
    // writing/spamming terminals.
    //
    'logger': this.logger
  });

  //
  // We've received a new connection, create a new Spark. The Spark will
  // automatically announce it self as a new connection once it's created (after
  // the next tick).
  //
  this.service.on('connection', function connection(socket) {
    var spark = new Spark(
        socket.handshake.headers                  // HTTP request headers.
      , socket.handshake                          // IP address location.
      , socket.handshake.query                    // Optional query string.
      , socket.id                                 // Unique connection id.
      , service.transports[socket.id].req         // Reference to an HTTP req.
    );

    spark.on('outgoing::end', function end() {
      if (socket) socket.disconnect();
    }).on('outgoing::data', function write(data) {
      socket.send(data);
    });

    socket.on('message', spark.emits('data'));
    socket.on('error', spark.emits('error'));
    socket.on('disconnect', spark.emits('end', function parser() {
      socket.removeAllListeners();
      socket = null;
    }));
  });

  this.once('close', function close() {
    service.sockets.clients().forEach(function shutdown(socket) {
      socket.disconnect();
    });

    service.store.destroy();
    service.store.removeAllListeners();
  });
};
