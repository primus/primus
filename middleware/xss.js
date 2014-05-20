'use strict';

var setHeader = require('setheader');

/**
 * Forcefully add x-xss-protection headers.
 *
 * @param {Request} req The incoming HTTP request.
 * @param {Response} res The outgoing HTTP response.
 * @api public
 */
function xss(req, res) {
  var agent = (req.headers['user-agent'] || '').toLowerCase();

  if (agent && (~agent.indexOf(';msie') || ~agent.indexOf('trident/'))) {
    setHeader(res, 'X-XSS-Protection', '0');
  }
}

//
// We don't need protection headers for HTTP upgrades.
//
xss.upgrade = false;

//
// Expose the module.
//
module.exports = xss;
