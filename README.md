# limiter

[![Build Status](https://travis-ci.org/jhurliman/node-rate-limiter.png)](https://travis-ci.org/jhurliman/node-rate-limiter)
[![NPM Downloads](https://img.shields.io/npm/dm/limiter.svg?style=flat)](https://www.npmjs.com/package/limiter)

Provides a generic rate limiter for the web and node.js. Useful for API clients,
web crawling, or other tasks that need to be throttled. Two classes are exposed, 
RateLimiter and TokenBucket. TokenBucket provides a lower level interface to 
rate limiting with a configurable burst rate and drip rate. RateLimiter sits on
top of the token bucket and adds a restriction on the maximum number of tokens
that can be removed each interval to comply with common API restrictions such as
"150 requests per hour maximum".

## Installation

    yarn install limiter

## Usage

A simple example allowing 150 requests per hour:

```javascript
import { RateLimiter } from "limiter";

// Allow 150 requests per hour (the Twitter search limit). Also understands
// 'second', 'minute', 'day', or a number of milliseconds
const limiter = new RateLimiter({ tokensPerInterval: 150, interval: "hour" });

async function sendRequest() {
  // This call will throw if we request more than the maximum number of requests
  // that were set in the constructor
  // remainingRequests tells us how many additional requests could be sent
  // right this moment
  const remainingRequests = await limiter.removeTokens(1);
  callMyRequestSendingFunction(...);
}
```

Another example allowing one message to be sent every 250ms:

```javascript
import { RateLimiter } from "limiter";

const limiter = new RateLimiter({ tokensPerInterval: 1, interval: 250 });

async function sendMessage() {
  const remainingMessages = await limiter.removeTokens(1);
  callMyMessageSendingFunction(...);
}
```

The default behaviour is to wait for the duration of the rate limiting that's
currently in effect before the promise is resolved, but if you pass in
`"fireImmediately": true`, the promise will be resolved immediately with
`remainingRequests` set to -1:

```javascript
import { RateLimiter } from "limiter";

const limiter = new RateLimiter({
  tokensPerInterval: 150,
  interval: "hour",
  fireImmediately: true
});

async function requestHandler(request, response) {
  // Immediately send 429 header to client when rate limiting is in effect
  const remainingRequests = await limiter.removeTokens(1);
  if (remainingRequests < 0) {
    response.writeHead(429, {'Content-Type': 'text/plain;charset=UTF-8'});
    response.end('429 Too Many Requests - your IP is being rate limited');
  } else {
    callMyMessageSendingFunction(...);
  }
}
```

A synchronous method, tryRemoveTokens(), is available in both RateLimiter and
TokenBucket. This will return immediately with a boolean value indicating if the
token removal was successful.

```javascript
import { RateLimiter } from "limiter";

const limiter = new RateLimiter({ tokensPerInterval: 10, interval: "second" });

if (limiter.tryRemoveTokens(5))
  console.log('Tokens removed');
else
  console.log('No tokens removed');
```

To get the number of remaining tokens **outside** the `removeTokens` promise,
simply use the `getTokensRemaining` method.

```javascript
import { RateLimiter } from "limiter";

const limiter = new RateLimiter({ tokensPerInterval: 1, interval: 250 });

// Prints 1 since we did not remove a token and our number of tokens per
// interval is 1
console.log(limiter.getTokensRemaining());
```

Using the token bucket directly to throttle at the byte level:

```javascript
import { TokenBucket } from "limiter";

const BURST_RATE = 1024 * 1024 * 150; // 150KB/sec burst rate
const FILL_RATE = 1024 * 1024 * 50; // 50KB/sec sustained rate

// We could also pass a parent token bucket in to create a hierarchical token
// bucket
// bucketSize, tokensPerInterval, interval
const bucket = new TokenBucket({
  bucketSize: BURST_RATE,
  tokensPerInterval: FILL_RATE,
  interval: "second"
});

async function handleData(myData) {
  await bucket.removeTokens(myData.byteLength);
  sendMyData(myData);
}
```

## Additional Notes

Both the token bucket and rate limiter should be used with a message queue or 
some way of preventing multiple simultaneous calls to removeTokens(). 
Otherwise, earlier messages may get held up for long periods of time if more 
recent messages are continually draining the token bucket. This can lead to 
out of order messages or the appearance of "lost" messages under heavy load.

## License

MIT License
