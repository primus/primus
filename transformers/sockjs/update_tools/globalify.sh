#!/usr/bin/env node

'use strict';

var dir = process.argv.slice(2)[0];

if (!dir) {
  var message = 'usage: globalify <directory>\n       ' +
    'build the sockjs-client pruning the UMD wrapper';
  console.log(message);
  process.exit(1);
}

var condenseify = require('condenseify')
  , browserify = require('browserify')
  , derequire = require('derequire')
  , stripify = require('./stripify')
  , deumdify = require('deumdify')
  , path = require('path')
  , fs = require('fs');

var options = {
  entries: [ path.join(dir, 'lib/entry.js') ],
  insertGlobalVars: {
    process: function process() { return '{ env: {} }'; }
  },
  standalone: 'SockJS'
};

//
// Build the SockJS client.
// This generates a bundle and exposes it as a property of the global object.
//
browserify(options)
  .exclude('debug')
  .transform(stripify)
  .transform(condenseify)
  .plugin(deumdify)
  .bundle(function (err, buf) {
    if (err) throw err;

    fs.writeFileSync(path.join(__dirname, '..', 'library.js'), derequire(buf));
  });
