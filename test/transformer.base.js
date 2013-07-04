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
      server = http.createServer(function (req, res) {
        console.error('Uncaught request', req.url);
        if (req.url !== '/nothrow') throw new Error('I should never be called');

        res.end('original listener');
      });

      primus = new Primus(server, { transformer: transformer });
      Socket = primus.Socket;

      primus.on('connection', function (spark) {
        spark.on('data', function data(packet) {
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

      it('receives the raw packet data', function (done) {
        var socket = new Socket('http://localhost:'+ server.portnumber);

        socket.on('data', function (message, raw) {
          var data = JSON.stringify(message);
          expect(message).to.equal('pong');

          expect(raw).to.not.equal(message);
          expect(data).to.equal(raw);

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

      it('should reconnect when the connection closes unexcpectingly', function (done) {
        primus.on('connection', function (spark) {
          if (!reconnected) {
            reconnected = true;

            //
            // Forcefully kill a connection to trigger a reconnect
            //
            switch (transformer.toLowerCase()) {
              case 'socket.io':
                primus.transformer.service.transports[spark.id].close();
              break;

              default:
                spark.emit('outgoing::end');
            }
          }
        });

        var socket = new Socket('http://localhost:'+ server.portnumber)
          , reconnected = false
          , reconnect = false
          , opened = 0;

        socket.on('reconnect', function (message) {
          reconnect = true;
        });

        socket.on('open', function () {
          if (++opened !== 2) return;

          expect(reconnect).to.equal(true);

          primus.forEach(function (socket) {
            socket.end();
          });

          done();
        });
      });
    });

    describe('Server', function () {
      it('emits `end` when the connection is closed', function (done) {
        primus.on('connection', function (spark) {
          spark.on('end', done);
        });

        var socket = new Socket('http://localhost:'+ server.portnumber);

        socket.on('open', function () {
          socket.end();
        });
      });

      it('should emit an `error` when it fails to encode the data', function (done) {
        primus.on('connection', function (spark) {
          var data = { foo: 'bar' };
          data.recusrive = data;

          spark.on('error', function (err) {
            expect(err).to.not.be.a('string');
            expect(err.message).to.include('JSON');

            socket.end();
            done();
          });

          spark.write(data);
        });

        var socket = new Socket('http://localhost:'+ server.portnumber);
      });

      it('should receive querystrings', function (done) {
        primus.on('connection', function (spark) {
          expect(spark.query).to.be.a('object');

          if (
               transformer.toLowerCase() !== 'browserchannel'
            && transformer.toLowerCase() !== 'sockjs'
          ) {
            expect(spark.query.foo).to.equal('bar');
          }

          socket.end();
        });

        var socket = new Socket('http://localhost:'+ server.portnumber +'/?foo=bar');
        socket.on('end', done);
      });

      it('should not trigger a reconnect when we end the connection', function (done) {
        primus.on('connection', function (spark) {
          spark.end();
        });

        var socket = new Socket('http://localhost:'+ server.portnumber);

        socket.on('end', done);
        socket.on('reconnect', function () {
          throw new Error('fuck');
        });
      });

      it('should still allow requests to the original listener', function (done) {
        common.request('http://localhost:'+ server.portnumber +'/nothrow', function (err, res, body) {
          if (err) return done(err);

          expect(body).to.equal('original listener');
          done();
        });
      });

      it('correctly parses the ip address', function (done) {
        primus.on('connection', function (spark) {
          var address = spark.address;
          expect(address.port).to.not.equal(0);
          expect(address.port).to.not.equal(server.portnumber);

          spark.end();
          done();
        });

        var socket = new Socket('http://localhost:'+ server.portnumber);
      });

      it('uses x-forwarded headers over the connection ip address', function (done) {
        primus.on('connection', function (spark) {
          spark.headers['x-forwarded-for'] = '13.3.37.1,12.12.12.12';
          spark.headers['x-forwarded-port'] = '9083,1334';

          expect(spark.address.ip).to.equal('13.3.37.1');
          expect(spark.address.port).to.equal(9083);

          spark.end();
          done();
        });

        var socket = new Socket('http://localhost:'+ server.portnumber);
      });
    });
  });
};
