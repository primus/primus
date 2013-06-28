# Example

This is a small example on how you can setup your own `Primus` server and work
with the API. Before you run this example you need to install the dependencies.
It uses the `argh` module for some CLI magic.

```
npm install .
```

Should install required dependencies (make sure you did the same in the previous
folder).

After this you can run the example using `node index.js`. You can switch easily
between transformer using the `--tranformer <name>` flag. Parsers can be changed
using `--parser <name>` and if you want to run it on different port then port
`8080` you can use the `--port <number>` flag.

Once the server is running you can go to [http://localhost:8080] in your browser
and open the console. You can interact with the `primus` variable.
