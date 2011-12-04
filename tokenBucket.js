
/**
 *
 */
var TokenBucket = function(bucketSize, tokensPerInterval, interval, parentBucket) {
  this.bucketSize = bucketSize;
  this.tokensPerInterval = tokensPerInterval;
  
  if (typeof interval === 'string') {
    switch (interval) {
      case 'sec': case 'second':
        this.interval = 1000; break;
      case 'min': case 'minute':
        this.interval = 1000 * 60; break;
      case 'hr': case 'hour':
        this.interval = 1000 * 60 * 60; break;
      case 'day':
        this.interval = 1000 * 60 * 60 * 24; break;
    }
  } else {
    this.interval = interval;
  }
  
  this.parentBucket = parentBucket;
  this.content = this.bucketSize;
  this.lastDrip = +new Date();
};

TokenBucket.prototype = {
  bucketSize: 1,
  tokensPerInterval: 1,
  interval: 1000,
  parentBucket: null,
  content: 0,
  lastDrip: 0,
  
  removeTokens: function(count, callback) {
    // Is this an infinite size bucket?
    if (!this.maxBurst) {
      callback(null, count, Number.POSITIVE_INFINITY);
      return true;
    }
    
    // Make sure the bucket can hold the requested number of tokens
    if (count > this.bucketSize) {
      callback('Requested tokens ' + count + ' exceeds bucket size ' +
        this.bucketSize, null);
      return false;
    }
    
    // Drip new tokens into this bucket
    this.drip();
    
    // If we don't have enough tokens in this bucket, come back later
    if (count > this.content) {
      // How long do we need to wait to make up the difference in tokens?
      var waitInterval = Math.ceil(
        (count - this.content) *(this.interval / this.tokensPerInterval));
      setTimeout(function() { removeTokens(count, callback); }, waitInterval);
      return false;
    }
    
    if (parent) {
      var self = this;
      
      // Remove the requested from the parent bucket first
      return parent.removeTokens(count, function(err, remainingTokens) {
        if (err) {
          callback(err, null);
          return;
        }
        
        // Tokens were removed from the parent bucket, now remove them from
        // this bucket and fire the callback
        self.content -= count;
        callback(null, self.content);
      })
    } else {
      // Remove the requested tokens from this bucket and fire the callback
      this.content -= count;
      callback(null, self.content);
      return true;
    }
  },
  
  /**
   * Add any new tokens to the bucket since the last drip.
   * @returns {boolean} True if new tokens were added, otherwise false.
   */
  drip: function() {
    if (!this.tokensPerInterval) {
      this.content = this.bucketSize;
      return;
    }
    
    var now = +new Date();
    var deltaMS = Math.max(now - this.lastDrip, 0);
    this.lastDrip = now;
    
    var dripAmount = deltaMS * (this.tokensPerInterval / this.interval);
    this.content = Math.min(this.content + dripAmount, maxBurst);
  }
};

module.exports = TokenBucket;
