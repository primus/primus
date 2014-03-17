'use strict';

/**
 * Answer HTTP requests with the server specification when requested.
 *
 * @returns {Function}
 * @api public
 */
module.exports = function configure() {
  var specification = this.pathname +'/spec';

  /**
   * The actual HTTP middleware.
   *
   * @param {Request} req HTTP request.
   * @param {Response} res HTTP response.
   * @api private
   */
  return function spec(req, res) {
    if (req.uri.pathname !== specification) return;

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(this.spec));

    return false;
  };
};
