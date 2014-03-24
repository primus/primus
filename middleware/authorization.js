'use strict';

/**
 * Authorization middleware for Primus which would accept or deny requests.
 *
 * @returns {Function}
 * @api public
 */
module.exports = function configuration() {
  /**
   * The actual HTTP middleware.
   *
   * @param {Request} req HTTP request.
   * @param {Response} res HTTP response.
   * @param {Function} next Continuation.
   * @api private
   */
  return function client(req, res, next) {
    if ('function' !== typeof this.auth) return next();

    this.auth(req, function authorized(err) {
      if (!err) return next();

      var message = JSON.stringify({ error: err.message || err })
        , length = Buffer.byteLength(message)
        , code = err.statusCode || 401;

      //
      // We need to handle two cases here, authentication for regular HTTP
      // requests as well as authentication of WebSocket (upgrade) requests.
      //
      if (res.setHeader) {
        res.statusCode = code;
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Length', length);

        if (code === 401 && err.authenticate) {
          res.setHeader('WWW-Authenticate', err.authenticate);
        }

        res.end(message);
      } else {
        res.write('HTTP/'+ req.httpVersion +' ');
        res.write(code +' '+ require('http').STATUS_CODES[code] +'\r\n');
        res.write('Connection: close\r\n');
        res.write('Content-Type: application/json\r\n');
        res.write('Content-Length: '+ length +'\r\n');

        if (code === 401 && err.authenticate) {
          res.write('WWW-Authenticate: ' + err.authenticate + '\r\n');
        }

        res.write('\r\n');
        res.write(message);
        res.destroy();
      }
    });
  };
};
