'use strict';

var path = require('path')
  , directory = path.dirname(require.resolve('socket.io'))
  , library = path.join(directory, 'node_modules/socket.io-client/dist/socket.io.js');

//
// Testing edge-case. We're also installing the socket.io-client and npm tries
// to be a smarty pants and optimize our packages and removes the
// socket.io-client from the dependencies directory as it's already in the
// parents `node_module`.
//
try {
  directory = path.dirname(require.resolve('socket.io-client'));
  library = path.join(directory, '../dist/socket.io.js');
} catch (e) {}

//
// Expose the module as new Transformer instance.
//
module.exports = require('../../transformer').extend({
  // Creating a new real-time server.
  server: require('./server'),

  // The client-logic to connect with the a server.
  client: require('./client'),

  // The client-side library of socket.io.
  library: require('fs').readFileSync(library, 'utf-8')
});
