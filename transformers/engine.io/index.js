'use strict';

//
// Expose the module as new Transporter instance.
//
module.exports = require('../../transporter').extend({
  // Creating a new real-time server.
  server: require('./server'),

  // The client-logic to connect with the a server.
  client: require('./client'),

  // The client-side library of engine.io.
  library: require('fs').readFileSync(__dirname + '/library.js', 'utf-8')
});
