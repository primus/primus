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
      assert.ok(!('foo' in primus.events));

      function foo() { }
      primus.on('foo', foo);

      assert.ok('foo' in primus.events);
      assert.is('array', primus.events.foo);
      assert.ok(primus.events.foo.length);
      assert.ok(primus.events.foo[0] === foo);
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
});
