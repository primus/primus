'use strict';

var setHeader = require('setheader');

/**
 * Forcefully add no-cache headers to HTTP responses.
 *
 * @param {Request} req The incoming HTTP request.
 * @param {Response} res The outgoing HTTP response.
 * @api public
 */
function nocache(req, res) {
  setHeader(res, 'Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  setHeader(res, 'Pragma', 'no-cache');
}

//
// We don't need no-cache headers for HTTP upgrades.
//
nocache.upgrade = false;

//
// Expose the module.
//
module.exports = nocache;
