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

The build system of Engine.IO expects you to have `component` globally
installed. I've already send a pull request once to remove this in favour of
devDependencies but it got rejected.

In addition to that, we cannot depend on the `engine.io.js` file to be uptodate
as it's compilation has been forgotten many times before. So in order to compile
engine.io correcly without messing your system you need:

1. Clone the repository: `https://github.com/LearnBoost/engine.io-client.git`
2. Install `component` using `npm install component`
3. Update the `Makefile` and change `@component` to `@./node_modules/.bin/component`
4. Save and run `make build`
5. Override the `library.js` with the newly created `engine.io.js`
6. Profit
