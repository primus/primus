'use strict';

var access = require('access-control');

/**
 * Add Access-Control to each request.
 *
 * @returns {Function}
 * @api public
 */
module.exports = function configure() {
  var control = access(this.options);

  //
  // We don't add Access-Control headers for HTTP upgrades.
  //
  control.upgrade = false;

  return control;
};
