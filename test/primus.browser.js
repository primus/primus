describe('primus.js', function () {
  'use strict';

  var Primus = require('./fixture/primus.websocket')
    , assert = require('assert')
    , primus = new Primus('/');

  //
  // Simple type helper.
  //
  assert.is = assert.is || function (value, type) {
    var internal = Object.prototype.toString.call(type).toLowerCase();
    assert.ok(internal === '[object '+ value.toLowerCase() +']');
  };

  it('is exposed as function', function () {
    assert.is('function', Primus);
  });

  describe('#on', function () {
    it('adds an "foo" event', function () {
      assert.ok(!('foo' in primus._events));

      function foo() { }
      primus.on('foo', foo);

      assert.ok('foo' in primus._events);
      assert.is('array', primus._events.foo);
      assert.ok(primus._events.foo.length);
      assert.ok(primus._events.foo[0] === foo);
    });

    it('is chaining', function () {
      assert.ok(primus.on('foo', function foo() {}) === primus);
    });
  });

  describe('#listeners', function () {
    it('always returns an Array', function () {
      assert.is('array', primus.listeners('bar'));
    });

    it('returns the added event listener', function () {
      function fooo() {}
      primus.on('fooo', fooo);

      assert.is('array', primus.listeners('fooo'));
      assert.ok(primus.listeners('fooo').length === 1);
      assert.ok(primus.listeners('fooo')[0] === fooo);
    });
  });

  describe('#emit', function () {
    it('it emits the values to the assigned event listeners', function (done) {
      primus.on('emitter', function (value, values) {
        assert.ok(values === 'values');
        assert.ok(value === 'value');
        assert.ok(this === primus);

        done();
      });

      primus.emit('emitter', 'value', 'values');
    });

    it('returns true when we have an emitter', function () {
      primus.on('true', function () {});

      assert.ok(primus.emit('true'));
      assert.ok(!primus.emit('false'));
    });
  });

  describe('#emits', function () {
    it('returns a function that emits the given event', function (done) {
      primus.on('incoming::spark', function incoming(data) {
        assert.ok(data === 'meh');
        done();
      });

      var emit = primus.emits('spark');
      emit('meh');
    });

    it('passes all arguments to the parser', function (done) {
      primus.on('incoming::bark', function (data) {
        assert.ok(data === 'foo');
        done();
      });

      var emit = primus.emits('bark', function parser(meh, balls) {
        assert.ok(meh === 'meh');
        assert.ok(balls === 'balls');

        return 'foo';
      });

      emit('meh', 'balls');
    });

    it('only sends the first argument', function (done) {
      primus.on('incoming::kwark', function (data, extra) {
        assert.ok(data === 'meh');
        assert.ok(undefined === extra);

        done();
      });

      var emit = primus.emits('kwark');
      emit('meh', 'balls');
    });
  });
});
