# Transformer: SockJS

A transformer abstraction for the SockJS framework. To enable this
transformer inside of `Primus` you need to add `sockjs` to your package.json:

```
npm install sockjs --save
```

And tell primus to use `sockjs` as transformer.

```js
var Primus = require('primus');

var primus = new Primus(server, { transformer: 'sockjs' });

primus.on('connection', function connection(spark) {

});
```

# Compiling the SockJS library

To build the library use the `update.sh` utility. The steps required are the
following:

1. Fork or clone Primus
2. cd in the directory and run `npm install`
3. cd in the directory `transformers/sockjs/` and run `./update.sh`
4. Commit the changes to the Primus main repository
5. Profit
