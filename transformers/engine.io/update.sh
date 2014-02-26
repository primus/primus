#!/usr/bin/env node

'use strict';

var fs = require('fs')
  , globalWrap = require('global-wrap')
  , main = require.resolve('engine.io-client')
  , path = require('path')
  , tmpdir = path.dirname(main);

//
// Build Engine.IO client using the `global-wrap` module.
// This generates a bundle and exposes it as a property of the global object.
// The difference with the official build is that this bundle does not use a
// UMD pattern. The Primus client, in fact, expects to have a global `eio`
// available and the UMD pattern prevents this global from being set when
// RequireJS is used. See issue #157.
//
globalWrap({
  constructorOptions: { builtins: false },
  global: 'eio',
  main: main,
  tmpDir: tmpdir,
}, function (err, output) {
  if (err) throw err;
  var dest = path.resolve(__dirname, 'library.js');
  fs.writeFileSync(dest, output);
});
