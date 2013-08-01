'use strict';

/**
 * List of possible proxy headers that should be checked for the original client
 * IP address and forwarded port.
 *
 * @type {Array}
 * @private
 */
var proxies = [
  {
    ip: 'x-forwarded-for',
    port: 'x-forwarded-port',
    proto: 'x-forwarded-proto'
  }, {
    ip: 'z-forwarded-for',
    port: 'z-forwarded-port',   // Estimated guess, no standard header available.
    proto: 'z-forwarded-proto'  // Estimated guess, no standard header available.
  }, {
    ip: 'forwarded',
    port: 'forwarded-port',
    proto: 'forwarded-proto'    // Estimated guess, no standard header available.
  }, {
    ip: 'x-real-ip',
    port: 'x-real-port'         // Estimated guess, no standard header available.
  }
];

/**
 * Default IP address and port that should be returned when don't find any
 * (valid) matches.
 *
 * @type {Object}
 * @private
 */
var defaults = {
  ip: '127.0.0.1',
  port: 0
};

/**
 * Search the headers for a possible match against a known proxy header.
 *
 * @param {Object} headers The received HTTP headers.
 * @returns {String|Undefined} A IP address or nothing.
 * @api private
 */
function forwarded(headers) {
  for (var i = 0, length = proxies.length; i < length; i++) {
    if (!(proxies[i].ip in headers)) continue;

    //
    // We've gotten a match on a HTTP header, we need to parse it further as it
    // could consist of multiple hops. The pattern for multiple hops is:
    //
    //   client, proxy, proxy, proxy, etc.
    //
    // So extracting the first IP should be sufficient.
    //
    return {
      port: +(headers[proxies[i].port] || '').split(',').shift() || defaults.port,
      ip: (headers[proxies[i].ip] || '').split(',').shift() || defaults.ip
    };
  }
}

/**
 * Parse out the address information..
 *
 * @param {Object} obj A socket like object that could contain a `remoteAddress`.
 * @param {Object} headers The received HTTP headers.
 * @returns {String} The IP address.
 * @api private
 */
function parse(obj, headers) {
  var proxied = forwarded(headers)
    , connection = obj.connection
    , socket = connection
      ? connection.socket
      : obj.socket;

  //
  // We should always be testing for HTTP headers as remoteAddress would point
  // to proxies.
  //
  if (proxied) return proxied;

  // Check for the property on our given object.
  if ('remoteAddress' in obj) return {
    port: +obj.remotePort || defaults.port,
    ip: obj.remoteAddress || defaults.ip
  };

  // Edge case for Socket.IO and SockJS
  if ('address' in obj && 'port' in obj) return {
    port: +obj.port || defaults.port,
    ip: obj.address || defaults.ip
  };

  if (connection && 'remoteAddress' in connection) return {
    port: +connection.remotePort || defaults.port,
    ip: connection.remoteAddress || defaults.ip
  };

  if (socket && 'remoteAddress' in socket) return {
    port: +socket.remotePort || defaults.port,
    ip: socket.remoteAddress || defaults.ip
  };

  return defaults;
}

//
// Expose the module.
//
module.exports = parse;
