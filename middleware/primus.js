'use strict';

/**
 * Serve the client library that is shipped and compiled within Primus.
 *
 * @returns {Function}
 * @api public
 */
module.exports = function configure() {
  var primusjs = this.pathname +'/primus.js'
    , primus = this
    , library
    , length;

  /**
   * The actual HTTP middleware.
   *
   * @param {Request} req HTTP request.
   * @param {Response} res HTTP response.
   * @api private
   */
  function client(req, res) {
    if (req.uri.pathname !== primusjs) return;

    //
    // Lazy include and compile the library so we give our server some time to
    // add plugins or we will compile the client library without plugins, which
    // is sad :(
    //
    library = library || new Buffer(primus.library());
    length = length || library.length;

    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
    res.setHeader('Content-Length', length);
    res.end(library);

    return true;
  }

  //
  // We don't serve our client-side library over HTTP upgrades.
  //
  client.upgrade = false;

  return client;
};
