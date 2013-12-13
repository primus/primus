'use strict';

var Primus = require('../../')
  , http = require('http')
  , spdy = require('spdy')
  , argh = require('argh')
  , path = require('path')
  , fs = require('fs');

//
// Create a server where we will connect from.
//
http.createServer(function handle(req, res) {
  if (~req.url.indexOf('primus')) throw new Error('No Primus requests should be served');

  res.setHeader('Content-Type', 'text/html');
  fs.createReadStream(__dirname +'/index.html').pipe(res);
}).listen(5000);

//
// Create the HTTPS server where we can attach our primus server on.
//
var server = spdy.createServer({
  key: fs.readFileSync(path.join(__dirname, '../../test/ssl/server.key')),
  cert: fs.readFileSync(path.join(__dirname, '../../test/ssl/server.crt')),
  windowSize: 1024 * 1024,
  autoSpdy31: false
}, function handle(req, res) {
  res.setHeader('Content-Type', 'text/html');
  fs.createReadStream(__dirname +'/index.html').pipe(res);
});

//
// Attach the primus server on spdy server.
//
var primus = new Primus(server, {
  transformer: argh.argv.transformer || 'engine.io',
  parser: argh.argv.parser || 'JSON'
});

primus.on('connection', function connection(spark) {
  console.log(spark.id, ' has connected');

  spark.on('data', function data(msg) {
    console.log(spark.id, ' send: ', msg);
  });

  spark.on('end', function end() {
    console.log(spark.id, ' has disconnected');
  });
});

server.listen(443, function connected() {
  console.log('original server listening on https://localhost:443');
  console.log('proxy server listening on http://localhost:5000');
});
