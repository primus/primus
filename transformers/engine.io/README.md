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

# Compiling the Engine.IO library

We cannot depend on the `engine.io.js` file because it uses a UMD wrapper
that doesn't work with Primus when using RequireJS. To compile the
`engine.io-client` correctly use the `update.sh` utility which will build the
library and expose it as a property of the global object.
The steps required are the following:

1. Fork or clone Primus
2. cd in the directory and run `npm install`
3. cd in the directory `transformers/engine.io/` and run `./update.sh`
4. Commit the changes to the Primus main repository
5. Profit
