'use strict';

//
// Require all dependencies.
//
// Argh is an light weight argument parser that we use in this example to change
// between parsers and transformers. The following CLI arguments are accepted:
//
// --transformer <value>  (the name of the transformer we want to use)
// --parser <value>       (the name of the parser we want to use)
// --url <value>          (the server we want to connect to)
//
var argh = require('argh').argv
  , Primus = require('../')
  , Socket;

//
// Create a socket that's compatible with the given parser and transformer.
//
Socket = Primus.createSocket({
  transformer: argh.transformer,
  parser: argh.parser
});

//
// Open a connection to the server
//
var socket = new Socket(argh.url || 'http://primus-example.nodejitsu.com');

socket.on('open', function open() {
  console.log('The connection has been opened.');
}).on('end', function end() {
  console.log('The connection has been closed.');
}).on('reconnecting', function reconnecting(opts) {
  console.log('We are scheduling a reconnect operation', opts);
}).on('data', function incoming(data) {
  console.log('Received some data', data);
});
