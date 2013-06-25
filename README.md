# Primus

Primus, the creator god of transformers but now also known as universal wrapper
for real-time frameworks. There are a lot of real-time frameworks available for
Node.js and they all have different opinions on how real-time should be done.
Primus provides a common low level interface to communicate in real-time using
various of real-time frameworks.

### Installation

Primus is released in `npm` and can be installed using:

```
npm install primus --save
```

### Getting started

Primus doesn't ship with real-time frameworks as dependencies, it assumes that
you as user adds them your self as a dependency. This is done to keep the module
as light weight as possible. This works because `require` in will walk through
your directories searching for `node_module` folders that have these matching
dependencies.

Primus needs to be "attached" to a HTTP compatible server. These includes the
build in `http` and `https` servers but also the `spdy` module as it has the
same API as node servers. Creating a new Primus instance is relatively straight
forward:

```js
'use strict';

var Primus = require('primus')
  , http = require('http');

var server = http.createServer(/* request handler */)
  , primus = new Primus(server, {/* options */});
```

In addition to support different frameworks we've also made it possible to use
custom encoding and decoding libraries. We're using `JSON` by default but you
could also use `msgpack` or `JSONH` for example (but these parsers need to be
supported by prisum, so check out the parser folder for examples). To set parser
you can supply a `parser` configuration option:

```js
var primus = new Primus(server, { parser: 'JSON' });
```

All parsers have an `async` interface for error handling.

As most libraries come with their own client-side framework for making the
connection we've also created a small wrapper for this. The library can be
retrieved using:

```js
primus.library();
```

Which returns the client-side library. It's not minified as that is out of the
scope of this project.

### Supported real-time framworks

The following transformers/transports are supported in Primus:

#### engine.io

To enable `engine.io` you need to install the `engine.io` module:

```
npm install engine.io --save
```

And tell `Primus` that you want to us `engine.io` as transformer:

```js
var primus = new Primus(server, { transformer: 'engine.io' });
```

#### WebSockets

To use pure websockets you need to install the `ws` module:

```
npm install ws --save
```

And tell `Primus` that you want to use `WebSockets` as transformer:

```js
var primus = new Primus(server, { transformer: 'websockets' });
```

### Versioning

All `0.x.x` releases should be considered unstable and not ready for production.
The version number is layed out as: `major.minor.patch` and tries to follow
semver as closely as possible but this is how we use our version numbering:

<dl>
  <dt>major</dt>
  <dd>
    <p>
      A major and possible breaking change has been made in the primus core.
      These changes are not backwards compatible with older versions.
    </p>
  </dd>
  <dt>minor</dt>
  <dd>
    <p>
      New features are added or a big change has happend with one of the
      real-time libraries that we've supporting.
    </p>
  </dd>
  <dt>patch</dt>
  <dd>
    <p>
      A bug has been fixed, without any major internal and breaking changes.
    </p>
  </dd>
</dl>

### License

MIT
