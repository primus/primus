'use strict';

//
// Require all dependencies.
//
var express = require('express')
  , expressSession = require('express-session')
  , cookieParser = require('cookie-parser')
  , http = require('http')
  , Primus = require('../..')
  , primusSession = require('./session');

//
// Create an Express application.
//
var app = express();

//
// Configure and save a reference to the `cookie-parser` middleware so we can
// reuse it in Primus.
//
var cookies = cookieParser('shhhh, very secret');

//
// Since this is only an example, we will use the `MemoryStore` to store the
// sessions. This is our session store instance.
//
var store = new expressSession.MemoryStore();

//
// Add the middleware needed for session support.
//
app.use(cookies);
app.use(expressSession({ store: store }));

app.get('/', function index(req, res) {
  //
  // Every time that we visit the index page we update the session with a new
  // timestamp.
  //
  req.session.timestamp = Date.now();
  res.sendfile(__dirname + '/index.html');
});

//
// Create an HTTP server and our Primus server.
//
var server = http.createServer(app)
  , primus = new Primus(server);

//
// Here we add the `cookie-parser` middleware and our session middleware. The 
// first will populate `req.signedCookies` and the second `req.session` for the
// requests captured by Primus.
//
primus.before('cookies', cookies);
primus.before('session', primusSession, { store: store });

primus.on('connection', function connection(spark) {
  //
  // Our session data can now be read from `spark.request.session`.
  //
  spark.write(JSON.stringify(spark.request.session, null, '  '));
});

//
// Begin accepting connections.
//
server.listen(8080, function listening() {
  console.log('Open http://localhost:8080 in your browser');
});
