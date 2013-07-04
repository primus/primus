```
FYI: Consider this module broken, dead until 1.0 is released.
```

# Primus

[![Build Status](https://travis-ci.org/3rd-Eden/primus.png)](https://travis-ci.org/3rd-Eden/primus)

Primus, the creator god of transformers but now also known as universal wrapper
for real-time frameworks. There are a lot of real-time frameworks available for
Node.js and they all have different opinions on how real-time should be done.
Primus provides a common low level interface to communicate in real-time using
various of real-time frameworks.

### Highlights

1. Effortless switching between real-time frameworks and message parsers.
2. Clean and stream compatible interface for client and server.
3. Fixes bugs in frameworks and real-time communication where needed.
4. Build with love and passion for real-time.
5. Reconnect that actually works.

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
supported. The interface is modeled towards a Node.js stream compatible
interface.

#### spark.headers

The `spark.headers` property contains contains the headers of either the request
that started a handshake with the server or the headers of the actual real-time
connection. This depends on the module you are using.

#### spark.address

The `spark.address` property contains the `remoteAddress` and `remotePort` of the
connection. If you're running your server behind a reverse proxy it will be
useless to you and you should probably be checking the `spark.headers` for
`x-fowarded-xxx` headers instead.

#### spark.query

The `spark.query` contains the query string you used to connect to server. It's
parsed to a object. Please note that this is not available for all supported
transformers, but it's proven to be to useful to not implement it because one
silly tranformer refuses to support it. Yes.. I'm looking at you,
browserchannel.

#### spark.id

This is the connection id we use to identify the connection. This should not be
seen as a "session id" and can change between disconnects and reconnects.

#### spark.write(data)

You can use the `spark.write` method to send data over the socket. The data is
automatically encoded for you using the `parser` that you've set while creating
the Primus instance. This method always returns `true` so back pressure isn't
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

#### spark.on('data')

The `data` event is emitted when a message is received from the client. It's
automatically decoded by the specified decoder.

```js
spark.on('data', function message(data) {
  // the message we've received.
});
```

#### spark.on('end')

The `end` event is emitted when the client has disconnected.

```js
primus.on('connection', function (spark) {
  console.log('connection has the following headers', spark.headers);
  console.log('connection was made from', spark.address);
  console.log('connection id', spark.id);

  spark.on('data', function (data) {
    console.log('recieved data from the client', data);

    if ('foo' !== data.secrethandshake) spark.end();
    spark.write({ foo: 'bar' });
    spark.write('banana');
  });

  spark.write('Hello world');
})
```

### Connecting from the browser.

Primus comes with it's client framework which can be compiled using
`primus.library()` as mentioned above. To create a connection you can simply
create a new Primus instance:

```js
var primus = new Primus(url, { options });

//
// But it can be easier, with some syntax sugar.
//
var primus = Primus.connect(url, { options });
```

#### primus.write(message)

Once you've created your primus instance you're ready to go. When you want to
write data to your server you can just call the `.write` method:

```js
primus.write('message');
```

It automatically encodes your messages using the parser that you've specified on
the server. So sending objects back and forth between the server is nothing
different then just writing:

```js
primus.write({ foo: 'bar' });
```

When you are sending messages to the server, you don't have to wait for the
`open` event to happen, the client will automatically buffer all the data you've
send and automatically write it to the server once it's connected. The client
supports a couple of different events.

#### primus.on('data')

The `data` event is the most important event of the whole library. It's emitted
when we receive data from the server. The data that is received is already
decoded by the specified parser.

```js
primus.on('data', function message(data) {
  console.log('Received a new message from the server', data);
});
```

#### primus.on('open')

The `open` event is emitted when we've successfully created a connection with
the server. It will also be emitted when we've successfully reconnected when the
connection goes down unintentionally.

```js
primus.on('open', function open() {
  console.log('Connection is alive and kicking');
});
```

#### primus.on('error')

The `error` event is emitted when something breaks that is out of our control.
Unlike Node.js, we do not throw an error if no error event listener is
specified. The cause of an error could be that we've failed to encode or decode
a message or we failed to create a connection.

```js
primus.on('error', function error(err) {
  console.error('Something horrible has happend', err, err.message);
});
```

#### primus.on('reconnect')

The `reconnect` event is emitted when we're attempting to reconnect to the
server. This all happens transparently and it's just a way for you to know when
these reconnects are actually happening.

```js
primus.on('reconnecting', function () {
  console.log('reconnecting');
})
```

#### primus.on('end')

The `end` event is emitted when we've closed the connection. When this event is
emitted you should consider your connection to be fully dead with no way of
reconnecting. But it's also emitted when the server closes the connection.

```js
primus.on('end', function () {
  console.log('connection closed');
});
```

#### primus.end()

When you want to close the connection you can call the `primus.end()` method.
After this the connection should be considered dead and a new connection needs
to be made using `Primus.connect(url)` or `primus = new Primus(url)` if you want
to talk with the server again.

```js
primus.end();
```

#### Reconnecting

When the connection goes down unexpectedly a automatic reconnect process is
started. It's using a randomized exponential backoff algorithm to prevent
clients to DDOS your server when you reboot as they will all be re-connecting at
different times. The reconnection can be configured using the `options` argument
in `Primus` and you should add these options to the `backoff` property:

```js
primus = Primus.connect(url, {
  backoff: {
    maxDelay: Infinity // Number: The max delay for a reconnect retry.
  , minDelay: 500 // Number: The minimum delay before we reconnect.
  , retries: 10 // Number: How many times should we attempt to reconnect.
  , factor: 2 // Number The backoff factor.
  }
});
```

Please do note when we reconnect, you will receive a new `connection` event on
the server. As the previous connection was completely dead and should there for
be considered a new connection.

If you are interested in learning more about the backoff algorithm you might
want to read http://dthain.blogspot.nl/2009/02/exponential-backoff-in-distributed.html

```js
var primus = Primus.connect(url);

primus.on('data', function (message) {
  console.log('recieved a message', message);

  primus.write({ echo: message });
});

primus.write('hello world');
```

### Supported real-time frameworks

The following transformers/transports are supported in Primus:

#### engine.io

Engine.io is the low level transport functionality of Socket.io 1.0. It supports
multiple transports for creating a real-time connection. It uses transport
upgrading instead of downgrading which makes it more resilient to blocking
proxies and firewalls. To enable `engine.io` you need to install the `engine.io`
module:

```
npm install engine.io --save
```

And tell `Primus` that you want to us `engine.io` as transformer:

```js
var primus = new Primus(server, { transformer: 'engine.io' });
```

If you want to use the client interface inside of Node.js you also need to
install the `engine.io-client`:

```
npm install engine.io-client --save
```

And then you can access it from your server instance:

```js
var Socket = primus.Socket;
  , socket = new Socket('url');
```

#### WebSockets

If you are targeting a high end audience or maybe just something for internal
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

The `WebSockets` transformer comes with build in client support and can be
accessed using:

```js
var Socket = primus.Socket;
  , socket = new Socket('url');
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

The `browserchannel` transformer comes with build in client support and can be
accessed using:

```js
var Socket = primus.Socket;
  , socket = new Socket('url');
```

#### SockJS

SockJS is a real-time server that focuses on cross-domain connections and does
this by using multiple transports. To use SockJS you need to install the
`sockjs` module:

```
npm install sockjs --save
```

And tell `Primus` that you want to use `sockjs` as transformer:

```js
var primus = new Primus(server, { transformer: 'sockjs' });
```

If yo want to use the client interface inside of Node.js you also need to
install the `sockjs-client-node` module:

```
npm install socket.io-client --save
```

And then you can access it from your server instance:

```js
var Socket = primus.Socket;
  , socket = new Socket('url');
```

#### Socket.IO

The Socket.IO transport was written against Socket.IO 0.9.x. It was one of the
first real-time servers written on Node.js and is one of the most used modules
in Node.js. It uses multiple transports to connect the server. To use Socket.IO
you need to install the `socket.io` module:

```
npm install socket.io --save
```

And tell `Primus` that you want to use `socket.io` as transformer:

```js
var primus = new Primus(server, { transformer: 'socket.io' });
```

If you want to use the client interface inside of Node.js you also need to
install the `socket.io-client`:

```
npm install socket.io-client --save
```

And then you can access it from your server instance:

```js
var Socket = primus.Socket;
  , socket = new Socket('url');
```

As you can see from the examples above, it doesn't matter how you write the name
of the transformer, we just `toLowerCase()` everything.

### Transformer inconsistencies

- Browserchannel does not give you access to the `remotePort` of the incoming
  connection. So when you access `spark.address` the `port` property will be set
  to `1337` by default.
- Browserchannel and SockJS do not support connections with query strings. You
  can still supply a query string in the `new Primus('http://localhost:80?q=s')`
  but it will not be accessible in the `spark.query` property.
- Browserchannel is the only transformer that does not support cross domain
  connections.
- SockJS and Browserchannel are originally written in CoffeeScript which can
  make it harder to debug when their internals are failing.
- Engine.IO and SockJS do not ship their client-side library with their server
  side component. We're bundling a snapshot of these libraries inside of Primus.
  We will always be targeting the latest version of these transformers when we
  bundle the library.
- There are small bugs in Engine.IO that are causing our tests to fail. I've
  submitted patches for these bugs, but they have been reject for silly reasons.
  The bug causes closed connections to say open. If you're experiencing this you
  can apply this [patch](/3rd-Eden/engine.io/commit/0cf81270e9d5700).

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
