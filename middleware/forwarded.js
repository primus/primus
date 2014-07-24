'use strict';

var forwarded = require('forwarded-for');

/**
 * Add the `forwarded` property.
 *
 * @param {Request} req HTTP request.
 * @param {Response} res HTTP response.
 * @api private
 */
module.exports = function configure() {
  var primus = this;

  return function ipaddress(req, res) {
    req.forwarded = forwarded(req, req.headers || {}, primus.whitelist);
  };
};
