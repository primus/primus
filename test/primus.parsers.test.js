describe('Primus parsers', function () {
  'use strict';

  var common = require('./common')
    , Primus = common.Primus
    , http = require('http')
    , expect = common.expect
    , fs = require('fs')
    , server
    , primus;

  beforeEach(function beforeEach(done) {
    server = http.createServer();
    server.portnumber = common.port;
    server.listen(server.portnumber, done);
  });

  it('connects with the binary parser', function () {
    var primus = new Primus(server, { parser: 'binary' });
    var Socket = primus.Socket;

    var socket = new Socket('http://localhost:' + server.portnumber);
  });
})
