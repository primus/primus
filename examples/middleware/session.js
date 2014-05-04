'use strict';

var PrimusError = require('../../errors').PrimusError;

//
// Expose the configuration function.
//
module.exports = function configure(options) {
  var key = options.key || 'connect.sid'
    , store = options.store
    , primus = this;
  
  if (!store) {
    //
    // Throw an error when the session store is not passed. 
    //
    var message = 'Session middleware configuration failed due to missing '
      + '`store` option';
    throw new PrimusError(message, this);
  }

  //
  // The actual session middleware. This middleware is async so we need 3
  // arguments.
  //
  function session(req, res, next) {
    //
    // The session id is stored in the cookies.
    // `req.signedCookies` is assigned by the `cookie-parser` middleware.
    //
    var sid = req.signedCookies[key];

    //
    // Default to an empty session.
    //
    req.session = {};

    //
    // If we don't have a session id we are done.
    //
    if (!sid) return next();

    //
    // Grab the session from the store.
    //
    store.get(sid, function (err, session) {
      //
      // We don't want to kill the connection when we get an error from the
      // session store so we just log the error.
      //
      if (err) {
        primus.emit('log', 'error', err);
        return next();
      }

      if (session) req.session = session;

      return next();
    });
  }

  return session;
};
