# limiter

[![CI](https://github.com/jhurliman/node-rate-limiter/actions/workflows/ci.yml/badge.svg)](https://github.com/jhurliman/node-rate-limiter/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/limiter.svg)](https://www.npmjs.com/package/limiter)

Control when work starts in Node.js and browsers. **limiter** provides an
interval rate limiter and a hierarchical token bucket, with Promise-based
waiting, synchronous admission checks, and no runtime dependencies.

Use it to pace API calls, throttle messages, or budget bytes. Waiting requests
run in FIFO order on each instance with one active timer, even with thousands
of callers. CommonJS, ES modules, and TypeScript declarations are included.

| Choose | When you need |
| --- | --- |
| `RateLimiter` | A maximum token count per interval, with continuous refill underneath |
| `TokenBucket` | Separate burst capacity and refill rate, optionally shared through parent buckets |

## Install

```sh
npm install limiter
```

## Pace work

Save as `example.mjs` and run `node example.mjs`. The first message starts
immediately; subsequent messages start at least 250 ms apart.

```js
import { RateLimiter } from "limiter";

const limiter = new RateLimiter({ tokensPerInterval: 1, interval: 250 });

await Promise.all(["first", "second", "third"].map(async (message) => {
  await limiter.removeTokens(1);
  console.log(message);
}));
```

For CommonJS, use `const { RateLimiter, TokenBucket } = require("limiter")`.
Create and reuse a limiter for each resource whose budget should be shared.
Each token represents an application-defined unit: a request, a message, a byte,
or a fractional cost. Work starts after `removeTokens()` resolves.

## Reject instead of waiting

`tryRemoveTokens()` atomically checks capacity and consumes tokens on success.
This complete HTTP example applies one shared budget to all incoming requests:

```js
import { createServer } from "node:http";
import { RateLimiter } from "limiter";

const limiter = new RateLimiter({ tokensPerInterval: 10, interval: "second" });

createServer((request, response) => {
  if (!limiter.tryRemoveTokens(1)) {
    const seconds = Math.max(1, Math.ceil(limiter.getWaitTime(1) / 1000));
    response.writeHead(429, { "Retry-After": String(seconds) });
    response.end("Too many requests\n");
    return;
  }
  response.end("Accepted\n");
}).listen(3000);
```

`getWaitTime(count)` returns an estimated delay in **milliseconds** without
consuming tokens. On `RateLimiter` it accounts for both refill and the interval
allowance. It returns zero when capacity is currently available. This
`RateLimiter` helper is new in 4.1; `TokenBucket.getWaitTime()` is available in 4.0.

For the Promise API with immediate rejection signaling, construct a limiter with
`fireImmediately: true`: `removeTokens()` resolves to `-1` when denied, otherwise
to the remaining bucket balance. Invalid inputs still reject the promise.

## Budget bytes and bursts

A standalone bucket starts empty and refills as time passes. This example
allows a 150 KiB burst after enough idle time and refills at 50 KiB per second:

```js
import { TokenBucket } from "limiter";

const bucket = new TokenBucket({
  bucketSize: 150 * 1024,
  tokensPerInterval: 50 * 1024,
  interval: "second"
});

const chunks = [new Uint8Array(1024), new Uint8Array(2048)];
for (const chunk of chunks) {
  await bucket.removeTokens(chunk.byteLength);
  console.log(`Ready to send ${chunk.byteLength} bytes`);
}
```

Split any chunk larger than `bucketSize` before requesting tokens. To share a
budget, pass another `TokenBucket` as `parentBucket`. A successful removal charges
the child and every finite ancestor together; a failed attempt charges none.

## API at a glance

| API | Result |
| --- | --- |
| `new RateLimiter({ tokensPerInterval, interval, fireImmediately? })` | A full bucket plus an interval allowance |
| `new TokenBucket({ bucketSize, tokensPerInterval, interval, parentBucket? })` | An empty bucket with independent burst and refill settings |
| `removeTokens(count)` | `Promise<number>`: wait, consume, and return remaining balance |
| `tryRemoveTokens(count)` | `boolean`: consume immediately if possible |
| `getWaitTime(count)` | Estimated milliseconds until capacity is available; never consumes tokens |
| `RateLimiter.getTokensRemaining()` | Underlying bucket balance, which can exceed the current interval allowance |

Intervals accept positive milliseconds or `"second"`, `"minute"`, `"hour"`, and
`"day"` (also `"sec"`, `"min"`, and `"hr"`). Token amounts may be fractional.
Always handle rejected promises for invalid or oversized requests.

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
`getWaitTime(count)` for a non-consuming cooldown estimate, or
`tryRemoveTokens(count)` to check and consume in one step. Estimates ignore
queued requests and are not reservations; other calls can change availability.

Awaiting two independent rate limiters in sequence does not atomically enforce
both limits at the eventual work start: work can collect behind the second
limiter. For atomic burst and sustained-rate budgets, use parent/child
`TokenBucket` instances. Those implement token-bucket limits, not rolling windows.

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

## Development

```sh
yarn install --frozen-lockfile
yarn lint:ci
yarn test
yarn prepack
```

CI checks the source and both module distributions. Tests cover concurrent
accounting, hierarchical buckets, FIFO backlogs, timing boundaries, and invalid
inputs using deterministic clocks.

## License

[MIT](LICENSE.txt).
