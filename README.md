# Primus

[![Build Status](https://travis-ci.org/3rd-Eden/primus.png)](https://travis-ci.org/3rd-Eden/primus)

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
supported by Primus, so check out the parser folder for examples). To set parser
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
scope of this project. You can store this on a CDN or on your static server. Do
what ever you want with it, but I would advice you to regenerate that file every
time you redeploy so it always contains a client side library that is compatible
with your back-end.

Once you're all set up you can start listening for connections. These
connections are announced through the `connection` event.

```js
primus.on('connection', function (spark) {
  // spark is the new connection.
});
```

Disconnects are announced using a `disconnection` event:

```js
primus.on('disconnected', funciton (spark) {
  // the spark that disconnected
});
```

The `spark` the actual real-time socket/connection. Sparks have a really low
level interface and only expose a couple properties that are cross engine
supported. The interface is modeled towards a Nodejs stream compatible
interface.

#### spark.headers

The `spark.headers` property contains contains the headers of either the request
that started a handshake with the server or the headers of the actual real-time
connection. This depends on the module you are using.

#### spark.address

The `spark.address` property contains the remoteAddress and remotePort of the
connection. If you're running your server behind a reverse proxy it will be
useless to you and you should probably be checking the `spark.headers` for
`x-fowarded-xxx` headers instead.

#### spark.write(data)

You can use the `spark.write` method to send data over the socket. The data is
automatically encoded for you using the `parser` that you've set while creating
the Primus instance. This method always returns `true` so back pressuere isn't
handled.

```js
spark.write({ foo: 'bar' });
```

#### spark.end()

The `spark.end()` closes the connection.

#### spark.emits(event, parser)

This method is mostly used internally. It returns a function that emits assigned
`event` every time it's called. It only emits the first received argument or the
result of the optional `parser` call. The `parser` function receives all
arguments and can parse it down to a single value or just extracts the useful
information from the data. Please note that the data that is received here isn't
decoded yet.

```js
spark.emits('event', function parser(structure) {
  return structure.data;
});
```

### Supported real-time frameworks

The following transformers/transports are supported in Primus:

#### engine.io

Engine.io is the low level transport functionality of socket.io 1.0. It supports
multiple transports for creating a real-time connection. It uses transport
upgrading instead of downgrading which makes it more resilliant to blocking
proxies and firewalls. To enable `engine.io` you need to install the `engine.io`
module:

```
npm install engine.io --save
```

And tell `Primus` that you want to us `engine.io` as transformer:

```js
var primus = new Primus(server, { transformer: 'engine.io' });
```

#### WebSockets

If you are targetting a high end audiance or maybe just something for internal
uses you can use a pure WebSocket server. This uses the `ws` WebSocket module
which is known to be one if not the fastest WebSocket server available in
Node.js and supports all protocol specifications. To use pure WebSockets you
need to install the `ws` module:

```
npm install ws --save
```

And tell `Primus` that you want to use `WebSockets` as transformer:

```js
var primus = new Primus(server, { transformer: 'websockets' });
```

#### Browserchannel

Browserchannel was the original technology that GMail used for their real-time
communication. It's designed for same domain communication and does not use
WebSockets. To use browserchannel you need to install the `browserchannel`
module:

```
npm install browserchannel --save
```

And tell `Primus` that you want to use `browserchannel` as transformer:

```js
var primus = new Primus(server, { transformer: 'browserchannel' });
```

#### Socket.IO

The socket.io transport was written against socket.io 0.9. It was one of the
first real-time servers written on Node.js and is one of the most used modules
in Node.js. It uses multiple transports to connect the server. To use socket.io
you need to install the `socket.io` module:

```
npm install socket.io --save
```

And tell `Primus` that you want to use `socket.io` as transformer:

```js
var primus = new Primus(server, { transformer: 'socket.io' });
```

As you can see from the examples above, it doesn't matter how you write the name
of the transformer, we just `toLowerCase()` everything.

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
