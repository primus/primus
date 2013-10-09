'use strict';

//
// Require all dependencies.
//
// Argh is an light weight argument parser that we use in this example to change
// between parsers and transformers. The following CLI arguments are accepted:
//
// --transformer <value>  (the name of the transformer we want to use)
// --parser <value>       (the name of the parser we want to use)
// --port <value>         (the port number we want to listen to)
//
var argh = require('argh').argv
  , Primus
  , server
  , primus;

//
// Default to the repository, but when we're deployed on a server use the latest
// Primus instance.
//
try { Primus = require('../../'); }
catch (e) { Primus = require('primus'); }

//
// Some build in Node.js modules that we need:
//
var http = require('http')
  , fs = require('fs');

//
// Create a basic server that will send the compiled library or a basic HTML
// file which we can use for testing.
//
server = http.createServer(function server(req, res) {
  res.setHeader('Content-Type', 'text/html');
  fs.createReadStream(__dirname + '/index.html').pipe(res);
});

//
// Now that we've setup our basic server, we can setup our Primus server.
//
primus = new Primus(server, { transformer: argh.transformer, parser: argh.parser });

//
// Listen for new connections and send data
//
primus.on('connection', function connection(spark) {
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
      end: false
    });

    //
    // Major server kill;
    //
    if (packet !== 'kill') return;

    primus.write('Spark: '+spark.id +' asked for a full server kill. Server will be killed within 5 seconds');
    setTimeout(process.exit, 5000);
  });
});

//
// Save the compiled file to the hard disk so it can also be distributed over
// cdn's or just be served by something else than the build-in path.
//
primus.save('primus.js');

//
// Everything is ready, listen to a port number to start the server.
//
server.listen(+argh.port || 8080);
