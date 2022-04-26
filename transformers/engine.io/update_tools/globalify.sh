#!/usr/bin/env node

'use strict';

const dir = process.argv.slice(2)[0];

if (!dir) {
  const message = 'usage: globalify <directory>\n       ' +
    'build the engine.io-client pruning the UMD wrapper';
  console.log(message);
  process.exit(1);
}

const path = require('path');
const pluginCommonJs = require('@rollup/plugin-commonjs');
const pluginTransformObjectAssign = require('@babel/plugin-transform-object-assign');
const presetEnv = require('@babel/preset-env');
const rollup = require('rollup');
const { babel } = require('@rollup/plugin-babel');
const { nodeResolve } = require('@rollup/plugin-node-resolve');

const inputOptions = {
  input: path.join(dir, 'build', 'esm', 'browser-entrypoint.js'),
  plugins: [
    babel({
      babelHelpers: 'bundled',
      presets: [presetEnv],
      plugins: [pluginTransformObjectAssign]
    }),
    nodeResolve({ browser: true }),
    pluginCommonJs()
  ]
};

const outputOptions = {
  banner: [
    '(function (f) {',
    '  var g;',
    '',
    "  if (typeof window !== 'undefined') {",
    '    g = window;',
    "  } else if (typeof self !== 'undefined') {",
    '    g = self;',
    '  }',
    '',
    '  g.eio = f();',
    '})(function () {'
  ].join('\n'),
  file: path.join(__dirname, '..', 'library.js'),
  footer: 'return eio;\n});',
  format: 'iife',
  name: 'eio'
};

//
// Build the Engine.IO client.
// This generates a bundle and exposes it as a property of the global object.
// The difference with the official build is that this bundle does not use a
// UMD pattern. The Primus client, in fact, expects to have a global `eio`
// available and the UMD wrapper prevents this global from being set when
// RequireJS is used. See issue #157.
//
rollup
  .rollup(inputOptions)
  .then(function (bundle) {
    return bundle.write(outputOptions);
  })
  .catch(function (err) {
    console.error(err);
    process.exit(1);
  });
