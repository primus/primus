describe('Plugin', function () {
  'use strict';

  var common = require('./common')
    , Primus = common.Primus
    , http = require('http')
    , expect = common.expect;

  it('works with this simple event emitter plugin', function (done) {
    var server = http.createServer()
      , primus = new Primus(server)
      , port = common.port;

    primus.use('emit', {
      server: function (primus) {
        primus.transform('incoming', function (packet) {
          var data = packet.data;
          if (!('object' === typeof data && 'event' in data && 'args' in data)) return;

          this.emit.apply(this, [data.event].concat(data.args));
          return false;
        });
      },

      client: function (primus) {
        primus.$emit = function trigger(event) {
          return this.write({
            event: event,
            args: Array.prototype.slice.call(arguments, 1)
          });
        };
      }
    });

    primus.on('connection', function (spark) {
      spark.on('custom event', function (data) {
        expect(data).to.equal('custom data');

        spark.end();
        server.close(done);
      });
    });

    server.listen(port, function () {
      var Socket = primus.Socket
        , socket = new Socket('http://localhost:'+ port);

      socket.$emit('custom event', 'custom data');
    });
  });

  it('extends the Spark with overriding the global spark', function (done) {
    var server = http.createServer()
      , primus = new Primus(server)
      , port = common.port;

    primus.use('spark', {
      server: function (primus) {
        var Spark = primus.Spark;

        Spark.prototype.join = function join() {};
        expect(Spark.prototype.join).to.not.equal(Primus.Spark.prototype.join);
      }
    });

    primus.on('connection', function (spark) {
      expect(spark.join).to.be.a('function');
      spark.end();
      server.close(done);
    });

    server.listen(port, function () {
      var Socket = primus.Socket
        , socket = new Socket('http://localhost:'+ port);
    });
  });

  it('can instantly modify the prototype', function () {
    var server = http.createServer()
      , primus = new Primus(server);

    expect(primus.channel).to.be.a('undefined');

    primus.use('spark', {
      server: function (primus) {
        primus.channel = function channel() {};
      }
    });

    expect(primus.channel).to.be.a('function');
  });

  describe('#plugin', function () {
    it('returns the plugin for the given name', function () {
      var server = http.createServer()
        , primus = new Primus(server);

      var plugin = {
        server: function (primus) {}
      };

      primus.use('spark', plugin);
      expect(primus.plugin('spark')).to.equal(plugin);
      expect(primus.plugin('undef')).to.equal(undefined);
    });

    it('returns an empty Object', function () {
      var server = http.createServer()
        , primus = new Primus(server);

      expect(primus.plugin()).to.be.a('object');
      expect(Object.keys(primus.plugin())).to.have.length(0);
    });
  });
});
