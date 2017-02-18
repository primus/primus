describe('Parsers', function () {
  'use strict';

  var common = require('./common')
    , Primus = common.Primus
    , http = require('http')
    , expect = common.expect
    , server;

  function connectsTest(parser, done) {
    var primus = new Primus(server, { parser: parser })
      , Socket = primus.Socket;

    var socket = new Socket('http://localhost:'+ server.portnumber);

    socket.on('open', function () {
      primus.destroy(done);
    });
  }

  function sendsAndReceivesTest(parser, done) {
    var create = common.create
      , services = create({ transformer: 'websockets', parser }, () => {})
      , Socket = services.Socket
      , primus = services.primus
      , server = services.server;

    var socket = new Socket('http://localhost:'+ server.portnumber);

    socket.on('data', function (data) {
      expect(data).to.equal('hello');
      primus.destroy(done);
    });

    socket.write({ echo: 'hello' });
  }

  beforeEach(function beforeEach(done) {
    server = http.createServer();
    server.portnumber = common.port;
    server.listen(server.portnumber, done);
  });

  describe('binary', function () {
    it('connects with the parser', function (done) {
      connectsTest('binary', done);
    });

    it('sends and receives data using the parser', function (done) {
      sendsAndReceivesTest('binary', done);
    });
  });

  describe('ejson', function () {
    it('connects with the parser', function (done) {
      connectsTest('ejson', done);
    });

    it('sends and receives data using the parser', function (done) {
      sendsAndReceivesTest('ejson', done);
    });
  });

  describe('msgpack', function () {
    it('connects with the parser', function (done) {
      connectsTest('msgpack', done);
    });

    it('sends and receives data using the parser', function (done) {
      sendsAndReceivesTest('msgpack', done);
    });
  });
});
