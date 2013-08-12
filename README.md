# Primus

[![Build Status](https://travis-ci.org/3rd-Eden/primus.png)](https://travis-ci.org/3rd-Eden/primus)
[![NPM version](https://badge.fury.io/js/primus.png)](http://badge.fury.io/js/primus)

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

### Table of Contents

- [Introduction](#primus)
  - [Highlights](#highlights)
- [Installation](#installation)
- [Getting Started](#getting-started)
- [Connecting from the server](#connecting-from-the-server)
  - [Broadcasting](#broadcasting)
  - [Destruction](#destruction)
- [Connecting from the browser](#connecting-from-the-browser)
- [Events](#events)
- [Supported real-time frameworks](#supported-real-time-frameworks)
  - [Engine.IO](#engineio)
  - [WebSockets](#websockets)
  - [BrowserChannel](#browserchannel)
  - [SockJS](#sockjs)
  - [Socket.IO](#socketio)
- [Transformer Inconsistencies](#transformer-inconsistencies)
- [Plugins](#plugins)
  - [Extending the Spark/socket](#extending-the-spark--socket)
  - [Transforming and intercepting messages](#transforming-and-intercepting-messages)
  - [Community Plugins](#community-plugins)
- [Scaling](#scaling)
- [Versioning](#versioning)
- [License](#license)

### Getting Started

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
with your back-end. To save the file you can use:

```js
primus.save(__dirname +'/primus.js');
```

This will store the compiled library in your current directory. If you want to
save it asynchronously, you can supply the method with an callback method:

```js
primus.save(__dirname +'/primus.js', function save(err) {

});
```

But to make it easier for you during development we've automatically added an
extra route to the supplied HTTP server, this will serve the library for you so
you don't have to save it. Please note, that this route isn't optimized for
serving static assets and should only be used during development. In your HTML
page add:

```html
<script src="/primus/primus.js"></script>
```

If you've configured a different `pathname` in the options deploy on a different
domain then your Primus server you would of course need to update the `src`
attribute to the correct location. It's always available at:

```
<protocol>://<server location>/<pathname>/primus.js
```

The client is cross domain compatible so you don't have to serve it from the
same domain you're running Primus on. But please note, that the real-time
framework you're using might be tied to same domain restrictions.

Once you're all set up you can start listening for connections. These
connections are announced through the `connection` event.

```js
primus.on('connection', function (spark) {
  // spark is the new connection.
});
```

Disconnects are announced using a `disconnection` event:

```js
primus.on('disconnection', function (spark) {
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

The `spark.address` property contains the `ip` and `port` of the
connection. If you're running your server behind a reverse proxy it will
automatically use the `x-forwarded-for` headers. This way you will always have
the address of the connecting client and not the IP address of your proxy.

*Please note that the `port` is probably out of date by the time you're going
to read it as it's retrieved from an old request, not the request that is
active at the time you access this property.*

#### spark.query

The `spark.query` contains the query string you used to connect to server. It's
parsed to a object. Please note that this is not available for all supported
transformers, but it's proven to be to useful to not implement it because one
silly transformer refuses to support it. Yes.. I'm looking at you,
BrowserChannel and SockJS.

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
    console.log('received data from the client', data);

    //
    // Always close the connection if we didn't receive our secret imaginary handshake.
    //
    if ('foo' !== data.secrethandshake) spark.end();
    spark.write({ foo: 'bar' });
    spark.write('banana');
  });

  spark.write('Hello world');
})
```

### Broadcasting

Broadcasting allows you to write a message to every connected `Spark` on your server. 
There are 2 different ways of doing broadcasting in Primus. The easiest way is to 
use the `Primus#write` method which will write a message to every connected user:

```js
primus.write(message);
```

There are cases where you only want to broadcast a message to a smaller group of 
users. To make it easier to do this, we've added a `Primus#forEach` method which 
allows you to iterate over all active connections.

```js
primus.forEach(function (spark, id, connections) {
  if (spark.query.foo !== 'bar') return;

  spark.write('message');
});
```

### Destruction

In rare cases you might need to destroy the Primus instance you've created. You
can use the `primus.destroy()` or `primus.end()` method for this. This method
accepts an Object which allows you to configure how you want the connections to
be destroyed:

- `close` Close the HTTP server that Primus received. Defaults to `true`.
- `end` End all active connections. Defaults to `true`.
- `timeout` Clean up the server and optionally, it's active connections after
  the specified amount of timeout. Defaults to `0`.

The timeout is especially useful if you want gracefully shutdown your server but
really don't want to wait an infinite amount of time.

```js
primus.destroy({ timeout: 10000 });
```

### Connecting from the Browser.

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

Once you've created your Primus instance you're ready to go. When you want to
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
  console.error('Something horrible has happened', err, err.message);
});
```

#### primus.on('reconnect')

The `reconnect` event is emitted when we're attempting to reconnect to the
server. This all happens transparently and it's just a way for you to know when
these reconnects are actually happening.

```js
primus.on('reconnect', function () {
  console.log('Reconnect attempt started');
});
```

### primus.on('reconnecting')

Looks a lot like the `reconnect` event mentioned above, but it's emitted when
we've detected that connection went/is down and we're going to start a reconnect
operation. This event would be ideal to update your application's UI that you're
connection is down and you are trying to reconnect in x seconds.

```js
primus.on('reconnecting', function (opts) {
  console.log('Reconnecting in %d ms', opts.timeout);
  console.log('This is attempt %d out of %d', opts.attempt, opts.retries);
});
```

#### primus.on('end')

The `end` event is emitted when we've closed the connection. When this event is
emitted you should consider your connection to be fully dead with no way of
reconnecting. But it's also emitted when the server closes the connection.

```js
primus.on('end', function () {
  console.log('Connection closed');
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
  console.log('received a message', message);

  primus.write({ echo: message });
});

primus.write('hello world');
```

### Connecting from the server

The client-side library has been made compatible with Node.js so the same code
base can be re-used for server side connections. There are two ways of creating
a server side client.

1. When you've created your `primus` instance you can access the `Socket`
   property on it. This `Socket` is automatically configured to connect to the
   correct pathname, using the same `transformer` and `parser` that you've
   specified when you created your `primus` instance.

   ```js
   var primus = new Primus(server, { transformer: transformer, parser: parser })
     , Socket = primus.Socket;

   var client = new Socket('http://localhost:8080');
   //
   // It has the same interface as the client, so you can just socket.write or
   // listen for the `open` events etc.
   //
   ```
2. You might need to connect from a different node process where you don't have
   access to your `primus` instance and the compatible `Socket` instance. For
   these cases there a special `createSocket` method where you can specify the
   `transformer`, `parser`, `plugin` that you are using on your server to create
   another compatible socket. 

   ```js
   var Socket = Primus.createSocket({ transformer: transformer, parser: parser })
     , client = new Socket('http://localhost:8080');
  ```

  If you do not know which transformers, parsers are used on the server, we
  expose a small JSON "spec" file that exposes this information. The
  specification can be reached on the `/<pathname>/spec` and will output the
  following JSON document:

  ```json
  {
    "version":"1.0.1",
    "pathname":"/primus",
    "parser":"json",
    "transformer":"websockets"
  }
  ```

### Events

Primus is build upon the Stream and EventEmitter interfaces. This is a summary
of the events emitted by Primus.

Event                 | Usage       | Location      | Description
----------------------|-------------|---------------|----------------------------------------
`outgoing::reconnect` | private     | client        | Transformer should reconnect.
`reconnecting`        | **public**  | client        | We're scheduling a reconnect.
`reconnect`           | **public**  | client        | Reconnect attempt is about to be made.
`outgoing::open`      | private     | client/spark  | Transformer should connect.
`incoming::open`      | private     | client/spark  | Transformer has connected.
`open`                | **public**  | client        | Connection is open.
`incoming::error`     | private     | client        | Transformer received error.
`error`               | **public**  | client/spark  | An error happened.
`incoming::data`      | private     | client/server | Transformer received data.
`outgoing::data`      | private     | client/spark  | Transformer should write data.
`data`                | **public**  | client/spark  | We received data.
`incoming::end`       | private     | client/spark  | Transformer closed the connection.
`outgoing::end`       | private     | client/spark  | Transformer should close connection.
`end`                 | **public**  | client        | The connection has closed.
`connection`          | **public**  | server        | We received a new connection.
`disconnection`       | **public**  | server        | A connection closed.
`initialised`         | **public**  | server        | The server is initialised.

### Supported Real-time Frameworks

The following transformers/transports are supported in Primus:

#### Engine.IO

Engine.IO is the low level transport functionality of Socket.IO 1.0. It supports
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

The `browserchannel` transformer comes with build in node client support and can be
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
npm install sockjs-client-node --save
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

### Transformer Inconsistencies

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
  can apply this [patch](http://github.com/3rd-Eden/engine.io/commit/0cf81270e9d5700).

### Plugins

Primus was build as low level interface where you can build your applications
upon. At it's core, it's nothing more than something that passes messages back
and forth between the client and server. To make it easier for developers to
switch to Primus we've developed a simple but effective plugin system that
allows you to extend primus's functionality.

Plugins are added on the server side in the form of an `Object`:

```js
primus.use('name', {
  server: function (primus, options) {},
  client: function (primus, options) {},
  library: 'client side library'
});
```

Or you can pass the plugin `Object` directly in to the constructor:

```js
var primus = new Primus(server, { plugin: {
  name: {
    server: function (primus, options) {},
    client: function (primus, options) {},
    library: 'client side library'
  }
}})
```

The server function is only executed on the server side and receives 2
arguments:

1. A reference to the initialized primus server.
2. The options that we're passed in to the `new Primus(server, { options })`
   constructor. So the plugins can be configured through the same interface.

The client receives the same arguments:

1. A reference to the initialized primus client.
2. The options that we're passed in the `new Primus(url, { options })`
   constructor. So the plugin in configured through the same interface.

The only thing you need to remember is that the client is stored in the library
using `toString()` so it cannot have any references out side the client's
closure. But luckily, there's a `library` property that will also be included on
the client side when it's specified.

#### Extending the Spark / Socket

The server has a `.Spark` property that can be extended. This allows you to
easily add new functionality to the socket. For example adding join room
function would be as easy as:

```js
primus.use('rooms', {
  server: function (primus) {
    var Spark = primus.Spark;

    Spark.prototype.join = function () {
      // implement room functionality.
    };
  }
});
```

#### Transforming and intercepting messages

Intercepting and transforming messages in something that a lot of plugins
require. When your building an `EventEmitter` plugin or something else you
probably don't want the default `data` event to be emitted but your custom
event. There are 2 different types of messages that can be transformed:

1. `incoming` These messages are being received by the server.
2. `outgoing` These messages are being send to the client.

The transformer is available on both the client and the server and share, like
you would have expected the same identical API. Adding a new transformer is
relatively straight forward:

```js
primus.transform('incoming', function (packet) {
  //
  // The packet.data contains the actual message that either received or
  // transformed.
  //
  
  // This would transform all incoming messages to foo;
  packet.data = 'foo';

  // If you are handling the message and want to prevent the `data` event from
  // happening, simply `return false` at the end of your function. No new
  // transformers will be called, and the event won't be emitted.
});
```

These transformations can easily be done in the plugins:

```js
primus.use('name', {
  server: function (primus) {
    primus.transform('outgoing', function (packet) {
      packet.data = 'foo';
    });

    primus.transform('incoming', function (packet) {
      if (packet.data === 'foo') packet.data = 'bar';
    });
  },

  client: function (primus) {
    primus.transform('outgoing', function (packet) {
      packet.data = 'foo';
    });

    primus.transform('incoming', function (packet) {
      if (packet.data === 'foo') packet.data = 'bar';
    });
  }
});
```

#### Community Plugins

These are plugins created by our amazing community. Do you have a module that
you want to have listed here? Make sure it has test suite and runs on [Travis CI].
After that open a pull request where you added your module to this README and
see it be merged automatically.

<dl>
  <dt><a href="http://github.com/cayasso/primus-rooms">primus-rooms</a></dt>
  <dd>
    A module that adds rooms capabilities to Primus. It's based on the rooms
    implementation of Socket.IO.
  </dd>
  <dd>
    <a href="https://travis-ci.org/cayasso/primus-rooms">
      <img src="https://travis-ci.org/cayasso/primus-rooms.png?branch=master" alt="Build Status" />
    </a>
    <a href="http://badge.fury.io/js/primus-rooms">
      <img src="https://badge.fury.io/js/primus-rooms.png" alt="NPM version" />
    </a>
  </dd>
</dl>

<dl>
  <dt><a href="http://github.com/cayasso/primus-multiplex">primus-multiplex</a></dt>
  <dd>
    A module that adds multiplexing capabilities to Primus.
  </dd>
  <dd>
    <a href="https://travis-ci.org/cayasso/primus-multiplex">
      <img src="https://travis-ci.org/cayasso/primus-multiplex.png?branch=master" alt="Build Status" />
    </a>
    <a href="http://badge.fury.io/js/primus-multiplex">
      <img src="https://badge.fury.io/js/primus-multiplex.png" alt="NPM version" />
    </a>
  </dd>
</dl>

<dl>
  <dt><a href="http://github.com/cayasso/primus-emitter">primus-emitter</a></dt>
  <dd>
    A module that adds emitter capabilities to Primus.
  </dd>
  <dd>
    <a href="https://travis-ci.org/cayasso/primus-emitter">
      <img src="https://travis-ci.org/cayasso/primus-emitter.png?branch=master" alt="Build Status" />
    </a>
    <a href="http://badge.fury.io/js/primus-emitter">
      <img src="https://badge.fury.io/js/primus-emitter.png" alt="NPM version" />
    </a>
  </dd>
</dl>

[Travis CI]: https://travis-ci.org/

### Scaling

Scaling Primus is as simple as sticking it behind a load balancer that supports
sticky sessions and run multiple versions of your application. This is a vital
feature that your load balancer needs to support. This ensures that the incoming
requests always go back to the same server. If your load balancer does not
support sticky sessions, get an other one. I highly recommend
[HAProxy](http://haproxy.1wt.eu/). According to my own testing it the fastest
and best proxy available that supports WebSockets. See
https://github.com/observing/balancerbattle for more detailed information.

### Versioning

All `0.x.x` releases should be considered unstable and not ready for production.
The version number is laid out as: `major.minor.patch` and tries to follow
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
      New features are added or a big change has happened with one of the
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
