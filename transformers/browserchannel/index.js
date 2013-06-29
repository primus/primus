'use strict';

var path = require('path')
  , directory = require.resolve('browserchannel')
  , library = path.join(path.dirname(directory), 'dist/bcsocket-uncompressed.js');

//
// Expose the module as new Transformer instance.
//
module.exports = require('../../transformer').extend({
  // Creating a new real-time server.
  server: require('./server'),

  // The client-logic to connect with the a server.
  client: require('./client'),

  // The client-side library of the browserchannel.
  library: require('fs').readFileSync(library, 'utf-8')
});
