# Sharing session data between Express and Primus

This example shows how you can use a custom middleware in Primus. We chose a
rather common use case where you need to share the session data between Express
and Primus. To achieve this, the example uses two middleware:

1. The Express `cookie-parser` that will parse the cookies
2. Our custom session middleware that will add the session data in the requests
captured by Primus

To run the example you have to install its dependencies:

```shell
npm install
```

After this you can start the server using `node index.js`. When the server is
running point your browser to [http://localhost:8080](http://localhost:8080).

The session data are transmitted to the client from the realtime connection and
every time that you refresh the page the session is updated with a new
timestamp.
