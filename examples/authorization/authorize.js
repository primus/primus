'use strict';

//
// Require all dependencies.
//
var db = require('./db')
  , jwt = require('jwt-simple');

//
// The secret that we use to calculate and validate the signature of the JWT.
//
var secret = 'shhhh, very secret';

//
// Expose the authorization function.
//
module.exports = function authorize(req, authorized) {
  var token = req.query.token
    , error
    , payload;

  if (!token) {
    error = new Error('Missing access token');
    console.error(error.message);
    return authorized(error);
  }

  //
  // `jwt-simple` throws errors if something goes wrong when decoding the JWT.
  //
  try {
    payload = jwt.decode(token, secret);
  }
  catch (e) {
    console.error(e.message);
    return authorized(e);
  }

  //
  // At this point we have decoded and verified the token. Check if it is
  // expired.
  //
  if (Date.now() > payload.exp) {
    error = new Error('Expired access token');
    console.error(error.message);
    return authorized(error);
  }

  //
  // Check if the user is still present and allowed in our db. You could tweak
  // this to invalidate a token.
  //
  var user = db.getUser(payload.iss);
  if (!user || user.deauthorized) {
    error = new Error('Invalid access token');
    console.error(error.message);
    return authorized(error);
  }

  authorized();
};

//
// Expose the secret.
//
module.exports.secret = secret;
