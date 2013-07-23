describe('Spark', function () {
  'use strict';

  var common = require('./common')
    , Primus = common.Primus
    , http = require('http')
    , expect = common.expect
    , server
    , primus;

  beforeEach(function beforeEach(done) {
    server = http.createServer();
    primus = new Primus(server);

    server.portnumber = common.port;
    server.listen(server.portnumber, done);
  });

  afterEach(function afterEach(done) {
    server.close(done);
  });

  it('creates a id if none is supplied', function () {
    var spark = new primus.Spark();

    expect(spark.id).to.be.a('string');
  });

  it('is an Stream instance', function () {
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

  describe('#end', function () {
    it('emits a `disconnection` event on the primus instance when destoryed', function (done) {
      primus.on('disconnection', function (socket) {
        expect(socket).to.equal(spark);
        done();
      });

      var spark = new primus.Spark();
      spark.end();
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
          spark.emit('data', 'foo');
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
});
