
# limiter #

Provides a generic rate limiter for node.js. Useful for API clients, web 
crawling, or other tasks that need to be throttled. Two classes are exposed, 
RateLimiter and TokenBucket. TokenBucket provides a lower level interface to 
rate limiting with a configurable burst rate and drip rate. RateLimiter sits 
on top of the token bucket and adds a restriction on the maximum number of 
tokens that can be removed each interval to comply with common API 
restrictions like "150 requests per hour maximum".

## Installation ##

Use NPM to install:

    npm install limiter

## Usage ##

A simple example allowing 150 requests per hour:

    var RateLimiter = require('limiter').RateLimiter;
    // Allow 150 requests per hour (the Twitter search limit). Also understands
    // 'second', 'minute', 'day', or a number of milliseconds
    var limiter = new RateLimiter(150, 'hour');
    
    // Throttle requests
    limiter.removeTokens(1, function(err, remainingRequests) {
      // err will only be set if we request more than the maximum number of
      // requests we set in the constructor
      
      // remainingRequests tells us how many additional requests could be sent
      // right this moment
      
      callMyRequestSendingFunction(...);
    });

Another example allowing one message to be sent every 250ms:

    var RateLimiter = require('limiter').RateLimiter;
    var limiter = new RateLimiter(1, 250);
    
    limiter.removeTokens(1, function() {
      callMyMessageSendingFunction(...);
    });

Uses the token bucket directly to throttle at the byte level:

    var BURST_RATE = 1024 * 1024 * 150; // 150KB/sec burst rate
    var FILL_RATE = 1024 * 1024 * 50; // 50KB/sec sustained rate
    var TokenBucket = require('limiter').TokenBucket;
    // We could also pass a parent token bucket in as the last parameter to
    // create a hierarchical token bucket
    var bucket = new TokenBucket(BURST_RATE, FILL_RATE, 'second', null);
    
    bucket.removeTokens(myData.byteLength, function() {
      sendMyData(myData);
    });

## Additional Notes ##

Both the token bucket and rate limiter should be used with a message queue or 
some way of preventing multiple simultaneous calls to removeTokens(). 
Otherwise, earlier messages may get held up for long periods of time if more 
recent messages are continually draining the token bucket. This can lead to 
out of order messages or the appearance of "lost" messages under heavy load.

## Sponsors ##

* [cull.tv](http://cull.tv/) - New music television

## License ##

(The MIT License)

Copyright (c) 2011 Cull TV, Inc. &lt;jhurliman@cull.tv&gt;

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
