'use strict';

//
// Expose the module as new Transformer instance.
//
module.exports = require('../../transformer').extend({
  // Creating a new real-time server.
  server: require('./server'),

  // The client-logic to connect with the server.
  client: require('./client')
});
