'use strict';

// lws do only support ABI version 46+
if (process.versions.modules >= 46) {
  require('./transformer.base')('lws');
}
