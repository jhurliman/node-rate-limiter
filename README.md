# limiter

![Build Status](https://github.com/jhurliman/node-rate-limiter/actions/workflows/ci.yml/badge.svg)
[![NPM Downloads](https://img.shields.io/npm/dm/limiter.svg?style=flat)](https://www.npmjs.com/package/limiter)

Provides a generic rate limiter for the web and node.js. Useful for API clients,
web crawling, or other tasks that need to be throttled. Two classes are exposed, 
RateLimiter and TokenBucket. TokenBucket provides a lower level interface to 
rate limiting with a configurable burst rate and drip rate. RateLimiter sits on
top of the token bucket and adds a restriction on the maximum number of tokens
that can be removed each interval to comply with common API restrictions such as
"150 requests per hour maximum".

## Installation

    yarn add limiter

## Upgrading from 3.x

Version 4 fixes concurrent accounting and waiting behavior. It keeps the existing
constructors, methods, CommonJS/ESM imports, and fractional-token support, but is
a major release because these observable behaviors change:

- Token counts and capacities must be finite, non-negative numbers no greater
  than `Number.MAX_SAFE_INTEGER`. Numeric intervals must be finite and positive.
  Invalid values now throw `RangeError`, or reject an asynchronous call. Validate
  configuration and handle rejected `removeTokens()` promises; do not use
  negative values, `NaN`, or `Infinity` as sentinels.
- Waiting `removeTokens()` calls on the same instance run in FIFO order. A large
  request at the front can delay smaller requests behind it. Synchronous calls
  and `fireImmediately` requests can still consume capacity ahead of the queue;
  children sharing a parent do not have a global FIFO order.
- Concurrent requests now respect the interval allowance and charge a hierarchy
  only once per successful removal. Workloads that previously exceeded their
  configured limits may wait longer or receive an immediate rejection signal.
- Remaining balances retain fractional millisecond timing precision. Avoid exact
  equality checks on fractional balances; use `tryRemoveTokens()` to check
  whether a request can proceed immediately.

Zero-value conventions are unchanged: a standalone `TokenBucket` with
`bucketSize: 0` is unlimited and bypasses parents; `tokensPerInterval: 0` refills
a finite bucket on every attempt. A `RateLimiter` with `tokensPerInterval: 0`
accepts only zero-token requests. These settings are not a general off switch.

See the [changelog](CHANGELOG.md) for the release history and
[Additional Notes](#additional-notes) for the full timing and queue semantics.

## Usage

A simple example allowing 150 requests per hour:

```javascript
import { RateLimiter } from "limiter";

// Allow 150 requests per hour. Also understands
// 'second', 'minute', 'day', or a number of milliseconds
const limiter = new RateLimiter({ tokensPerInterval: 150, interval: "hour" });

async function sendRequest() {
  // This call will throw if we request more than the maximum number of requests
  // that were set in the constructor
  // remainingRequests is the underlying bucket balance; the interval counter
  // may impose a lower allowance.
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

const BURST_CAPACITY = 1024 * 150; // 150 KiB maximum burst
const FILL_RATE = 1024 * 50; // 50 KiB per second sustained rate

// We could also pass a parent token bucket in to create a hierarchical token
// bucket
// bucketSize, tokensPerInterval, interval
const bucket = new TokenBucket({
  bucketSize: BURST_CAPACITY,
  tokensPerInterval: FILL_RATE,
  interval: "second"
});

async function handleData(myData) {
  await bucket.removeTokens(myData.byteLength);
  sendMyData(myData);
}
```

## Additional Notes

Waiting calls to `removeTokens()` are processed in FIFO order on each instance,
using one active timer per instance. Concurrent calls are supported. A request
is charged only when it can succeed; hierarchical buckets debit the child and
all parents together. Independent children sharing a parent do not have a global
FIFO order. `tryRemoveTokens()` and `fireImmediately` requests do not join the
waiting queue and may consume capacity ahead of waiting requests.

`RateLimiter` combines a continuously refilled token bucket with an interval
counter. Its interval starts at construction and resets on the first removal
attempt at or after the previous interval expires. It is **not** a rolling-window
limiter: traffic around an interval boundary can exceed the configured count in
a sliding window. It does not track when your asynchronous work finishes, and it
does not limit simultaneous in-flight operations. Use a concurrency limiter or
rolling-window algorithm separately when those are your requirements.

`getTokensRemaining()` reports the underlying bucket's balance (possibly
fractional), not the interval counter's remaining allowance. Use
`tryRemoveTokens()` to test whether a request can proceed immediately.

Token counts and capacities must be finite, non-negative numbers at most
`Number.MAX_SAFE_INTEGER`; fractional tokens are supported. Numeric intervals
must be finite and greater than zero. Invalid input throws `RangeError` (an
async call rejects). An oversized request returns `false` from `tryRemoveTokens()`
and rejects from `removeTokens()`. A standalone `TokenBucket` starts empty;
`RateLimiter` starts full. For compatibility, `bucketSize: 0` means unlimited
capacity and bypasses parents, and `tokensPerInterval: 0` refills a finite bucket
to capacity on every attempt. These zero values do **not** disable all traffic.
`RateLimiter` with `tokensPerInterval: 0` accepts only zero-token requests.

Timing uses a monotonic clock. Timers can run late when the event loop is busy;
availability is rechecked after every wait. Balances use JavaScript floating-point
numbers, so fractional results can have normal rounding error. State is local to
the instance and is not shared across processes, workers, or machines. Configure
instances at the scope of the resource you want to limit; creating a new limiter
for every request defeats a shared rate limit.

## License

MIT License
