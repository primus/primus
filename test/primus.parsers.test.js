describe('Parsers', function () {
  'use strict';

  var common = require('./common')
    , Primus = common.Primus
    , http = require('http')
    , expect = common.expect
    , server
    , primus;

  beforeEach(function beforeEach(done) {
    server = http.createServer();
    server.portnumber = common.port;
    server.listen(server.portnumber, done);
  });

  describe('binary', function () {
    it('connects with the parser', function (done) {
      var primus = new Primus(server, { parser: 'binary' })
        , Socket = primus.Socket;

      var socket = new Socket('http://localhost:' + server.portnumber);

      socket.on('open', function () {
        primus.destroy(done);
      });
    });
  });

  describe('ejson', function () {
    it('connects with the parser', function (done) {
      var primus = new Primus(server, { parser: 'ejson' })
        , Socket = primus.Socket;

      var socket = new Socket('http://localhost:' + server.portnumber);

      socket.on('open', function () {
        primus.destroy(done);
      });
    });
  });
});
