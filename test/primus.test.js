describe('Primus', function () {
  'use strict';

  var common = require('./common')
    , Primus = common.Primus
    , http = require('http')
    , expect = common.expect
    , server
    , primus;

  beforeEach(function beforeEach(done) {
    server = http.createServer();
    primus = new Primus(server);

    server.portnumber = common.port;
    server.listen(server.portnumber, done);
  });

  afterEach(function afterEach(done) {
    server.close(done);
  });

  it('exposes the current version number', function () {
    expect(primus.version).to.be.a('string');
    expect(primus.version).to.equal(require('../package.json').version);
  });

  it('exposes the client library', function () {
    expect(primus.client).to.be.a('string');
    expect(primus.client).to.include('{primus::library}');
  });

  it('exposes the Spark constructor', function () {
    expect(primus.Spark).to.be.a('function');
  });

  it('pre-binds the primus server in to the spark', function () {
    var spark = new primus.Spark();
    expect(spark.primus).to.equal(primus);
  });

  it('accepts custom message parsers');
});
