#!/usr/bin/env node

'use strict';

const dir = process.argv.slice(2)[0];

if (!dir) {
  const message = 'usage: globalify <directory>\n       ' +
    'build the engine.io-client pruning the UMD wrapper';
  console.log(message);
  process.exit(1);
}

const condenseify = require('condenseify');
const browserify = require('browserify');
const derequire = require('derequire');
const stripify = require('./stripify');
const deumdify = require('deumdify');
const path = require('path');
const fs = require('fs');

const options = {
  entries: [ path.join(dir, 'lib', 'index.js') ],
  standalone: 'eio'
};

//
// Build the Engine.IO client.
// This generates a bundle and exposes it as a property of the global object.
// The difference with the official build is that this bundle does not use a
// UMD pattern. The Primus client, in fact, expects to have a global `eio`
// available and the UMD wrapper prevents this global from being set when
// RequireJS is used. See issue #157.
//
browserify(options)
  .ignore('buffer')
  .exclude('debug')
  .exclude('ws')
  .transform(stripify)
  .transform(condenseify)
  .plugin(deumdify)
  .bundle(function (err, buf) {
    if (err) throw err;

    fs.writeFileSync(path.join(__dirname, '..', 'library.js'), derequire(buf));
  });
