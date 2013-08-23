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

  it('emits an `initialised` event when the server is fully constructed', function (done) {
    var primus = new Primus(server);

    primus.on('initialised', function (transformer, parser) {
      expect(transformer).to.equal(primus.transformer);
      expect(parser).to.equal(primus.parser);

      done();
    });
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

  it('throws a human readable error for an unsupported transformer', function () {
    try {
      new Primus(server, { transformer: 'cowsack' });
    } catch (e) {
      expect(e).to.be.instanceOf(Error);
      expect(e.message).to.include('cowsack');
    }
  });

  it('throws a human readable error for an unsupported parser', function () {
    try {
      new Primus(server, { parser: 'cowsack' });
    } catch (e) {
      expect(e).to.be.instanceOf(Error);
      return expect(e.message).to.include('cowsack');
    }

    throw new Error('Should have thrown');
  });

  describe('.use', function () {
    it('throws an error if no valid name is provided', function () {
      try { primus.use({}); }
      catch (e) {
        expect(e).to.be.instanceOf(Error);
        expect(e.message).to.include('Plugin');
        return expect(e.message).to.include('a name');
      }

      throw new Error('Should have thrown');
    });

    it('should check if the name is a string', function () {
      try { primus.use(function () {}); }
      catch (e) {
        expect(e).to.be.instanceOf(Error);
        expect(e.message).to.include('Plugin');
        return expect(e.message).to.include('string');
      }

      throw new Error('Should have thrown');
    });

    it('doesnt allow duplicate definitions', function () {
      primus.use('foo', { client: function () {} });

      try { primus.use('foo', { client: function () {} }); }
      catch (e) {
        expect(e).to.be.instanceOf(Error);
        expect(e.message).to.include('plugin');
        return expect(e.message).to.include('defined');
      }

      throw new Error('Should have thrown');
    });

    it('should have a client or server function', function () {
      var called = 0;

      try { primus.use('cow', { foo: 'bar' }); }
      catch (e) {
        expect(e).to.be.instanceOf(Error);
        expect(e.message).to.include('missing');
        expect(e.message).to.include('client');
        expect(e.message).to.include('server');
        called++;
      }

      expect(called).to.equal(1);

      primus.use('client', { client: function () {} });
      primus.use('server', { server: function () {} });
      primus.use('both', { server: function () {}, client: function () {} });
    });

    it('should accept function as second argument', function () {
      function Room() {}
      Room.server = function (p) { p.foo = 'bar'; };
      Room.client = function () {};

      primus.use('room', Room);

      expect(primus.foo).to.equal('bar');
    });

    it('should accept instances as second argument', function () {
      var A = function () {};
      A.prototype.server = function (p) { p.foo = 'bar'; };
      A.prototype.client = function () {};

      var B = function () {};
      B.prototype.server = function (p) { p.bar = 'foo'; };
      B.prototype.client = function () {};

      var a = new A;
      var b = Object.create(B.prototype);

      primus
      .use('a', a)
      .use('b', b);

      expect(primus.foo).to.equal('bar');
      expect(primus.bar).to.equal('foo');
    });

    it('should check if energon is an object or a function', function () {
      try { primus.use('room'); }
      catch (e) {
        expect(e).to.be.instanceOf(Error);
        expect(e.message).to.include('Plugin');
        expect(e.message).to.include('object');
        return expect(e.message).to.include('function');
      }

      throw new Error('Should have thrown');
    });

    it('returns this', function () {
      var x = primus.use('foo', { client: function () {}});

      expect(x).to.equal(primus);
    });

    it('should have no plugins', function () {
      expect(Object.keys(primus.ark)).to.have.length(0);
    });

    it('calls the supplied server plugin', function (done) {
      var primus = new Primus(server, { foo: 'bar' });

      primus.use('test', {
        server: function server(pri, options) {
          expect(options).to.be.a('object');
          expect(options.foo).to.equal('bar');
          expect(pri).to.equal(primus);
          expect(this).to.equal(pri);

          done();
        }
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
      expect(primus.library()).to.include('Primus(url, options);');
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

    it('includes the client plugins', function () {
      var primus = new Primus(server)
        , library;

      function client() {
        console.log();
      }

      primus.use('log', { client: function () {
        console.log('i am a client plugin');
      }});

      library = primus.library();

      expect(library).to.be.a('string');
      expect(library).to.include('i am a client plugin');
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
