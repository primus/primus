'use strict';

//
// Require all dependencies.
//
var authorize = require('./authorize')
  , bodyParser = require('body-parser')
  , express = require('express')
  , http = require('http')
  , Primus = require('../..')
  , routes = require('./routes');

//
// Create an Express application.
//
var app = express();

app.use(express.static(__dirname + '/public'));
app.use(bodyParser.json());

app.post('/login', routes.login);

//
// Create an HTTP server and our Primus server.
//
var server = http.createServer(app)
  , primus = new Primus(server);

//
// Add the authorization hook.
//
primus.authorize(authorize);

//
// `connection` is only triggered if the authorization succeeded.
//
primus.on('connection', function connection(spark) {
  spark.on('data', function received(data) {
    console.log(spark.id, 'received message:', data);

    //
    // Echo back to the client any received data.
    //
    spark.write(data);
  });
});

//
// Begin accepting connections.
//
server.listen(8080, function listening() {
  console.log('Open http://localhost:8080 in your browser');
});
