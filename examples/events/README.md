# Events

This is a "small" example which allows you to see what kind of **public** events
Primus emits during the live cycle of a single connection.

Before you run this example you need to install the dependencies. It uses the
`argh` module for some CLI magic so you can easily switch between transformers.

```
npm install .
```

Should install required dependencies (make sure you did the same in the previous
folder).

After this you can run the example using `node index.js`. You can switch easily
between transformer using the `--tranformer <name>` flag. Parsers can be changed
using `--parser <name>` and if you want to run it on different port then port
`8080` you can use the `--port <number>` flag.

Once the server is running you can point your browser to
[http://localhost:8080](http://localhost:8080), open the console and play with
the `primus` variable.
