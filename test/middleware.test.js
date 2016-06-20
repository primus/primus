describe('Middleware', function () {
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
    primus.destroy(done);
  });

  describe('#use', function () {
    it('is chainable', function () {
      expect(primus.use('foo', function (req, res) {})).to.equal(primus);
    });

    it('throws when no function is provided', function (done) {
      try { primus.use('foo', new Date()); }
      catch (e) { done(); }
    });

    it('throws when function doesnt accept req/res args', function (done) {
      try { primus.use('foo', function () { return function () {}; }); }
      catch (e) { done(); }
    });

    it('calls the function if it has less then 2 arguments', function (done) {
      primus.use('example', function (options) {
        expect(this).to.equal(primus);
        expect(options).to.be.a('object');
        expect(options.foo).to.equal('bar');

        done();

        return function (req, res) {};
      }, { foo: 'bar' });
    });

    it('extracts a name if none is given', function () {
      expect(primus.indexOfLayer('connect')).to.equal(-1);

      primus.use(function connect(req, res, bar) {});
      expect(primus.indexOfLayer('connect')).to.be.above(-1);
    });

    it('stores the layer', function () {
      function foo(req, res, next) { }
      function bar(req, res) { }

      primus.use('foo', foo).use('bar', bar);

      var index = primus.indexOfLayer('foo')
        , layer = primus.layers[index];

      expect(layer.name).to.equal('foo');
      expect(layer.enabled).to.equal(true);
      expect(layer.length).to.equal(3);
      expect(layer.fn).to.equal(foo);

      index = primus.indexOfLayer('bar');
      layer = primus.layers[index];
      expect(layer.length).to.equal(2);
    });

    it('overrides layers with the same name', function () {
      function foo(req, res, next) { }
      function bar(req, res) { }

      primus.use('foo', foo);

      var index = primus.indexOfLayer('foo')
        , layer = primus.layers[index];

      expect(layer.name).to.equal('foo');
      expect(layer.enabled).to.equal(true);
      expect(layer.length).to.equal(3);
      expect(layer.fn).to.equal(foo);

      primus.use('foo', bar);
      expect(primus.indexOfLayer('foo')).to.equal(index);

      index = primus.indexOfLayer('foo');
      layer = primus.layers[index];

      expect(layer.name).to.equal('foo');
      expect(layer.enabled).to.equal(true);
      expect(layer.length).to.equal(2);
      expect(layer.fn).to.equal(bar);
    });

    it('allows to specify the layer index', function () {
      function foo(req, res, next) { }
      function bar(req, res, next) { }

      primus.use('foo', foo, 3);

      var index = primus.indexOfLayer('foo')
        , layer = primus.layers[index];

      expect(layer.name).to.equal('foo');
      expect(layer.enabled).to.equal(true);
      expect(layer.length).to.equal(3);
      expect(layer.fn).to.equal(foo);
      expect(index).to.equal(3);

      primus.use(bar, 4);

      index = primus.indexOfLayer('bar');
      layer = primus.layers[index];

      expect(layer.name).to.equal('bar');
      expect(layer.enabled).to.equal(true);
      expect(layer.length).to.equal(3);
      expect(layer.fn).to.equal(bar);
      expect(index).to.equal(4);

      primus.use(function baz(options) {
        expect(this).to.equal(primus);
        expect(options).to.be.a('object');
        expect(options).to.eql({});

        return function (req, res) { };
      });

      index = primus.indexOfLayer('baz');
      layer = primus.layers[index];

      expect(layer.name).to.equal('baz');
      expect(layer.enabled).to.equal(true);
      expect(layer.length).to.equal(2);
      expect(index).to.equal(primus.layers.length - 1);
    });
  });

  describe('#indexOfLayer', function () {
    it('returns the index based on name', function () {
      expect(primus.indexOfLayer('foo')).to.equal(-1);

      primus.use('foo', function (req, res) {
        throw new Error('Dont execute me');
      });

      expect(primus.indexOfLayer('foo')).to.be.above(-1);
    });
  });

  describe('#remove', function () {
    it('removes the layer from the stack', function () {
      primus.use('bar', function (req, res) {});
      primus.use('foo', function (req, res) {
        throw new Error('boom');
      });

      expect(primus.indexOfLayer('foo')).to.be.above(-1);
      expect(primus.indexOfLayer('bar')).to.be.above(-1);

      primus.remove('foo');
      expect(primus.indexOfLayer('foo')).to.equal(-1);
      expect(primus.indexOfLayer('bar')).to.be.above(-1);
    });
  });

  describe('#disable', function () {
    it('disables the middleware', function () {
      primus.use('foo', function (req, res) {});

      var index = primus.indexOfLayer('foo')
        , layer = primus.layers[index];

      expect(layer.enabled).to.equal(true);
      primus.disable('foo');
      expect(layer.enabled).to.equal(false);
    });
  });

  describe('#enable', function () {
    it('enables the middleware', function () {
      primus.use('foo', function (req, res) {});

      var index = primus.indexOfLayer('foo')
        , layer = primus.layers[index];

      primus.disable('foo');
      expect(layer.enabled).to.equal(false);

      primus.enable('foo');
      expect(layer.enabled).to.equal(true);
    });
  });
});
