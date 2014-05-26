#!/usr/bin/env node

'use strict';

var dir = process.argv.slice(2)[0];

if (!dir) {
  var message = 'usage: globalify <directory>\n       ' +
    'build engine.io-client using the `global-wrap` module';
  console.log(message);
  process.exit(1);
}

var derequire = require('derequire')
  , fs = require('fs')
  , globalWrap = require('global-wrap')
  , path = require('path');

var glob = function() {
  return 'typeof self !== "undefined" ? self : ' +
    'typeof window !== "undefined" ? window : {}';
};

//
// Build Engine.IO client using the `global-wrap` module.
// This generates a bundle and exposes it as a property of the global object.
// The difference with the official build is that this bundle does not use a
// UMD pattern. The Primus client, in fact, expects to have a global `eio`
// available and the UMD pattern prevents this global from being set when
// RequireJS is used. See issue #157.
//
globalWrap({
  bundleOptions: {
    insertGlobalVars: { global: glob }
  },
  constructorOptions: { builtins: false },
  global: 'eio',
  main: path.resolve(dir, 'index.js'),
  tmpDir: dir,
}, function (err, output) {
  if (err) throw err;
  var dest = path.resolve(__dirname, 'library.js');
  fs.writeFileSync(dest, derequire(output));
});
