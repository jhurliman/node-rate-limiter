var TokenBucket = require('./tokenBucket');

/**
 * A generic rate limiter. Underneath the hood, this uses a token bucket plus
 * an additional check to limit how many tokens we can remove each interval.
 * @author John Hurliman <jhurliman@jhurliman.org>
 *
 * @param {Number} tokensPerInterval Maximum number of tokens that can be
 *  removed at any given moment and over the course of one interval.
 * @param {String|Number} interval The interval length in milliseconds, or as
 *  one of the following strings: 'second', 'minute', 'hour', day'.
 * @param {Boolean} fireImmediately Optional. Whether or not the callback
 *  will fire immediately when rate limiting is in effect (default is false).
 */
var RateLimiter = function(tokensPerInterval, interval, fireImmediately) {
  this.tokenBucket = new TokenBucket(tokensPerInterval, tokensPerInterval,
    interval, null);
  
  // Fill the token bucket to start
  this.tokenBucket.content = tokensPerInterval;
  
  this.curIntervalStart = +new Date();
  this.tokensThisInterval = 0;
  this.fireImmediately = fireImmediately;
};

RateLimiter.prototype = {
  tokenBucket: null,
  curIntervalStart: 0,
  tokensThisInterval: 0,
  fireImmediately: false,
  
  /**
   * Remove the requested number of tokens and fire the given callback. If the
   * rate limiter contains enough tokens and we haven't spent too many tokens
   * in this interval already, this will happen immediately. Otherwise, the
   * removal and callback will happen when enough tokens become available.
   * @param {Number} count The number of tokens to remove.
   * @param {Function} callback(err, remainingTokens)
   * @returns {Boolean} True if the callback was fired immediately, otherwise
   *  false.
   */
  removeTokens: function(count, callback) {
    // Make sure the request isn't for more than we can handle
    if (count > this.tokenBucket.bucketSize) {
      callback('Requested tokens ' + count +
        ' exceeds maximum tokens per interval ' + this.tokenBucket.bucketSize,
        null);
      return false;
    }
    
    var self = this;
    var now = +new Date();
    
    // Advance the current interval and reset the current interval token count
    // if needed
    if (now - this.curIntervalStart >= this.tokenBucket.interval) {
      this.curIntervalStart = now;
      this.tokensThisInterval = 0;
    }
    
    // If we don't have enough tokens left in this interval, wait until the
    // next interval
    if (count > this.tokenBucket.tokensPerInterval - this.tokensThisInterval) {
      if (this.fireImmediately) {
        callback(null, -1);
      } else {
        var waitInterval = Math.ceil(
          this.curIntervalStart + this.tokenBucket.interval - now);

        setTimeout(function() {
          self.tokenBucket.removeTokens(count, afterTokensRemoved);
        }, waitInterval);
      }
      return false;
    }
    
    // Remove the requested number of tokens from the token bucket
    return this.tokenBucket.removeTokens(count, afterTokensRemoved);

    function afterTokensRemoved(err, tokensRemaining) {
      if (err) return callback(err, null);

      self.tokensThisInterval += count;
      callback(null, tokensRemaining);
    }
  },

  /**
   * Returns the number of tokens remaining in the TokenBucket.
   * @returns {Number} The number of tokens remaining.
   */
  getTokensRemaining: function () {
    this.tokenBucket.drip();
    return this.tokenBucket.content;
  }
};

module.exports = RateLimiter;
