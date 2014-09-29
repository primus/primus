'use strict';

var debug = require('diagnostics')('engine:socket:patch');

//
// The patches in this folder will applied to the client side library to fix
// various of issues. This file will actually patch the server component and
// override various of prototypes.
//

//
// Patch 1:
//
// Engine.IO has a bug in the upgrade cycle of transports where it can cause
// loss of data if you close the connection after writing data to it and it's
// still in an upgrade cycle of the client.
//
// @see https://github.com/Automattic/engine.io/pull/285
// @see https://github.com/Automattic/engine.io/issues/284
//
var Socket = require('engine.io/lib/socket');
Socket.prototype.maybeUpgrade = function (transport) {
  debug('might upgrade socket transport from "%s" to "%s"'
    , this.transport.name, transport.name);

  var self = this;

  // set transport upgrade timer
  self.upgradeTimeoutTimer = setTimeout(function () {
    debug('client did not complete upgrade - closing transport');
    clearInterval(self.checkIntervalTimer);
    self.checkIntervalTimer = null;
    if ('open' == transport.readyState) {
      transport.close();
    }
  }, this.server.upgradeTimeout);

  function onPacket(packet){
    if ('ping' == packet.type && 'probe' == packet.data) {
      transport.send([{ type: 'pong', data: 'probe' }]);
      clearInterval(self.checkIntervalTimer);
      self.checkIntervalTimer = setInterval(check, 100);
    } else if ('upgrade' == packet.type && self.readyState != 'closed') {
      debug('got upgrade packet - upgrading');
      self.upgraded = true;
      self.clearTransport();
      self.setTransport(transport);
      self.emit('upgrade', transport);
      self.setPingTimeout();
      self.flush();
      clearInterval(self.checkIntervalTimer);
      self.checkIntervalTimer = null;
      clearTimeout(self.upgradeTimeoutTimer);
      transport.removeListener('packet', onPacket);
      if (self.readyState == 'closing') {
        transport.close(function () {
          self.onClose('forced close');
        });
      }
    } else {
      transport.close();
    }
  }

  // we force a polling cycle to ensure a fast upgrade
  function check(){
    if ('polling' == self.transport.name && self.transport.writable) {
      debug('writing a noop packet to polling for fast upgrade');
      self.transport.send([{ type: 'noop' }]);
    }
  }

  transport.on('packet', onPacket);
};
