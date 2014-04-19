'use strict';

var chai = require('chai')
  , http = require('http')
  , path = require('path')
  , fs = require('fs');

chai.config.includeStack = true;
http.globalAgent.maxSockets = 15;

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
  var pathname;

  if (typeof port === 'string') {
    if (port.indexOf('/', port.length - 1) < 0) {
      pathname = port;
    } else {
      pathname = port;
      port = exports.port;
      pathname = path.join(pathname, port + '');
    }
    if (fs.existsSync(pathname)) {
      fs.unlinkSync(pathname);
    }
  } else {
    port = port || exports.port;
  }

  var server = http.createServer(function handle(req, res) {
    console.error('');
    console.error('Uncaught request', req.url);
    console.error('');

    if (req.url !== '/nothrow') throw new Error('I should never be called');
    res.end('original listener');
  });

  var primus = new exports.Primus(server, {
    transformer: transformer,
    pathname: pathname
  });

  primus.on('connection', function connection(spark) {
    spark.on('data', function data(packet) {
      if (packet.echo) spark.write(packet.echo);
      if (packet.pipe) fs.createReadStream(__filename).pipe(spark, {
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

  server.portnumber = pathname || port;
  server.pathname = pathname;

  server.listen(pathname || port, fn);

  if (pathname) {
    server.make_addr = function (auth, query) {
      return 'ws+unix://' + (auth ? auth + '@' : '') + pathname;
    };
  } else {
    server.make_addr = function (auth, query) {
      return 'http://' + (auth ? auth + '@' : '') + 'localhost:' + port + (query ? '/' + query : '');
    };
  }

  server.addr = server.make_addr();

  return {
    Socket: primus.Socket,
    destroy: destroy,
    server: server,
    primus: primus
  };
};
