'use strict';

//
// lws only supports ABI version 46 and 47.
//
if (process.versions.modules === 46 || process.versions.modules === 47) {
  require('./transformer.base')('lws');
}
