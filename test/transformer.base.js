'use strict';

module.exports = function base(transformer, transformer_name) {
  transformer_name = transformer_name || '';

  var EventEmitter = require('events');

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

  (
    transformer === 'uws' &&
    (process.versions.modules < 57 || process.versions.modules > 64)
      ? describe.skip
      : describe
  )('Transformer: '+ (transformer_name || transformer), function () {
    var common = require('./common')
      , request = common.request
      , Primus = common.Primus
      , expect = common.expect
      , create = common.create
      , Socket
      , server
      , primus;

    transformer_name = transformer_name.toLowerCase();
    transformer = transformer.toLowerCase();

    const options = {
      unixSocket: 'unixdomainwebsockets' === transformer_name,
      parser: 'json',
      transformer
    };

    beforeEach(function beforeEach(done) {
      const services = create(options, done);

      Socket = services.Socket;
      server = services.server;
      primus = services.primus;
    });

    afterEach(function afterEach(done) {
      primus.destroy(done);
    });

    describe('.Socket', function () {
      it('exposes a compatible socket', function () {
        expect(Socket).to.be.a('function');
      });

      it('emits an `open` event when its connected', function (done) {
        var socket = new Socket(server.addr);

        socket.on('open', function () {
          socket.end();
          done();
        });
      });

      if (
          'unixdomainwebsockets' !== transformer_name
        && 'browserchannel' !== transformer
        && !process.env.TRAVIS
      ) it('supports literal IPv6 addresses in the connection URL', function (done) {
        var socket = new Socket('http://[::1]:'+ server.portnumber);

        socket.on('open', socket.end).on('end', done);
      });

      it('exposes a .socket property', function (done) {
        var socket = new Socket(server.addr);

        socket.on('open', function () {
          expect(!!socket.socket).to.equal(true);
          socket.end();
          done();
        });
      });

      it('initialises without `new`', function (done) {
        var socket = Socket(server.addr, {
          timeout: 50000
        });

        expect(socket.options.timeout).to.equal(50000);

        socket.on('open', function () {
          socket.end();
          done();
        });
      });

      it('allows disabling of the reconnect functionality', function () {
        var socket = new Socket(server.addr, {
          strategy: false,
          manual: true
        });

        expect(socket.options.strategy).to.equal('');
      });

      it('should not throw an error when we connect to a dead server', function (done) {
        var socket = new Socket('http://localhost:1024', { strategy: false });

        socket.on('error', function () {
          done();
        });
      });

      it('should not open the socket if we set out state to manual', function (done) {
        var socket = new Socket(server.addr, {
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

      it('sets reconnection strategies by default', function () {
        var socket = new Socket(server.addr, {
          manual: true
        });

        expect(socket.options.strategy).to.contain('disconnect');
        expect(socket.options.strategy).to.contain('timeout');
        expect(socket.options.strategy).to.contain('online');
        expect(socket.options.strategy).to.contain(',');
      });

      it('emits errors for incorrect context when theres a listener', function () {
        var socket = new Socket(server.addr, {
          manual: true
        }), calls = 0;

        try {
          socket.open.call(new EventEmitter());
        } catch (err) {
          expect(Object.prototype.toString.call(err)).to.equal('[object Error]');
          expect(err.message).to.contain('Primus#open');
          expect(err.message).to.contain('context');
          calls++;
        }

        expect(calls).to.equal(1);
      });

      it('should change readyStates', function (done) {
        var socket = new Socket(server.addr);

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

      it('should set the correct read/writable states', function (done) {
        var socket = new Socket(server.addr);

        expect(socket.readable).to.equal(true);
        expect(socket.writable).to.equal(true);

        socket.once('open', function () {
          expect(socket.readable).to.equal(true);
          expect(socket.writable).to.equal(true);

          socket.once('end', function () {

            expect(socket.readable).to.equal(false);
            expect(socket.writable).to.equal(false);

            socket.once('open', function () {
              expect(socket.readable).to.equal(true);
              expect(socket.writable).to.equal(true);

              socket.once('end', done).end();
            }).open();
          }).end();
        });
      });

      it('can be opened and closed', function (done) {
        primus.on('connection', function (spark) {
          setTimeout(function () {
            spark.end();
          }, 100);
        });

        var socket = new Socket(server.addr);

        socket.once('open', function () {
          socket.once('end', function () {
            socket.open();

            socket.once('open', function () {
              socket.once('end', done);
            });
          });
        });
      });

      it('can be closed immediately', function (done) {
        var socket = new Socket(server.addr)
          , calls = 0;

        socket.on('end', function () {
          if (++calls === 2) return done();

          socket.open();
          socket.end();
        });

        socket.end();
      });

      it('emits a readyStateChange event', function (done) {
        var socket = new Socket(server.addr)
          , state = socket.readyState
          , calls = 0;

        socket.on('readyStateChange', function () {
          expect(state).to.not.equal(socket.readyState);
          state = socket.readyState;

          calls++;
        });

        socket.on('open', function () {
          expect(!!socket.socket).to.equal(true);
          socket.end();
        }).on('end', function () {
          expect(calls).to.equal(3);
          done();
        });
      });

      it('emits an `end` event when its closed', function (done) {
        var socket = new Socket(server.addr);

        socket.on('open', function () {
          socket.end();
        }).on('end', done);
      });

      it('emits a `close` event when its closed', function (done) {
        var socket = new Socket(server.addr);

        socket.on('open', function () {
          socket.end();
        }).on('close', done);
      });

      it('only emits `end` once', function (done) {
        var socket = new Socket(server.addr);

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
        var socket = new Socket(server.addr);

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
        var socket = new Socket(server.addr);

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
        var socket = new Socket(server.addr);

        socket.on('open', function () {
          var data = { foo: 'bar' };
          data.recursive = data;

          socket.write(data);
        }).on('error', function (err) {
          expect(err).to.not.be.instanceOf(String);
          expect(err.message).to.contain('JSON');

          socket.end();
          done();
        });
      });

      it('buffers messages before it connected', function (done) {
        var socket = new Socket(server.addr)
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
        var socket = new Socket(server.addr);

        socket.on('open', function (message) {
          socket.end();
          done();
        });

        socket.on('reconnect', function () {
          throw new Error('fuck');
        });
      });

      it('should clean up timers', function (done) {
        primus.on('connection', function (spark) {
          if (!reconnected) {
            reconnected = true;
            return spark.end(undefined, { reconnect: true });
          }
          spark.end();
        });

        var socket = new Socket(server.addr)
          , reconnected = false
          , closed = 0
          , opened = 0;

        socket.on('open', function () {
          if (++opened === 1) {
            expect(Object.keys(socket.timers.timers).length).to.be.above(0);
            return;
          }
          expect(Object.keys(socket.timers.timers).length).to.be.equal(1);
        });

        socket.on('close', function () {
          closed++;
          expect(Object.keys(socket.timers.timers).length).to.equal(0);
        });

        socket.on('end', function () {
          expect(closed).to.be.equal(2);
          done();
        });
      });

      it('should not reconnect when strategy is false', function (done) {
        primus.on('connection', function (spark) {
          //
          // Kill a connection to trigger a reconnect
          //
          spark.end(undefined, { reconnect: true });
        });

        var socket = new Socket(server.addr, { strategy: false });

        socket.on('reconnect', function (message) {
          throw new Error('bad');
        });

        socket.on('end', done);
      });

      //
      // This also tests the reconnection when the connection closes unexpectedly
      //
      it('should allow to trigger a client-side reconnect from server', function (done) {
        primus.on('connection', function (spark) {
          if (!reconnected) {
            reconnected = true;
            spark.end(undefined, { reconnect: true });
          }
        });

        var socket = new Socket(server.addr)
          , reconnected = false
          , reconnect = false
          , opened = 0;

        socket.on('reconnect', function (message) {
          reconnect = true;
        });

        socket.on('open', function () {
          if (++opened !== 2) return;

          expect(reconnect).to.equal(true);
          socket.end();
        });

        socket.on('end', done);
      });

      it('emits a timeout event if it cannot connect in a timely manner', function (done) {
        primus.use('delay', function (req, res, next) {
          setTimeout(next, 500);
        });

        var socket = new Socket(server.addr, {
          strategy: 'disconnect,online',
          timeout: 250
        });

        socket.on('timeout', function () {
          socket.on('end', done);
        });
      });

      it('reconnects after the timeout', function (done) {
        primus.use('delay', function (req, res, next) {
          setTimeout(next, 200);
        });

        var socket = new Socket(server.addr, { timeout: 50 });
        var pattern = [];

        socket.removeAllListeners('outgoing::reconnect');

        socket.on('timeout', function () {
          pattern.push('timeout');
        });

        socket.on('reconnect scheduled', function () {
          pattern.push('reconnect scheduled');
        });

        socket.on('reconnect', function () {
          expect(pattern).to.deep.equal(['timeout', 'reconnect scheduled']);
          setImmediate(function () {
            socket.recovery.reset();
            socket.end();
            done();
          });
        });
      });

      it('should allow to stop the reconnection procedure', function (done) {
        primus.on('connection', function (spark) {
          spark.end(undefined, { reconnect: true });
        });

        var socket = new Socket(server.addr);

        socket.on('reconnect scheduled', socket.end);

        socket.on('reconnect', function (message) {
          throw new Error('bad');
        });

        socket.on('end', done);
      });

      it('emits a `reconnected` event', function (done) {
        var socket = new Socket(server.addr);

        primus.once('connection', function (spark) {
          setTimeout(function () {
            spark.end(undefined, { reconnect: true });
          }, 20);
        });

        socket.on('reconnected', function () {
          socket.on('open', socket.end);
          socket.on('end', done);
        });
      });

      it('should receive a `reconnect failed` event when reconnection fails', function (done) {
        var socket = new Socket(server.addr, {
          reconnect: { min: 50, retries: 4 }
        });

        socket.on('open', function () {
          primus.destroy({ reconnect: true });
        });

        socket.on('reconnect failed', function () {
          done();
        });
      });

      it('should reset the reconnect details after a successful reconnect', function (done) {
        var socket = new Socket(server.addr, {
          reconnect: { min: 100, max: 1000 }
        });

        var recovery = socket.recovery
          , reconnect = 0
          , closed = 0;

        expect(recovery.attempt).to.equal(null);

        socket.on('reconnect', function (attempt) {
          expect(recovery.attempt).to.be.an('object');
          expect(recovery.attempt).to.equal(attempt);
          expect(attempt.attempt).to.be.above(0);
          expect(attempt.max).to.equal(1000);
          expect(attempt.min).to.equal(100);
          expect(attempt.scheduled).to.be.within(100, 1000);
          reconnect++;
        });

        socket.on('reconnect scheduled', function () {
          if (reconnect !== 1) return;

          primus = new Primus(server, {
            pathname: server.pathname,
            transformer: transformer
          });

          server.listen(server.portnumber);
        });

        socket.once('open', function () {
          primus.destroy({ reconnect: true });

          socket.once('open', function () {
            expect(recovery.attempt).to.equal(null);
            socket.end();
          });
        });

        socket.on('close', function () {
          closed++;
        });

        socket.on('end', function () {
          expect(reconnect).to.be.above(1);
          expect(closed).to.equal(2);
          done();
        });
      });

      it('can force websocket avoidance', function (done) {
        var socket = new Socket(server.addr, { websockets: false });

        expect(socket.AVOID_WEBSOCKETS).to.equal(true);

        // open is done in a setTimeout 0 so if we end it now then we'll
        // miss the connection
        socket.on('open', socket.end);
        socket.on('end', done);
      });

      it('supports async connection events', function (done) {
        var pre;

        primus.on('connection', function (spark, next) {
          setTimeout(function () {
            pre = 'async';
            next();
          }, 10);
        });

        primus.on('connection', function (spark) {
          expect(pre).to.equal('async');
          spark.end();
          done();
        });

        //
        // Connect AFTER the things are called
        //
        var socket = new Socket(server.addr);
      });

      it('does not introduce data loss for async connection events', function (done) {
        var pre;

        primus.on('connection', function (spark, next) {
          setTimeout(function () {
            pre = 'async';

            socket.write('in');

            next();

            socket.write('order');
          }, 1000);
        });

        primus.on('connection', function (spark) {
          expect(pre).to.equal('async');

          var data = [];

          spark.on('data', function (msg) {
            data.push(msg);

            if (data.length !== 3) return;

            expect(data[0]).equals('hello');
            expect(data[1]).equals('in');
            expect(data[2]).equals('order');

            spark.end();
            done();
          });
        });

        //
        // Connect AFTER the things are called
        //
        var socket = new Socket(server.addr);
        socket.write('hello');
      });

      it('can send utf-8', function (done) {
        var messages = ['pongРУССКИЙ', '€€€']
          , socket = new Socket(server.addr);

        primus.once('connection', function (spark) {
          var i = 0;

          spark.on('data', function (msg) {
            expect(msg).to.equal(messages[i++]);
            spark.write(msg);
          });

          spark.once('end', function () {
            expect(i).to.equal(messages.length);
            done();
          });
        });

        var received = 0;
        socket.on('data', function (msg) {
          expect(msg).to.equal(messages[received++]);

          if (received === messages.length) {
            socket.end();
          }
        });

        messages.forEach(function forEach(msg) {
          socket.write(msg);
        });
      });

      it('can send a 0', function (done) {
        var socket = new Socket(server.addr)
          , zeros = 0;

        primus.once('connection', function (spark) {
          spark.on('data', function (msg) {
            expect(msg).to.equal(0);
            spark.write(0);
            spark.end(0);
          });
        });

        socket.on('data', function (msg) {
          expect(msg).to.equal(0);

          if (++zeros === 2) {
            socket.end();
            done();
          }
        });

        socket.write(0);
      });

      describe('#transform', function () {
        it('thrown an error if an invalid type is given', function (done) {
          var socket = new Socket(server.addr);

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
            var socket = new Socket(server.addr);

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

          it('rewrites the outgoing message async', function (done) {
            var socket = new Socket(server.addr);

            primus.on('connection', function (spark) {
              spark.on('data', function (data) {
                expect(data).to.be.a('object');
                expect(data.meta).to.equal('meta');
                expect(data.message).to.equal('foo');

                spark.end();
                done();
              });
            });

            socket.transform('outgoing', function (data, next) {
              expect(data).to.be.a('object');
              expect(data.data).to.equal('foo');

              setTimeout(function () {
                data.data = {
                  message: 'foo',
                  meta: 'meta'
                };

                next();
              }, 10);
            });

            socket.write('foo');
          });

          it('prevents the message from being written', function (done) {
            var socket = new Socket(server.addr);

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

          it('prevents the message from being written async', function (done) {
            var socket = new Socket(server.addr);

            socket.transform('outgoing', function (data, next) {
              setTimeout(function () {
                next(undefined, false);

                setTimeout(function () {
                  socket.end();
                  done();
                }, 100);
              }, 10);
            });

            socket.on('outgoing::data', function () {
              throw new Error('return false should prevent this emit');
            }).write('foo');
          });
        });

        describe('incoming', function () {
          it('rewrites the incoming message', function (done) {
            var socket = new Socket(server.addr);

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

          it('rewrites the incoming message async', function (done) {
            var socket = new Socket(server.addr);

            primus.on('connection', function (spark) {
              spark.write('foo');
            });

            socket.transform('incoming', function (data, next) {
              expect(data).to.be.a('object');
              expect(data.data).to.equal('foo');

              setTimeout(function () {
                data.data = {
                  message: 'foo',
                  meta: 'meta'
                };

                next();
              }, 100);
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
            var socket = new Socket(server.addr);

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

          it('prevents the message from being emitted async', function (done) {
            var socket = new Socket(server.addr);

            primus.on('connection', function (spark) {
              spark.write('foo');
            });

            socket.transform('incoming', function (data, next) {
              setTimeout(function () {
                setTimeout(function () {
                  socket.end();
                  done();
                }, 100);

                next(undefined, false);
              }, 10);
            });

            socket.on('data', function () {
              throw new Error('return false should prevent this emit');
            });
          });
        });
      });

      describe('#id', function () {
        it('should receive the id', function (done) {
          primus.on('connection', function (spark) {
            socket.id(function (id) {
              expect(id).to.equal(spark.id);
              spark.end();
              done();
            });
          });

          var socket = new Socket(server.addr);
        });
      });
    });

    describe('.createSocket', function () {
      it('can connect to the server', function (done) {
        var PSocket = Primus.createSocket({
              transformer: transformer,
              pathname: server.pathname
            })
          , socket = new PSocket(server.addr);

        socket.on('open', function () {
          socket.end();
          done();
        });
      });

      it('should accept plugins', function (done) {
        var PSocket = Primus.createSocket({
              transformer: transformer,
              pathname: server.pathname,
              plugin: {
                emit: emitter
              }
            })
          , socket = new PSocket(server.addr);

        expect(socket.$emit).to.be.a('function');
        socket.on('open', function () {
          socket.end();
          done();
        });
      });

      it('should not start heartbeat', function (done) {
        var orig_setInterval = setInterval
          , called = false
          , options = {
              transformer: transformer,
              pathname: server.pathname,
              pingInterval: 60000
            };
        setInterval = function () {
          called = true;
        };
        Primus.createSocket(options);
        Primus.createSocket();
        setInterval = orig_setInterval;
        expect(options.pingInterval).to.equal(60000);
        if (called) {
          done(new Error('createSocket should not start a heartbeat'));
        } else {
          done();
        }
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

        var Socket = Primus.createSocket({
              transformer: transformer,
              pathname: server.pathname,
              authorization: true
            })
          , socket = new Socket(server.addr);

        socket.on('end', done);
        socket.on('reconnect', function () {
          throw new Error('fuck');
        });
      });

      it('support declined authorization with status code', function (done) {
        primus.authorize(function auth(req, next) {
          expect(req.headers).to.be.a('object');

          var err = new Error('I failed');
          err.statusCode = 404;

          next(err);
        });

        primus.on('connection', function (spark) {
          throw new Error('Auth should be called');
        });

        var Socket = Primus.createSocket({
              transformer: transformer,
              pathname: server.pathname,
              authorization: true
            })
          , socket = new Socket(server.addr);

        socket.on('end', done);
        socket.on('reconnect', function () {
          throw new Error('fuck');
        });
      });

      it('support declined authorization with message and www-authenticate header', function (done) {
        primus.authorize(function auth(req, next) {
          expect(req.headers).to.be.a('object');

          var err = new Error('I failed');
          err.authenticate = 'Basic realm="primus"';

          next(err);
        });

        primus.on('connection', function (spark) {
          throw new Error('Auth should be called');
        });

        var Socket = Primus.createSocket({
              transformer: transformer,
              pathname: server.pathname,
              authorization: true
            })
          , socket = new Socket(server.addr);

        socket.on('outgoing::open', function () {
          if (socket.socket.on) {
            socket.socket.on('unexpected-response', function (req, res) {
              expect(res.statusCode).to.equal(401);
              expect(res.headers['www-authenticate']).to.equal('Basic realm="primus"');

              var onerror = socket.socket.onerror
                , data = '';

              res.on('data', function (v) {
                data += v;
              });

              res.on('end', function () {
                var obj = JSON.parse(data);
                expect(obj).to.eql({error: 'I failed'});
                onerror(new Error(obj.error));
              });
            });
          }
        });

        socket.on('end', done);
        socket.on('reconnect', function () {
          throw new Error('reconnect should not be called');
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

        var socket = new Socket(server.addr);

        socket.on('end', done);
        socket.on('reconnect', function () {
          throw new Error('fuck');
        });
      });

      it('communicates over an authorized connection', function (done) {
        primus.authorize(function auth(req, next) {
          expect(req.headers).to.be.a('object');

          setTimeout(next, 20);
        });

        primus.on('connection', function (spark) {
          spark.on('data', function (data) {
            expect(data).to.equal('balls');
            spark.end();
          });
        });

        var socket = new Socket(server.addr);
        socket.on('end', done);
        socket.write('balls');
      });

      it('receives pre-parsed ip adresses', function (done) {
        primus.authorize(function auth(req, next) {
          expect(req.forwarded).to.be.a('object');
          expect(req.forwarded.ip).to.be.a('string');
          expect(req.forwarded.port).to.be.a('number');

          setTimeout(next, 0);
        });

        primus.on('connection', function (spark) {
          spark.end();
        });

        var socket = new Socket(server.addr);
        socket.on('end', done);
        socket.write('balls');
      });

      if (
        'browserchannel' !== transformer &&
        'engine.io' !== transformer &&
        'unixdomainwebsockets' !== transformer_name
      ) {
        it('connects using basic auth', function (done) {
          var socket = new Socket(server.make_addr('usr:pass', null, '?foo=bar'));

          socket.on('end', done);

          primus.on('connection', function (spark) {
            expect(spark.headers.authorization).to.equal('Basic dXNyOnBhc3M=');
            socket.end();
          });
        });
      }
    });

    describe('Server', function () {
      it('emits a `connection` event before any `data` event', function (done) {
        var create = 10
          , foo = 0;

        primus.on('connection', function (spark) {
          spark.on('data', function (data) {
            if ('foo' === data) {
              if (++foo === create) done();
            }
          });
        });

        for (var i = 0; i < create; i++) {
          (new Socket(server.addr)).write('foo');
        }
      });

      it('emits `end` when the connection is closed', function (done) {
        primus.on('connection', function (spark) {
          spark.on('end', done);
        });

        var socket = new Socket(server.addr);

        socket.on('open', function () {
          socket.end();
        });
      });

      it('emits an `error` when it fails to encode the data', function (done) {
        primus.on('connection', function (spark) {
          var data = { foo: 'bar' };
          data.recursive = data;

          spark.on('error', function (err) {
            expect(err).to.not.be.a('string');
            expect(err.message).to.include('JSON');

            spark.end();
          });

          spark.write(data);
        });

        var socket = new Socket(server.addr);
        socket.on('end', done);
      });

      it('should expose transformers socket', function (done) {
        primus.on('connection', function (spark) {
          expect(spark.socket).to.not.equal(undefined);

          socket.end();
        });

        var socket = new Socket(server.make_addr(null, null));
        socket.on('end', done);
      });

      it('should receive querystrings', function (done) {
        primus.on('connection', function (spark) {
          expect(spark.query).to.be.a('object');
          expect(spark.query.foo).to.equal('bar');

          socket.end();
        });

        var socket = new Socket(server.make_addr(null, null, '?foo=bar'));
        socket.on('end', done);
      });

      it('should receive all headers', function (done) {
        primus.on('connection', function (spark) {
          expect(spark.headers).to.be.a('object');
          expect(spark.headers).to.have.property('connection');

          socket.end();
        });

        var socket = new Socket(server.make_addr(null, null, '?foo=bar'));
        socket.on('end', done);
      });

      it('should allow access to the original HTTP request', function (done) {
        primus.on('connection', function (spark) {
          expect(spark.request).to.not.equal(undefined);
          expect(spark.request.headers).to.be.a('object');

          //
          // Timeout is added to ensure that a request had time to get closed.
          // As closed requests could add a bunch of issues.
          //
          setTimeout(function () {
            expect(spark.request).to.not.equal(undefined);
            spark.end();
            done();
          }, 100);
        });

        var socket = new Socket(server.addr);
      });

      it('should not trigger a reconnect when we end the connection', function (done) {
        primus.on('connection', function (spark) {
          spark.end();
        });

        var socket = new Socket(server.addr);

        socket.on('end', done);
        socket.on('reconnect', function () {
          throw new Error('fuck');
        });
      });

      it('should still allow requests to the original listener', function (done) {
        const url = server.make_addr(null, '/nothrow', null, false);

        request(url, function (err, res, body) {
          if (err) return done(err);

          expect(body).to.equal('original listener');
          done();
        });
      });

      it('responds to library requests', function (done) {
        const url = server.make_addr(null, '/primus/primus.js', null, false);

        request(url, function (err, res, body) {
          if (err) return done(err);

          expect(res.statusCode).to.equal(200);
          expect(res.headers['content-type']).to.equal('text/javascript; charset=utf-8');
          expect(body).to.equal(primus.library());
          done();
        });
      });

      it('handles requests to non existing routes captured by primus', function (done) {
        const url = server.make_addr(null, '/primus.js', null, false);

        request(url, function (err) {
          if (err) return done(err);

          done();
        });
      });

      it('exposes a spec file with the correct transformer', function (done) {
        request({
          url: server.make_addr(null, '/primus/spec', null, false),
          json: true
        }, function (err, res, body) {
          if (err) return done(err);

          expect(body.transformer).to.equal(transformer);
          expect(body.version).to.equal(primus.version);
          expect(body.pathname).to.equal('/primus');
          expect(body.pingInterval).to.equal(30000);
          expect(body.parser).to.equal('json');
          done();
        });
      });

      it('correctly handles requests when a middleware returns an error', function (done) {
        primus.use('foo', function foo(req, res, next) {
          next(new Error('foo failed'));
        });

        primus.on('connection', function () {
          throw new Error('connection should not be triggered');
        });

        var socket = new Socket(server.addr, { strategy: false });
        socket.on('end', done);
      });

      if ('unixdomainwebsockets' !== transformer_name) {
        it('correctly parses the ip address', function (done) {
          primus.on('connection', function (spark) {
            var address = spark.address;
            expect(address.port).to.not.equal(0);
            expect(address.port).to.not.equal(server.portnumber);

            spark.end();
            done();
          });

          var socket = new Socket(server.addr);
        });
      }

      it('uses x-forwarded headers over the connection ip address', function (done) {
        primus.on('connection', function (spark) {
          spark.headers['x-forwarded-for'] = '13.3.37.1,12.12.12.12';
          spark.headers['x-forwarded-port'] = '9083,1334';

          //
          // Side note here, we don't want to re-use the detection from the
          // middleware here as we don't want to go through the hassle of adding
          // a real-proxy in our tests. We merely want to test if it will look
          // at the x-forwarded-headers instead of the pure IP address.
          //
          delete spark.request.forwarded;

          expect(spark.address.ip).to.equal('13.3.37.1');
          expect(spark.address.port).to.equal(9083);

          spark.end();
          done();
        });

        var socket = new Socket(server.addr);
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

        var socket = new Socket(server.addr);
        socket.on('open', function () {
          socket.end();
        });
      });

      it('should make the spark available to the parser', function (done) {
        var rnd = Math.random(),
          parser = primus.parser;

        primus.parsers({
          decoder: function (data, fn) {
            expect(this.foobar).to.equal(rnd);
            parser.decoder.call(this, data, function (err, decoded) {
              expect(err).not.to.exist;
              expect(decoded).to.eql({ echo: 'pong' });
              fn(null, decoded);
            });
          },

          encoder: function (data, fn) {
            expect(this.foobar).to.equal(rnd);
            parser.encoder.call(this, data, fn);
            if (data === 'pong') {
              done();
            }
          }
        });

        primus.on('connection', function (spark) {
          spark.foobar = rnd;
        });

        var socket = new Socket(server.addr);

        socket.on('open', function () {
          socket.write({ echo: 'pong' });
        });
      });

      if ('browserchannel' !== transformer) {
        it('closes the connection when `maxLength` is exceeded', function (done) {
          primus.destroy(function () {
            primus = new Primus(server, {
              pathname: server.pathname,
              transformer: transformer,
              maxLength: 5
            });

            primus.on('connection', function (spark) {
              spark.on('data', function () {
                done(new Error('Test invalidation'));
              });
            });

            server.listen(server.portnumber, function () {
              var socket = new primus.Socket(server.addr, { strategy: false });

              socket.on('open', function () {
                socket.write('abcdef');
                socket.on('end', done);
              });
            });
          });
        });
      }

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

            var socket = new Socket(server.addr);

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

            var socket = new Socket(server.addr);
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

            var socket = new Socket(server.addr);
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

            var socket = new Socket(server.addr);
            socket.write('foo');
          });
        });
      });
    });
  });
};
