'use strict';

var path = require('path')
  , directory = path.dirname(require.resolve('socket.io'))
  , library = path.join(directory, 'node_modules/socket.io-client/dist/socket.io.js');

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
