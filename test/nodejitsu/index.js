'use strict';

var argh = require('argh').argv
  , Primus = require('primus')
  , http = require('http')
  , fs = require('fs');

//
// Create a HTTP server where we will mount all apps under.
//
var server = http.createServer(function server(req, res) {
  res.end('This is a test server for Primus, http://github.com/3rd-Eden/primus');
});

/**
 * General connection listener.
 *
 * @param {Spark} spark Socket connection.
 * @api private
 */
function connection(spark) {
  console.log('new connection');

  spark.on('data', function data(packet) {
    console.log('incoming:', packet);

    //
    // Close the connection.
    //
    if (packet === 'end') spark.end();

    //
    // Echo the responses.
    //
    if (packet.echo) spark.write(packet.echo);

    //
    // Pipe in some data.
    //
    if (packet.pipe) fs.createReadStream(__dirname + '/index.html').pipe(spark, {
      autoClose: false,   // Node.js 0.10
      end: false          // Node.js 0.8
    });
  });
}

//
// Generate a WebSockets library.
//
var WebSockets = new Primus(server, {
  transformer: 'websockets',
  pathname: '/websockets'
}).save(__dirname + '/primus.websocket.js');

WebSockets.on('connection', connection);

//
// Generate a Engine.IO library.
//
var Engine = new Primus(server, {
  transformer: 'engine.io',
  pathname: '/engine.io'
}).save(__dirname + '/primus.engine.io.js');

Engine.on('connection', connection);

//
// Generate a Socket.IO library.
//
var Socket = new Primus(server, {
  transformer: 'socket.io',
  pathname: '/socket.io'
}).save(__dirname + '/primus.socket.io.js');

Socket.on('connection', connection);

//
// Generate a SockJS library.
//
var SockJS = new Primus(server, {
  transformer: 'sockjs',
  pathname: '/sockjs'
}).save(__dirname + '/primus.sockjs.js');

SockJS.on('connection', connection);

//
// Generate a WebSocket library with a JSONH parser.
//
var JSONH = new Primus(server, {
  transformer: 'websockets',
  pathname: 'jsonh'
}).save(__dirname + '/primus.jsonh.js');

Engine.on('connection', connection);

//
// We only needed to save the library, bailout
//
if (argh.generate) return process.exit(0);

//
// Listen for incoming requests.
//
server.listen(8080);
