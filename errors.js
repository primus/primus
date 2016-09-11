'use strict';

var util = require('util');

/**
 * Generic Primus error.
 *
 * @constructor
 * @param {String} message The reason for the error
 * @param {EventEmitter} logger Optional EventEmitter to emit a `log` event on.
 * @api public
 */
function PrimusError(message, logger) {
  Error.captureStackTrace(this, this.constructor);

  this.message = message;
  this.name = this.constructor.name;

  if (logger) {
    logger.emit('log', 'error', this);
  }
}

util.inherits(PrimusError, Error);

/**
 * There was an error while parsing incoming or outgoing data.
 *
 * @param {String} message The reason for the error.
 * @param {Spark} spark The spark that caused the error.
 * @api public
 */
function ParserError(message, spark) {
  Error.captureStackTrace(this, this.constructor);

  this.message = message;
  this.name = this.constructor.name;

  if (spark) {
    if (spark.listeners('error').length) spark.emit('error', this);
    spark.primus.emit('log', 'error', this);
  }
}

util.inherits(ParserError, Error);

//
// Expose our custom events.
//
exports.PrimusError = PrimusError;
exports.ParserError = ParserError;
