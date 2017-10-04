describe('Parsers', function () {
  'use strict';

  const common = require('./common');
  const expect = common.expect;

  function connectsTest(parser, done) {
    const services = common.create({ parser }, () => {
      const port = services.server.portnumber;
      const socket = new services.Socket(`http://localhost:${port}`);

      socket.on('open', function () {
        services.primus.destroy(done);
      });
    });
  }

  function sendsAndReceivesTest(parser, done) {
    const services = common.create({ parser }, () => {
      const port = services.server.portnumber;
      const socket = new services.Socket(`http://localhost:${port}`);

      socket.on('data', function (data) {
        expect(data).to.equal('hello');
        services.primus.destroy(done);
      });

      socket.write({ echo: 'hello' });
    });
  }

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
