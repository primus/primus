# migration

- [Socket.IO](#Socket.IO)
- [Engine.IO]()
- [Sockjs]()
- [Browserchannel]()
- [WebSockets]()

Transforming your current project to use Primus is not as hard as you might
think. The API’s in Primus are really similar to the one’s your currently using
in framework **X**. We’ve prepared some small migration guides to make it even
easier!

## Socket.IO

- `socket.send`: Use the `socket.write` method.
- `socket.volatile`: No known replacement, but did not work as intended in
  Socket.IO either so I don't assume this as a big loss
- `socket.json.send`: Use the `socket.write` method, the encoding is done by default.


### Missing features

If you’ve been using Socket.IO quite heavily you might notice that there are
some features from Socket.IO that are missing in Primus. The reason that these
features are not implemented is that we want to keep core light so it's easier
to maintain and fix bugs. But! All of these missing features can be
re-introduced in Primus using plugins! Our amazing community has stepped up and
created a couple of small and reusable modules that add this missing
functionality.

#### Rooms

Primus doesn’t have a concept of rooms. If you are using the `socket.join` and
`socket.leave` methods in your code you can install the `primus-rooms` plugin:

```
npm install --save primus-rooms
```

After installing you can add the plugin using:

```js
primus.use('rooms', require('primus-rooms'));
```

And now you can join and leave rooms again. Manually leaving rooms when the
user disconnects isn't necessary, the plugin handles this for you. For more
information checkout the project on GitHub:

https://github.com/cayasso/primus-rooms

#### Namespace also known as multiplex

In Socket.IO you have a special `server.of` method which creates a new
namespace. There are some problems with this namespace implementation and that
is that these namespaces are static and once they are created the live for the
duration of your application. The plugins that introduce multiplexing in Primus
do not suffer from this, making them more flexible and powerful. There are two
different plugin you can use for multiplexing, there is `substream` which is
maintained by the Primus project or you can use `primus-multiplex`.

#### emit

There are different modules that re-introduce the `emit` method. You could use
the `primus-emit` module which is build and maintained by the Primus project or
the `primus-emitter`. The main different between these modules is the size of
the code and the method that its using to emit events. The `primus-emit` module
uses the same `emit` method to trigger events on the server and client while the
other module uses a `send` method. The `primus-emit` module is smaller in size
while the `primus-emitter` module is required by other plugins. 

> “A wish decision, you must make, young padawan” -- Yoda

In this guide we’re going to be using the `primus-emit` plugin as it has
complete API compatibility with Socket.IO. We install this module using:

```
npm install --save primus-emit
```

And the only thing we need to do to use it to add the plugin to the Primus
server using:

```js
primus.use('emit', require('primus-emit'));
```
