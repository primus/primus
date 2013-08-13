'use strict';

var chai = require('chai');
chai.Assertion.includeStack = true;

//
// Expose primus
//
exports.Primus = require('../');

//
// Expose our assertions.
//
exports.expect = chai.expect;

//
// Expose request
//
exports.request = require('request');

//
// Expose a port number generator.
//
var port = 1111;
Object.defineProperty(exports, 'port', {
  get: function get() {
    return port++;
  }
});

//
// Expose a server creation utility.
//
exports.create = function create(transformer, fn, port) {
  port = port || exports.port;

  var server = require('http').createServer(function handle(req, res) {
    console.error('');
    console.error('Uncaught request', req.url);
    console.error('');

    if (req.url !== '/nothrow') throw new Error('I should never be called');
    res.end('original listener');
  });

  var primus = new exports.Primus(server, { transformer: transformer });

  primus.on('connection', function connection(spark) {
    spark.on('data', function data(packet) {
      if (packet.echo) spark.write(packet.echo);
      if (packet.pipe) require('fs').createReadStream(__filename).pipe(spark, {
        autoClose: false
      });
    });
  });

  var upgrades = []
    , requests = [];

  server.on('request', function incoming(req, res) {
    requests.push(res);
  });

  server.on('upgrade', function upgrade(req, socket) {
    upgrades.push(socket);
  });

  function destroy() {
    upgrades.forEach(function destroy(socket) {
      try { socket.destroy(); }
      catch (e) {}
    });

    requests.forEach(function end(res) {
      try { res.end(''); }
      catch (e) {}
    });

    upgrades.length = requests.length = 0;
  }

  server.portnumber = port;
  server.listen(port, fn);

  return {
    Socket: primus.Socket,
    destroy: destroy,
    server: server,
    primus: primus
  };
};
