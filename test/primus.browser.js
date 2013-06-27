describe('primus.js', function () {
  'use strict';

  var Primus = require('./fixture/primus.websocket')
    , assert = require('assert')
    , primus = new Primus('/');

  it('is exposed as function', function () {
    assert.ok(typeof Primus === 'function');
  });
});
