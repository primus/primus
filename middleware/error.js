'use strict';

const http = require('http');

/**
 * WARNING: this middleware is only used internally and does not follow the
 * pattern of the other middleware. You should not use it.
 *
 * Handle async middleware errors.
 *
 * @param {Error} err Error returned by the middleware.
 * @param {Request} req HTTP request.
 * @param {Response} res HTTP response.
 * @api private
 */
module.exports = function error(err, req, res) {
  const message = JSON.stringify({ error: err.message || err });
  const length = Buffer.byteLength(message);
  const code = err.statusCode || 500;

  //
  // As in the authorization middleware we need to handle two cases here:
  // regular HTTP requests and upgrade requests.
  //
  if (res.setHeader) {
    res.statusCode = code;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Length', length);

    return res.end(message);
  }

  res.write(
    `HTTP/${req.httpVersion} ${code} ${http.STATUS_CODES[code]}\r\n` +
      'Connection: close\r\n' +
      'Content-Type: application/json\r\n' +
      `Content-Length: ${length}\r\n\r\n` +
      message
  );
  res.destroy();
};
