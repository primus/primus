'use strict';

const crypto = require('crypto');
const chai = require('chai');
const http = require('http');
const fs = require('fs');

chai.config.includeStack = true;

//
// Expose primus
//
exports.Primus = require('..');

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
let port = 1111;
Object.defineProperty(exports, 'port', {
  get() { return port++; }
});

//
// Expose a server creation utility.
//
exports.create = function create(options, fn) {
  const server = http.createServer(function handle(req, res) {
    console.error('');
    console.error('Uncaught request', req.url);
    console.error('');

    if (req.url !== '/nothrow') throw new Error('I should never be called');
    res.end('original listener');
  });

  const primus = new exports.Primus(server, {
    transformer: options.transformer,
    pathname: options.pathname,
    parser: options.parser
  });

  primus.on('connection', function connection(spark) {
    spark.on('data', function data(packet) {
      if (packet.echo) spark.write(packet.echo);
      if (packet.pipe) fs.createReadStream(__filename).pipe(spark, {
        autoClose: false
      });
    });
  });

  const upgrades = [];
  const requests = [];

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

  if (options.unixSocket) {
    server.portnumber = `/tmp/primus.${crypto.randomBytes(16).toString('hex')}.socket`;
    server.make_addr = function (auth, query) {
      return 'ws+unix://'+ (auth ? `${auth}@` : '') + server.portnumber + (query || '');
    };
  } else {
    server.portnumber = options.port || exports.port;
    server.make_addr = function (auth, query) {
      return 'http://'+ (auth ? auth + '@' : '') +'localhost:'+ server.portnumber + (query || '');
    };
  }

  server.pathname = options.pathname;
  server.addr = server.make_addr();

  server.listen(server.portnumber, fn);

  return {
    Socket: primus.Socket,
    destroy,
    server,
    primus
  };
};
