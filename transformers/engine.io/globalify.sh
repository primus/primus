#!/usr/bin/env node

'use strict';

var dir = process.argv.slice(2)[0];

if (!dir) {
  var message = 'usage: globalify <directory>\n       ' +
    'build the engine.io-client pruning the UMD wrapper';
  console.log(message);
  process.exit(1);
}

var browserify = require('browserify')
  , derequire = require('derequire')
  , concat = require('concat-stream')
  , deumdify = require('deumdify')
  , path = require('path')
  , fs = require('fs');

var options = {
  entries: [ path.resolve(dir, 'index.js') ],
  insertGlobalVars: {
    global: function glob() {
      return 'typeof self !== "undefined" ? self : ' +
        'typeof window !== "undefined" ? window : {}';
    }
  },
  standalone: 'eio',
  builtins: false
};

//
// Build the Engine.IO client.
// This generates a bundle and exposes it as a property of the global object.
// The difference with the official build is that this bundle does not use a
// UMD pattern. The Primus client, in fact, expects to have a global `eio`
// available and the UMD wrapper prevents this global from being set when
// RequireJS is used. See issue #157.
//
browserify(options).plugin(deumdify).bundle().pipe(concat({
  encoding: 'string'
}, function (output) {
  var dest = path.resolve(__dirname, 'library.js');
  fs.writeFileSync(dest, derequire(output));
}));
