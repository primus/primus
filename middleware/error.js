'use strict';

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
  var message = JSON.stringify({ error: err.message || err })
    , length = Buffer.byteLength(message)
    , code = err.statusCode || 500;

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

  res.write('HTTP/'+ req.httpVersion +' ');
  res.write(code +' '+ require('http').STATUS_CODES[code] +'\r\n');
  res.write('Connection: close\r\n');
  res.write('Content-Type: application/json\r\n');
  res.write('Content-Length: '+ length +'\r\n');
  res.write('\r\n');
  res.write(message);
  res.destroy();
};
