describe('Spark', function () {
  'use strict';

  var common = require('./common')
    , Primus = common.Primus
    , http = require('http')
    , expect = common.expect
    , Spark = Primus.Spark
    , server
    , primus;

  beforeEach(function beforeEach(done) {
    server = http.createServer();
    primus = new Primus(server);

    server.portnumber = common.port;
    server.listen(server.portnumber, done);
  });

  afterEach(function afterEach(done) {
    primus.destroy(done);
  });

  it('creates an id if none is supplied', function () {
    var spark = new primus.Spark();

    expect(spark.id).to.be.a('string');
  });

  it('is a Stream instance', function () {
    expect(new primus.Spark()).to.be.instanceOf(require('stream'));
  });

  it('uses the supplied id if one is provided', function () {
    var spark = new primus.Spark({}, {}, {}, 'balls');

    expect(spark.id).to.equal('balls');
  });

  it('emits a `connection` event on the primus instance when created', function (done) {
    primus.on('connection', function (socket) {
      expect(socket).to.equal(spark);
      done();
    });

    var spark = new primus.Spark();
  });

  it('can be retreived using primus.spark()', function (done) {
    primus.on('connection', function (socket) {
      expect(socket).to.equal(spark);

      var ref = primus.spark(socket.id);
      expect(socket).to.equal(ref);
      expect(spark).to.equal(ref);

      done();
    });

    var spark = new primus.Spark();
  });

  it('emits a `readyStateChange` event when the readyState changes', function (done) {
    var spark = new primus.Spark();

    expect(spark.readyState).to.equal(Spark.OPEN);

    spark.on('readyStateChange', function () {
      expect(spark.readyState).to.equal(Spark.CLOSED);
      done();
    });

    spark.readyState = Spark.OPEN;
    spark.readyState = Spark.CLOSED;
  });

  it('transforms querystrings', function()  {
    var spark = new primus.Spark({}, {}, 'string=foo');

    expect(spark.query).to.be.a('object');
    expect(spark.query.string).to.equal('foo');
  });

  describe('#reserved', function () {
    it('sees all incoming:: and outgoing:: as reserved', function () {
      var spark = new primus.Spark();

      expect(spark.reserved('incoming::error')).to.equal(true);
      expect(spark.reserved('outgoing::error')).to.equal(true);
      expect(spark.reserved('incoming::')).to.equal(true);
      expect(spark.reserved('outgoing::')).to.equal(true);
      expect(spark.reserved('somwhatincoming::error')).to.equal(false);
      expect(spark.reserved('somwhatoutgoing::error')).to.equal(false);
      expect(spark.reserved('INCOMING::ERROR')).to.equal(false);
      expect(spark.reserved('OUTGOING::ERROR')).to.equal(false);
      expect(spark.reserved('INCOMING::')).to.equal(false);
      expect(spark.reserved('OUTGOING::')).to.equal(false);
    });

    it('sees specific events as reserved', function () {
      var spark = new primus.Spark();

      expect(spark.reserved('error')).to.equal(true);
      expect(spark.reserved('ERROR')).to.equal(false);
    });
  });

  describe('#end', function () {
    it('emits a `disconnection` event on the primus instance when destroyed', function (done) {
      primus.on('disconnection', function (socket) {
        expect(socket).to.equal(spark);
        done();
      });

      var spark = new primus.Spark();
      spark.end();
    });

    it('emits `disconnection` events when the server gets destroyed', function (done) {
      var create = 10
        , connection = 0
        , disconnection = 0;

      primus.on('connection', function () {
        connection++;
      });

      primus.on('disconnection', function () {
        disconnection++;
      });

      for (var i = 0; i < create; i++) new primus.Spark();

      setTimeout(function () {
        expect(connection).to.equal(create);

        primus.destroy(function () {
          expect(connection).to.equal(create);
          expect(disconnection).to.equal(create);

          done();
        });
      }, 10);
    });

    it('removes only our event listeners after the `end` event is emitted', function (done) {
      var spark = new primus.Spark()
        , data = 0;

      spark.on('data', function (msg) {
        expect(msg).to.equal('foo');
        data++;
      });

      spark.on('end', function () {
        process.nextTick(function () {
          spark.emit('data', 'foo');
          expect(data).to.equal(2);
          done();
        });
      });

      spark.emit('data', 'foo');
      expect(data).to.equal(1);

      spark.end();
    });

    it('emits an outgoing::end event', function (done) {
      var spark = new primus.Spark();
      spark.on('outgoing::end', done);
      spark.end();
    });
  });

  describe('#timeout', function () {
    it('disconnects if the timeout expires', function (done) {
      var primus = new Primus(server, { timeout: 25 });

      primus.on('disconnection', function (socket) {
        expect(socket).to.equal(spark);
        primus.destroy(done);
      });

      primus.on('connection', function (socket) {
        expect(socket).to.equal(spark);
      });

      var spark = new primus.Spark();
    });
  });

  describe('#write', function () {
    it('encodes the data', function (done) {
      var spark = new primus.Spark()
        , data = { foo: 'bar' };

      spark.once('outgoing::data', function (msg) {
        expect(msg).to.be.a('string');
        expect(msg).to.equal(JSON.stringify(data));

        done();
      }).on('error', function (err) {
        throw err;
      });

      expect(spark.write(data)).to.equal(true);
    });

    it('escapes the data', function (done) {
      var spark = new primus.Spark()
        , data = ['\u2028\u2029'];

      spark.once('outgoing::data', function (msg) {
        expect(msg).to.be.a('string');
        expect(msg).to.not.equal(JSON.stringify(data));
        expect(msg).to.equal('["\\u2028\\u2029"]');

        done();
      }).on('error', function (err) {
        throw err;
      });

      expect(spark.write(data)).to.equal(true);
    });

    it('emits an error when it cannot encode the data', function (done) {
      var spark = new primus.Spark()
        , data = { foo: 'bar' };

      data.recusrive = data;

      spark.on('error', function (err) {
        expect(err).to.be.instanceOf(Error);
        done();
      });

      expect(spark.write(data)).to.equal(true);
    });
  });

  describe('.initialise', function () {
    it('allows overriding the initialise function', function (done) {
      Spark.prototype.initialise = function init() {
        Spark.prototype.__initialise.length = 1;
        done();
      };

      var spark = new Spark(primus);
    });

    it('get initialise returns the last added function', function () {
      expect(Spark.prototype.initialise).to.equal(Spark.prototype.__initialise[0]);

      function foo() {}

      Spark.prototype.initialise = foo;
      expect(Spark.prototype.initialise).to.equal(Spark.prototype.__initialise[1]);
      expect(Spark.prototype.initialise).to.equal(foo);

      Spark.prototype.__initialise.length = 1;
    });
  });

  describe('ping/pong', function () {
    it('emits `incoming::pong` on a pong event', function (done) {
      var spark = new primus.Spark()
        , now = Date.now();

      spark.on('incoming::pong', function (time) {
        expect(time).to.equal(now);
        done();
      });

      spark.emit('incoming::data', JSON.stringify('primus::pong::'+ now));
    });

    it('emits `heartbeat` on a pong event', function (done) {
      var spark = new primus.Spark()
        , now = Date.now();

      spark.on('heartbeat', function () {
        done();
      });

      spark.emit('incoming::data', JSON.stringify('primus::pong::'+ now));
    });

    it('emits `outgoing::ping` when sending a ping', function (done) {
      var primus = new Primus(server, { timeout: 25 })
        , spark = new primus.Spark();

      spark.on('outgoing::ping', function () {
        spark.on('end', function () {
          primus.destroy(done);
        });
      });
    });

    it('writes `primus::ping::<timestamp>` when sending a ping', function (done) {
      var primus = new Primus(server, { timeout: 25 })
        , spark = new primus.Spark();

      spark.on('outgoing::ping', function (time) {
        spark.once('outgoing::data', function (data) {
          expect(data).to.equal(JSON.stringify('primus::ping::'+ time));
          spark.on('end', function () {
            primus.destroy(done);
          });
        });
      });
    });
  });
});
