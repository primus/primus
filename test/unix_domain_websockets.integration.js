'use strict';

before(function (done) {
  require('fs').mkdir('/tmp/primus', function (err) {
    if (err && (err.code === 'EEXIST')) {
      err = null;
    }
    done(err);
  });
});

require('./transformer.base')('WebSockets', '/tmp/primus/', 'UnixDomainWebSockets');
