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
    try { server.close(done); }
    catch (e) { done(); }
  });

  it('creates an id if none is supplied', function () {
    var spark = new primus.Spark();

    expect(spark.id).to.be.a('string');
  });

  it('is a Stream instance', function () {
    expect(new primus.Spark()).to.be.instanceOf(require('stream'));
  });

  it('increments sparks on the Primus server to ensure unique ids', function () {
    expect(primus.sparks).to.equal(0);
    var spark = new primus.Spark();

    expect(spark.id).to.include(primus.sparks - 1);
    expect(primus.sparks).to.equal(1);
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

  describe('#emits', function () {
    it('returns a function that emits the given event', function (done) {
      var spark = new primus.Spark();

      spark.on('incoming::spark', function (data) {
        expect(data).to.equal('meh');
        done();
      });

      var emit = spark.emits('spark');
      emit('meh');
    });

    it('passes all arguments to the parser', function (done) {
      var spark = new primus.Spark();

      spark.on('incoming::spark', function (data) {
        expect(data).to.equal('foo');
        done();
      });

      var emit = spark.emits('spark', function parser(meh, balls) {
        expect(meh).to.equal('meh');
        expect(balls).to.equal('balls');

        return 'foo';
      });

      emit('meh', 'balls');
    });

    it('only sends the first argument', function (done) {
      var spark = new primus.Spark();

      spark.on('incoming::spark', function (data, extra) {
        expect(data).to.equal('meh');
        expect(extra).to.equal(undefined);

        done();
      });

      var emit = spark.emits('spark');
      emit('meh', 'balls');
    });
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

    it('removes all event listeners after the `end` event is emitted', function (done) {
      var spark = new primus.Spark()
        , data = 0;

      spark.on('data', function (msg) {
        expect(msg).to.equal('foo');
        data++;
      });

      spark.on('end', function () {
        process.nextTick(function () {
          spark.emit('data', 'aaaa');
          expect(data).to.equal(1);
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
      this.timeout(50);
      var primus = new Primus(server, { timeout: 25 });

      primus.on('disconnection', function (socket) {
        expect(socket).to.equal(spark);
        done();
      });

      primus.on('connection', function (socket) {
        expect(socket).to.equal(spark);
      });

      var spark = new primus.Spark();
    });

    it('can disable the disconnect timeout', function (done) {
      var primus = new Primus(server, { timeout: false })
        , spark = new primus.Spark();

      spark.on('data', function (msg) {
        expect(msg).to.equal('foo');
        expect(spark.timeout).to.equal(null);
        done();
      });

      expect(spark.timeout).to.equal(null);
      spark.emit('data', 'foo');
    });
  });

  describe('#write', function () {
    it('encodes the data', function (done) {
      var spark = new primus.Spark()
        , data = { foo: 'bar' };

      spark.on('outgoing::data', function (msg) {
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

      spark.on('outgoing::data', function (msg) {
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
});
