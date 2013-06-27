'use strict';

var Primus = require('../../')
  , http = require('http')
  , fs = require('fs');

//
// Dummy server, as we are only interested in the client-side libraries.
//
var server = http.createServer();

//
// Generate a WebSockets library.
//
var WebSockets = new Primus(server, { transformer: 'websockets' });
fs.writeFileSync(__dirname + '/primus.websocket.js', WebSockets.library());

//
// Generate a Engine.IO library.
//
var Engine = new Primus(server, { transformer: 'engine.io' });
fs.writeFileSync(__dirname + '/primus.engine.io.js', Engine.library());

//
// Generate a WebSocket library with a JSONH parser.
//
var JSONH = new Primus(server, { transformer: 'websockets' });
fs.writeFileSync(__dirname + '/primus.jsonh.js', JSONH.library());

//
// We're done with regenerating.
//
process.exit(0);
