describe('Primus', function () {
  'use strict';

  var common = require('./common')
    , Primus = common.Primus
    , http = require('http')
    , expect = common.expect
    , fs = require('fs')
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

  it('exposes the Spark constructor', function () {
    expect(Primus.Spark).to.be.a('function');
  });

  it('exposes the Transformer contructor', function () {
    expect(Primus.Transformer).to.be.a('function');
  });

  it('exposes the current version number', function () {
    expect(primus.version).to.be.a('string');
    expect(primus.version).to.equal(require('../package.json').version);
  });

  it('exposes the client library', function () {
    expect(primus.client).to.be.a('string');
    expect(primus.client).to.include('{primus::version}');
  });

  it('exposes the wrapped Spark constructor', function () {
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

  it('accepts a third-party parser', function () {
    var parser = {
      encoder: function () {},
      decoder: function () {}
    };

    var primus = new Primus(server, { parser: parser });

    expect(primus.parser).to.equal(parser);
    expect(primus.encoder).to.equal(parser.encoder);
    expect(primus.decoder).to.equal(parser.decoder);

    try {
      new Primus(server, { parser: function () {}});
    } catch (e) {
      return expect(e).to.be.instanceOf(Error);
    }

    throw new Error('I should have throwed above');
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

  it('accepts a third-party transformer', function () {
    var Optimus = Primus.Transformer.extend({
      server: function () {},
      client: function () {}
    });

    var primus = new Primus(server, { transformer: Optimus });
    expect(primus.transformer).to.be.instanceOf(Optimus);

    try {
      new Primus(server, { transformer: []});
    } catch (e) {
      return expect(e).to.be.instanceOf(Error);
    }

    throw new Error('I should have throwed');
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
      });
    });
  });

  describe('#forEach', function () {
    it('iterates over all active connections', function (done) {
      var spark = new primus.Spark()
        , sparks = new primus.Spark();

      process.nextTick(function () {
        expect(primus.connected).to.equal(2);

        var iterations = 0;

        primus.forEach(function (client, id, connections) {
          expect(connections).to.be.a('object');
          expect(client).to.be.instanceOf(primus.Spark);
          expect(id).to.be.a('string');

          iterations++;
        });

        expect(iterations).to.equal(2);
        done();
      });
    });
  });

  describe('#library', function () {
    it('includes the library of the transformer', function () {
      var primus = new Primus(server, { transformer: 'engine.io' })
        , library = primus.library();

      expect(library).to.be.a('string');
      expect(primus.transformer.library).to.be.a('string');

      expect(library).to.include(primus.transformer.library);
    });

    it('includes the transformers client', function () {
      var primus = new Primus(server, { transformer: 'engine.io' })
        , library = primus.library();

      expect(library).to.be.a('string');
      expect(primus.transformer.client).to.be.a('function');

      expect(library).to.include(primus.transformer.client.toString());
    });

    it('includes the prism client library', function () {
      expect(primus.library()).to.include('Primus(url)');
    });

    it('includes the configuration details', function () {
      expect(primus.library()).to.include(primus.version);
      expect(primus.library()).to.include(primus.pathname);
    });

    it('includes the library of the parsers', function () {
      var primus = new Primus(server, { parser: 'jsonh' })
        , library = primus.library();

      expect(library).to.be.a('string');
      expect(primus.parser.library).to.be.a('string');
      expect(library).to.include(primus.parser.library);
    });

    it('includes the decoders', function () {
      expect(primus.library()).to.include(primus.encoder.toString());
      expect(primus.library()).to.include(primus.decoder.toString());
    });
  });

  describe('#save', function () {
    it('saves the library in the specified location', function (done) {
      var async = __dirname + '/primus.save.async.js'
        , sync = __dirname + '/primus.save.sync.js';

      primus.save(sync);
      expect(fs.readFileSync(sync, 'utf-8')).to.equal(primus.library());

      primus.save(async, function (err) {
        if (err) return done(err);

        expect(fs.readFileSync(async, 'utf-8')).to.equal(primus.library());
        done();
      });
    });
  });
});
