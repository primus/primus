'use strict';

module.exports = function base(transformer) {
  var EventEmitter = require('events').EventEmitter;

  var emitter = {
    server: function (primus) {
      primus.transform('incoming', function (packet) {
        var data = packet.data;
        if (!('object' === typeof data && 'event' in data && 'args' in data)) return;

        this.emit.apply(this, [data.event].concat(data.args));
        return false;
      });
    },

    client: function (primus) {
      primus.$emit = function trigger(event) {
        return this.write({
          event: event,
          args: Array.prototype.slice.call(arguments, 1)
        });
      };
    }
  };

  describe('Transformer: '+ transformer, function () {
    var common = require('./common')
      , request = common.request
      , Primus = common.Primus
      , expect = common.expect
      , create = common.create
      , destroy
      , Socket
      , server
      , primus;

    beforeEach(function beforeEach(done) {
      var services = create(transformer, done);

      destroy = services.destroy;
      Socket = services.Socket;
      server = services.server;
      primus = services.primus;
    });

    afterEach(function afterEach(done) {
      primus.destroy(done);

      try { destroy(); }
      catch (e) {}
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

      it('exposes a .socket property', function (done) {
        var socket = new Socket('http://localhost:'+ server.portnumber);

        socket.on('open', function () {
          expect(!!socket.socket).to.equal(true);
          socket.end();
          done();
        });
      });

      it('initialises without `new`', function (done) {
        var socket = Socket('http://localhost:'+ server.portnumber, {
          timeout: 50000
        });

        expect(socket.options.timeout).to.equal(50000);

        socket.on('open', function () {
          socket.end();
          done();
        });
      });

      it('should not throw an error when we connect to a dead server', function (done) {
        var socket = new Socket('http://localhost:1024');

        socket.on('error', function () {
          done();
        });
      });

      it('should not open the socket if we set out state to manual', function (done) {
        var socket = new Socket('http://localhost:'+ server.portnumber, {
          manual: true
        });

        socket.on('open', function () {
          throw new Error('I should be closed');
        });

        setTimeout(function () {
          socket.end();
          done();
        }, 100);
      });

      it('emits errors for incorrect context when theres a listner', function () {
        var socket = new Socket('http://localhost:'+ server.portnumber, {
          manual: true
        }), calls = 0;

        try {
          socket.open.call(new EventEmitter());
        } catch (err) {
          expect(err).to.be.instanceOf(Error);
          expect(err.message).to.contain('Primus#open');
          expect(err.message).to.contain('context');
          calls++;
        }

        expect(calls).to.equal(1);
      });

      it('should change readyStates', function (done) {
        var socket = new Socket('http://localhost:'+ server.portnumber);

        expect(socket.readyState).to.equal(Socket.CLOSED);

        setTimeout(function () {
          expect(socket.readyState).to.equal(Socket.OPENING);
        }, 0);

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

      it('emits an `close` event when its closed', function (done) {
        var socket = new Socket('http://localhost:'+ server.portnumber);

        socket.on('open', function () {
          socket.end();
        }).on('close', done);
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

      it('should not increment the attempt if a backoff is running', function (done) {
        var socket = new Socket('http://localhost:'+ server.portnumber);

        var backoff = {}
          , result = socket.backoff(function () {
              socket.end();
            }, backoff);

        expect(backoff.attempt).to.equal(1);
        expect(result).to.equal(socket);

        result = socket.backoff(function () {
          throw new Error('I should not be called yo');
        }, backoff);

        expect(backoff.attempt).to.equal(1);
        expect(result).to.equal(socket);

        socket.on('end', done);
      });

      it('shoud reset the reconnect details after a succesful reconnect', function (done) {
        var socket = new Socket('http://localhost:'+ server.portnumber, {
          reconnect: {
            minDelay: 100,
            maxDelay: 2000
          }
        }), closed = 0;

        expect(!socket.attempt).to.equal(true);
        this.timeout(5000);

        socket.once('reconnect', function () {
          expect(!!socket.attempt).to.equal(true);
          expect(socket.attempt.attempt).to.be.above(0);
          expect(socket.attempt.minDelay).to.equal(100);
          expect(socket.attempt.maxDelay).to.equal(2000);
          expect(socket.attempt.timeout).to.be.below(2000);
          expect(socket.attempt.timeout).to.be.above(99);
        });

        socket.once('open', function () {
          try { server.close(); destroy(); }
          catch (e) { return done(e); }

          setTimeout(function () {
            var services = create(transformer, function () {}, server.portnumber);

            destroy = services.destroy;
            Socket = services.Socket;
            server = services.server;
            primus = services.primus;
          }, 100);

          socket.once('open', function () {
            socket.removeAllListeners('end');
            socket.end();

            // once from the reconnect, and once from the .end above
            expect(closed).to.equal(2);
            done();
          });
        });

        socket.on('close', function () {
          closed++;
        });

        socket.on('end', function () {
          done(new Error('I shouldnt end'));
        });
      });

      it('can force websocket avoidance', function (done) {
        var socket = new Socket('http://localhost:'+ server.portnumber, {
          websockets: false
        });

        expect(socket.AVOID_WEBSOCKETS).to.equal(true);
        socket.end();

        done();
      });

      describe('#transform', function () {
        it('thrown an error if an invalid type is given', function (done) {
          var socket = new Socket('http://localhost:'+ server.portnumber);

          primus.on('connection', function (spark) {
            spark.end();
            done();
          });

          try { socket.transform('cowsack', function () {}); }
          catch (e) {
            expect(e.message).to.contain('transformer');
          }
        });

        describe('outgoing', function () {
          it('rewrites the outgoing message', function (done) {
            var socket = new Socket('http://localhost:'+ server.portnumber);

            primus.on('connection', function (spark) {
              spark.on('data', function (data) {
                expect(data).to.be.a('object');
                expect(data.meta).to.equal('meta');
                expect(data.message).to.equal('foo');

                spark.end();
                done();
              });
            });

            socket.transform('outgoing', function (data) {
              expect(data).to.be.a('object');
              expect(data.data).to.equal('foo');

              data.data = {
                message: 'foo',
                meta: 'meta'
              };
            });

            socket.write('foo');
          });

          it('prevents the message from being written', function (done) {
            var socket = new Socket('http://localhost:'+ server.portnumber);

            socket.transform('outgoing', function (data) {
              setTimeout(function () {
                socket.end();
                done();
              }, 0);

              return false;
            });

            socket.on('outgoing::data', function () {
              throw new Error('return false should prevent this emit');
            }).write('foo');
          });
        });

        describe('incoming', function () {
          it('rewrites the incoming message', function (done) {
            var socket = new Socket('http://localhost:'+ server.portnumber);

            primus.on('connection', function (spark) {
              spark.write('foo');
            });

            socket.transform('incoming', function (data) {
              expect(data).to.be.a('object');
              expect(data.data).to.equal('foo');

              data.data = {
                message: 'foo',
                meta: 'meta'
              };
            });

            socket.on('data', function (data) {
              expect(data).to.be.a('object');
              expect(data.meta).to.equal('meta');
              expect(data.message).to.equal('foo');

              socket.end();
              done();
            });
          });

          it('prevents the message from being emitted', function (done) {
            var socket = new Socket('http://localhost:'+ server.portnumber);

            primus.on('connection', function (spark) {
              spark.write('foo');
            });

            socket.transform('incoming', function (data) {
              setTimeout(function () {
                socket.end();
                done();
              }, 0);

              return false;
            });

            socket.on('data', function () {
              throw new Error('return false should prevent this emit');
            });
          });
        });
      });
    });

    describe('.createSocket', function () {
      it('can connect to the server', function (done) {
        var PSocket = Primus.createSocket({ transformer: transformer })
          , socket = new PSocket('http://localhost:'+ server.portnumber);

        socket.on('open', function () {
          socket.end();
          done();
        });
      });

      it('should accept plugins', function (done) {
        var PSocket = Primus.createSocket({
              transformer: transformer,
              plugin: {
                emit: emitter
              }
            })
          , socket = new PSocket('http://localhost:'+ server.portnumber);

        expect(socket.$emit).to.be.a('function');
        socket.on('open', function () {
          socket.end();
          done();
        });
      });
    });

    describe('Authorization', function () {
      it('support declined authorization', function (done) {
        primus.authorize(function auth(req, next) {
          expect(req.headers).to.be.a('object');

          next(new Error('I failed'));
        });

        primus.on('connection', function (spark) {
          throw new Error('Auth should be called');
        });

        var Socket = Primus.createSocket({ transformer: transformer, authorization: true })
          , socket = new Socket('http://localhost:'+ server.portnumber);

        socket.on('end', done);
        socket.on('reconnect', function () {
          throw new Error('fuck');
        });
      });

      it('support accepted authorization', function (done) {
        primus.authorize(function auth(req, next) {
          expect(req.headers).to.be.a('object');

          next();
        });

        primus.on('connection', function (spark) {
          spark.end();
        });

        var socket = new Socket('http://localhost:'+ server.portnumber);

        socket.on('end', done);
        socket.on('reconnect', function () {
          throw new Error('fuck');
        });
      });

      it('communicates over an authorized connection', function (done) {
        primus.authorize(function auth(req, next) {
          expect(req.headers).to.be.a('object');

          next();
        });

        primus.on('connection', function (spark) {
          spark.on('data', function (data) {
            expect(data).to.equal('balls');
            spark.end();
            done();
          });
        });

        var socket = new Socket('http://localhost:'+ server.portnumber);
        socket.write('balls');
      });

      if (transformer.toLowerCase() === 'websockets')
      it('should connect using basic auth', function (done) {
        primus.on('connection', function (spark) {
          expect(spark.headers.authorization).to.equal('Basic dXNyOnBhc3M=');
          socket.end();
        });

        var socket = new Socket('http://usr:pass@localhost:'+ server.portnumber +'/?foo=bar');
        socket.on('end', done);
      });

      it('should emit a timeout event if it cannot connect in a timely manner', function (done) {
        primus.authorize(function (req, next) {
          setTimeout(next, 1000);
        });

        var socket = new Socket('http://usr:pass@localhost:'+ server.portnumber +'/?foo=bar', {
          timeout: 500
        });

        socket.on('timeout', done);
      });

      it('should reconnect after the timeout', function (done) {
        primus.authorize(function (req, next) {
          setTimeout(next, 1000);
        });

        var socket = new Socket('http://localhost:'+ server.portnumber, { timeout: 10 })
          , pattern = [];

        socket.on('timeout', function () {
          pattern.push('timeout');
        });

        socket.once('reconnecting', function () {
          pattern.push('reconnecting');
        });

        socket.once('reconnect', function () {
          pattern.push('reconnect');
          expect(pattern.join(',')).to.equal('timeout,reconnecting,reconnect');

          socket.end();
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
            transformer.toLowerCase() !== 'sockjs'
          ) {
            expect(spark.query.foo).to.equal('bar');
          }

          socket.end();
        });

        var socket = new Socket('http://localhost:'+ server.portnumber +'/?foo=bar');
        socket.on('end', done);
      });

      it('should receive all headers', function (done) {
        primus.on('connection', function (spark) {
          expect(spark.headers).to.be.a('object');
          expect(spark.headers).to.have.property('connection');

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
        request(
          'http://localhost:'+ server.portnumber +'/nothrow',
          function (err, res, body) {
            if (err) return done(err);

            expect(body).to.equal('original listener');
            done();
          }
        );
      });

      it('responds to library requests', function (done) {
        request(
          'http://localhost:'+ server.portnumber + '/primus/primus.js',
          function (err, res, body) {
            if (err) return done(err);

            expect(res.statusCode).to.equal(200);
            expect(res.headers['content-type']).to.equal('text/javascript; charset=utf-8');
            expect(body).to.equal(primus.library());
            done();
          }
        );
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

      it('exposes a spec file with the correct transformer', function (done) {
        request(
          'http://localhost:'+ server.portnumber +'/primus/spec',
          function (err, res, body) {
            if (err) return done(err);
            body = JSON.parse(body);

            expect(body.transformer).to.equal(transformer.toLowerCase());
            expect(body.version).to.equal(primus.version);
            expect(body.pathname).to.equal('/primus');
            expect(body.parser).to.equal('json');
            done();
          }
        );
      });

      it('doesnt crash when we write to a closed connection', function (done) {
        primus.on('connection', function (spark) {
          spark.on('end', function () {
            spark.write('I should not crash');

            setTimeout(function () {
              spark.write('the server should ignore me');

              setTimeout(done, 10);
            }, 10);
          });
        });

        var socket = new Socket('http://localhost:'+ server.portnumber);
        socket.on('open', function () {
          socket.end();
        });
      });

      describe('#transform', function () {
        it('thrown an error if an invalid type is given', function (done) {
          try { primus.transform('cowsack', function () {}); }
          catch (e) {
            expect(e.message).to.contain('transformer');
            done();
          }
        });

        describe('outgoing', function () {
          it('rewrites the outgoing message', function (done) {
            primus.transform('outgoing', function (data) {
              expect(data).to.be.a('object');
              expect(data.data).to.equal('foo');

              data.data = {
                message: 'foo',
                meta: 'meta'
              };
            });

            primus.on('connection', function (spark) {
              setTimeout(function () {
                spark.write('foo');
              }, 10);
            });

            var socket = new Socket('http://localhost:'+ server.portnumber);

            socket.on('data', function (data) {
              expect(data).to.be.a('object');
              expect(data.meta).to.equal('meta');
              expect(data.message).to.equal('foo');

              socket.end();
              done();
            });
          });

          it('prevents the message from being written', function (done) {
            primus.transform('outgoing', function () {
              setTimeout(function () {
                socket.end();
                done();
              }, 0);

              return false;
            });

            primus.on('connection', function (spark) {
              spark.on('outgoing::data', function (data) {
                if (~data.indexOf('foo')) throw new Error('return false should prevent this emit');
              });

              spark.write('foo');
            });

            var socket = new Socket('http://localhost:'+ server.portnumber);
          });
        });

        describe('incoming', function () {
          it('rewrites the incoming message', function (done) {
            primus.transform('incoming', function (data) {
              expect(data).to.be.a('object');
              expect(data.data).to.equal('foo');

              data.data = {
                message: 'foo',
                meta: 'meta'
              };
            });

            primus.on('connection', function (spark) {
              spark.on('data', function (data) {
                expect(data).to.be.a('object');
                expect(data.meta).to.equal('meta');
                expect(data.message).to.equal('foo');

                spark.end();
                done();
              });
            });

            var socket = new Socket('http://localhost:'+ server.portnumber);
            socket.write('foo');
          });

          it('prevents the message from being emitted', function (done) {
            primus.transform('incoming', function (data) {
              setTimeout(function () {
                socket.end();
                done();
              }, 0);

              return false;
            });

            primus.on('connection', function (spark) {
              spark.on('data', function () {
                throw new Error('return false should prevent this emit');
              });
            });

            var socket = new Socket('http://localhost:'+ server.portnumber);
            socket.write('foo');
          });
        });
      });
    });
  });
};
