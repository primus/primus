'use strict';

//
// Require all dependencies.
//
var authorize = require('../authorize')
  , db = require('../db')
  , jwt = require('jwt-simple')
  , pass = require('pwd');

//
// Handle authentication requests.
//
exports.login = function login(req, res) {
  //
  // For simplicity we don't validate received data here.
  //
  var user = db.getUser(req.body.username);

  if (!user) return res.status(401).send({ message: 'Bad credentials' });

  //
  // Check user's password and if it is correct return an authorization token.
  //
  pass.hash(req.body.password, user.salt, function hash(err, key) {
    if (err) {
      console.error(err);
      return res.status(500).send({ message: 'Internal error' });
    }

    if (user.key !== key) return res.status(401).send({ message: 'Bad credentials' });

    var timestamp = Date.now();

    //
    // Create a JSON Web Token.
    //
    var token = jwt.encode({
      exp: timestamp + 10 * 60 * 1000, // Expiration Time.
      iat: timestamp,                  // Issued at.
      iss: user.username               // Issuer.
    }, authorize.secret);

    res.send({ token: token });
  });
};
