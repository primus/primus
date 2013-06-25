# Transformer: Engine.IO

A transformer abstraction for the Engine.IO framework. To enable this
transformer inside of `Primus` you need to add `engine.io` to your package.json:

```
npm install engine.io --save
```

And tell primus to use `engine.io` as transformer.

```js
var Primus = require('primus');

var primus = new Primus(server, { transformer: 'engine.io' });

primus.on('connection', function connection(spark) {

});
```
