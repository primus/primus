'use strict';

//
// Require all dependencies.
//
var pass = require('pwd');

//
// Dummy database.
//
var users = Object.create(null);

//
// Add a user for our example.
//
pass.hash('bar', function hash(err, salt, key) {
  if (err) throw err;

  users.foo = {
    key: key,
    salt: salt,
    username: 'foo'
  };
});

//
// Expose a function to get a user by username.
//
exports.getUser = function getUser(username) {
  return users[username];
};
