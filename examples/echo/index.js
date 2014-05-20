'use strict';

//
// Create the HTTP server and serve our index.html
//
var server = require('http').createServer(function incoming(req, res) {
  res.setHeader('Content-Type', 'text/html');
  require('fs').createReadStream(__dirname + '/index.html').pipe(res);
});

//
// Attach Primus to the HTTP server.
//
var Primus = require('../..')
  , primus = new Primus(server);

//
// Listen for connections and echo the events send.
//
primus.on('connection', function connection(spark) {
  spark.on('data', function received(data) {
    console.log(spark.id, 'received message:', data);
    spark.write(data);
  });
});

server.listen(8080, function () {
  console.log('Open http://localhost:8080 in your browser');
});
