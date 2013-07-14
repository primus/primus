'use strict';

var chai = require('chai');
chai.Assertion.includeStack = true;

//
// Expose primus
//
exports.Primus = require('../');

//
// Expose our assertations.
//
exports.expect = chai.expect;

//
// Expose request
//
exports.request = require('request');

//
// Expose a port number generator.
//
var port = 1111;
Object.defineProperty(exports, 'port', {
  get: function get() {
    return port++;
  }
});
