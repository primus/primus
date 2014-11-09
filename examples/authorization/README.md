# Authorization

This example shows how you can add an authorization hook to accept or refuse
incoming connections. In this example we validate a JSON Web Token (JWT) sent
as a query string parameter.

To run it you have to install its dependencies:

```shell
npm install
```

After this you can start the server using `node index.js`. When the server is
running point your browser to [http://localhost:8080](http://localhost:8080).
