'use strict';

module.exports = function base(transformer) {
  describe('Transformer: '+ transformer, function () {
    var common = require('./common')
      , Primus = common.Primus
      , http = require('http')
      , expect = common.expect
      , Socket
      , server
      , primus;

    beforeEach(function beforeEach(done) {
      server = http.createServer();
      primus = new Primus(server, { transformer: transformer });
      Socket = primus.Socket;

      primus.on('connection', function (spark) {
        spark.on('data', function data(packet) {
          if (packet === 'end') spark.end();
          if (packet.echo) spark.write(packet.echo);
          if (packet.pipe) require('fs').createReadStream(__filename).pipe(spark, {
            autoClose: false
          });
        });
      });

      server.portnumber = common.port;
      server.listen(server.portnumber, done);
    });

    afterEach(function afterEach(done) {
      server.close(done);
    });

    describe('.Socket', function () {
      it('exposes a complatible socket', function () {
        expect(Socket).to.be.a('function');
      });

      it('emits an `open` event when its connected', function (done) {
        var socket = new Socket('http://localhost:'+ server.portnumber);

        socket.on('open', function () {
          socket.end();
          done();
        });
      });

      it('should change readyStates', function (done) {
        var socket = new Socket('http://localhost:'+ server.portnumber);

        expect(socket.readyState).to.equal(Socket.OPENING);

        socket.on('open', function () {
          expect(socket.readyState).to.equal(Socket.OPEN);
          socket.end();
        }).on('end', function () {
          expect(socket.readyState).to.equal(Socket.CLOSED);
          done();
        });
      });

      it('emits an `end` event when its closed', function (done) {
        var socket = new Socket('http://localhost:'+ server.portnumber);

        socket.on('open', function () {
          socket.end();
        }).on('end', done);
      });

      it('only emits `end` once', function (done) {
        var socket = new Socket('http://localhost:'+ server.portnumber);

        socket.on('open', function () {
          socket.end();
          socket.end();
          socket.end();
          socket.end();
          socket.end();
          socket.end();
        }).on('end', done);
      });

      it('sends & receives messages', function (done) {
        var socket = new Socket('http://localhost:'+ server.portnumber);

        socket.on('data', function (message) {
          expect(message).to.equal('pong');
          socket.end();
          done();
        });

        socket.on('open', function () {
          socket.write({ echo: 'pong' });
        });
      });

      it('emits an `error` event when it cannot encode the data', function (done) {
        var socket = new Socket('http://localhost:'+ server.portnumber);

        socket.on('open', function () {
          var data = { foo: 'bar' };
          data.recusrive = data;

          socket.write(data);
        }).on('error', function (err) {
          expect(err).to.not.be.instanceOf(String);
          expect(err.message).to.contain('JSON');

          socket.end();
          done();
        });
      });

      it('buffers messages before it connected', function (done) {
        var socket = new Socket('http://localhost:'+ server.portnumber)
          , messages = 10
          , received = 0;

        for (var i = 0; i <= messages; i++) {
          socket.write({ echo: i });
        }

        socket.on('data', function (message) {
          expect(message).to.be.a('number');

          if (++received === messages) {
            socket.end();
            done();
          }
        });
      });

      it('should not reconnect when we close the connection', function (done) {
        var socket = new Socket('http://localhost:'+ server.portnumber);

        socket.on('open', function (message) {
          socket.end();
          done();
        });

        socket.on('reconnect', function () {
          throw new Error('fuck');
        });
      });
    });
  });
};
