describe('Primus', function () {
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

  it('exposes the current version number', function () {
    expect(primus.version).to.be.a('string');
    expect(primus.version).to.equal(require('../package.json').version);
  });

  it('exposes the client library', function () {
    expect(primus.client).to.be.a('string');
    expect(primus.client).to.include('{primus::version}');
  });

  it('exposes the Spark constructor', function () {
    expect(primus.Spark).to.be.a('function');
  });

  it('pre-binds the primus server in to the spark', function () {
    var spark = new primus.Spark();
    expect(spark.primus).to.equal(primus);
  });

  it('can customize the pathname', function () {
    expect(primus.pathname).to.equal('/primus');
    expect(new Primus(server, { pathname: '/foo' }).pathname).to.equal('/foo');
  });

  it('accepts custom message parsers', function () {
    var primus = new Primus(server, { parser: 'jsonh' });

    expect(primus.parser.library).to.be.a('string');
    expect(primus.parser.library).to.include('JSONH');
  });

  it('stores new connections internally', function (done) {
    expect(primus.connected).to.equal(0);
    var spark = new primus.Spark();

    process.nextTick(function () {
      expect(primus.connected).to.equal(1);
      var sparks = new primus.Spark();

      setTimeout(function () {
        expect(Object.keys(primus.connections).length).to.equal(primus.connected);
        sparks.end();
        spark.end();

        done();
      }, 0);
    });
  });

  it('removes connections internally on disconnect', function (done) {
    var spark = new primus.Spark()
      , sparks = new primus.Spark();

    process.nextTick(function () {
      expect(primus.connected).to.equal(2);
      sparks.end();
      spark.end();

      process.nextTick(function () {
        expect(primus.connected).to.equal(0);
        expect(Object.keys(primus.connections).length).to.equal(primus.connected);

        done();
      }, 0);
    });
  });

  describe('#forEach', function () {
    it('iterates over all active connections');
  });

  describe('#library', function () {
    it('includes the library of the parsers', function () {
      var primus = new Primus(server, { parser: 'jsonh' })
        , library = primus.library();

      expect(library).to.be.a('string');
      expect(primus.parser.library).to.be.a('string');
      expect(library).to.include(primus.parser.library);
    });

    it('includes the library of the transformer', function () {
      var primus = new Primus(server, { transformer: 'engine.io' })
        , library = primus.library();

      expect(library).to.be.a('string');
      expect(primus.transformer.library).to.be.a('string');

      expect(library).to.include(primus.transformer.library);
    });

    it('includes the transformers client');
    it('includes the prism client library');
    it('includes the configuration details');
    it('includes the decoders');
  });
});
