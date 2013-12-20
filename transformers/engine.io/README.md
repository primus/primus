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

We cannot depend on the `engine.io.js` file to be up to date as it's compilation
has been forgotten many times before. So in order to compile engine.io correctly
run:

1. Clone the repository: `https://github.com/LearnBoost/engine.io-client.git`
2. Save and run `make build`
3. Override the `library.js` with the newly created `engine.io.js`
4. Commit changes to the Primus main repository.
5. Profit
