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

    primus.plugin('emit', {
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
        primus.destroy(done);
      });
    });

    server.listen(port, function () {
      var Socket = primus.Socket
        , socket = new Socket('http://localhost:'+ port);

      socket.$emit('custom event', 'custom data');
    });
  });

  it('can transform the connection url', function (done) {
    var server = http.createServer()
      , primus = new Primus(server)
      , port = common.port;

    primus.plugin('qs', {
      client: function (primus) {
        primus.on('outgoing::url', function (options) {
          options.query = 'foo=bar';
        });
      }
    });

    primus.on('connection', function (spark) {
      expect(spark.query).to.not.have.property('_primuscb');
      expect(spark.query.foo).to.equal('bar');
      primus.destroy(done);
    });

    server.listen(port, function () {
      new primus.Socket('http://localhost:'+ port);
    });
  });

  it('extends the Spark with overriding the global spark', function (done) {
    var server = http.createServer()
      , primus = new Primus(server)
      , port = common.port;

    primus.plugin('spark', {
      server: function (primus) {
        var Spark = primus.Spark;

        Spark.prototype.join = function join() {};
        expect(Spark.prototype.join).to.not.equal(Primus.Spark.prototype.join);
      }
    });

    primus.on('connection', function (spark) {
      expect(spark.join).to.be.a('function');
      primus.destroy(done);
    });

    server.listen(port, function () {
      new primus.Socket('http://localhost:'+ port);
    });
  });

  it('doesn\'t mutate the Spark prototype', function () {
    var expected = Primus.Spark.prototype.__initialise.slice()
      , server = http.createServer()
      , primus = new Primus(server);

    primus.plugin('dummy', {
      server: function (primus) {
        primus.Spark.prototype.initialise = function init() {};
      }
    });

    expect(Primus.Spark.prototype.__initialise).to.eql(expected);
  });

  it('can instantly modify the prototype', function () {
    var server = http.createServer()
      , primus = new Primus(server);

    expect(primus.channel).to.be.a('undefined');

    primus.plugin('spark', {
      server: function (primus) {
        primus.channel = function channel() {};
      }
    });

    expect(primus.channel).to.be.a('function');
  });

  it('emits a `plugin` event when a new plugin is added', function (next) {
    var server = http.createServer()
      , primus = new Primus(server);

    primus.on('plugin', function (name, obj) {
      expect(name).to.equal('foo');
      expect(obj).to.be.a('object');

      next();
    });

    primus.plugin('foo', {
      server: function () {}
    });
  });

  it('allows to get a registered plugin by name', function () {
    var server = http.createServer()
      , primus = new Primus(server);

    var plugin = {
      server: function () {}
    };

    primus.plugin('spark', plugin);
    expect(primus.plugin('spark')).to.equal(plugin);
    expect(primus.plugin('undef')).to.equal(undefined);
  });

  it('allows to get all registered plugins', function () {
    var server = http.createServer()
      , primus = new Primus(server);

    expect(primus.plugin()).to.eql({});

    var plugin = {
      server: function () {}
    };

    primus.plugin('spark', plugin);
    expect(primus.plugin()).to.eql({ spark: plugin });
  });

  describe('#plugout', function () {
    it('emits a `plugout` event when removing a plugin', function (next) {
      var server = http.createServer()
        , primus = new Primus(server);

      primus.on('plugout', function (name, obj) {
        expect(name).to.equal('foo');
        expect(obj).to.be.a('object');

        next();
      });

      primus.plugin('foo', {
        server: function () {}
      });

      expect(primus.plugout('foo')).to.equal(true);
    });
  });
});
