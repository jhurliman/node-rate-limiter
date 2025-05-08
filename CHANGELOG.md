# Changelog

## [3.0.0] - 2025-01-24
### Added
- **Dual Module Support:** Distributed as both CommonJS and ES Module, with separate `package.json` files for each format (no need for custom transformers). This improves compatibility with modern bundlers and frameworks.

### Changed
- **Build and Dependencies:** Updated build pipeline and dependencies (Babel, TypeScript, Jest, ESLint, etc.) to latest versions. The library targets Node.js ES2019 syntax for broader runtime support.
- **Monotonic Timing:** Removed the `just-performance` dependency in favor of Node’s built-in high-resolution timers. Timing now relies on `process.hrtime`/`performance` APIs, ensuring monotonic behavior without external packages.

### Fixed
- **ESM Import Stability:** Resolved issues with ES Module imports. Consumers no longer need workarounds to import the ESM build. The removal of `"type": "module"` from the main package and the introduction of a dedicated ESM build fix the `ERR_MODULE_NOT_FOUND` and `Unexpected token` errors in Node 16+.

## [2.1.0] - 2021-05-19
### Added
- **Compatibility Improvements:** Incorporated changes to better support modern JavaScript environments. Internal logic now accommodates bundlers and strict ESM resolution.

### Changed
- **Build Target:** The TypeScript compiler target was lowered from ESNext to ES2019 for broader compatibility (avoiding syntax unsupported in older runtimes).
- **Internal Timer:** Upgraded internal timing by updating `just-performance` to v4.3.0, aligning with Node.js improvements.
- **Package Metadata:** Removed the `"type": "module"` field from **package.json** to treat the package as CommonJS by default. This change improves compatibility with Webpack 5 and others that encountered issues loading the library in 2.0.x.

### Fixed
- **Import Paths:** Fixed import statements by appending `.js` extensions where required for ESM compliance (no more “Cannot find module” errors when using ESM).
- **Bundler Support:** Addressed issues causing the library to break in certain build tools. After this release, the library works out-of-the-box with tools like Webpack (no manual polyfills needed).

## [2.0.1] - 2021-04-30
### Fixed
- **ESM Usage Bugs:** Patched minor issues following the 2.0.0 rewrite. Specifically, ensured that all internal module imports include file extensions (necessary for native ESM). This prevents runtime errors when using the library in ES Module mode.
- **Build Process:** Included small tweaks to the build output to better support both Node and browser fields (no user-facing API changes).

## [2.0.0] - 2021-04-28
### Added
- **TypeScript Rewrite:** Codebase fully rewritten in TypeScript for improved reliability and developer experience. Type definitions are now built-in, and the library provides its own `.d.ts` declarations.
- **Promise-based API:** Introduced Promise support for all asynchronous methods. Methods like `removeTokens` now return a Promise that resolves when tokens are removed (or rejects on error), allowing `async/await` usage.

### Changed
- **Breaking – Async API:** The callback-style API was replaced with a promise-based API. The `RateLimiter.removeTokens()` and related methods no longer accept Node-style callbacks. Instead, they return Promises. For example: `await limiter.removeTokens(5)` replaces the old `limiter.removeTokens(5, callback)`.
- **Breaking – Constructor:** The `RateLimiter` constructor signature changed. Instead of positional parameters, it now takes a single options object (e.g. `{ tokensPerInterval, interval, fireImmediately }`). This improves clarity but may require updates to existing initialization code.
- **Target Environment:** Dropped support for very old Node versions. The library now requires Node 10+ (due to using modern syntax and promises).

### Removed
- **Callback API:** Removed all deprecated callback parameters in favor of promises. Callbacks are no longer invoked or supported in any methods.
- **Legacy Build Artifacts:** Removed old UMD/Bundle files from the package. Module import should be done via the standard CommonJS or ESM entry points.

### Fixed
- **Consistency:** Ensured that rate limiting logic remains consistent after the rewrite. Extensive tests were added/updated to verify that the new Promise-based methods conform to the expected behavior and throw or resolve correctly under limit conditions.

## [1.1.5] - 2020-01-08
### Changed
- **Type Definitions Update:** Improved the bundled TypeScript definitions for the library. The community-contributed update (PR #62) refines the types for `RateLimiter` and `TokenBucket` to better reflect the library’s API and usage (e.g., marking asynchronous methods as returning Promises, etc.).
- **Maintenance:** Minor updates to development dependencies and build scripts (no impact on runtime). This was mainly a metadata/version bump release with no new features.

## [1.1.4] - 2019-01-14
### Fixed
- **`tryRequestTokens` Bug:** Fixed an error in the `tryRequestTokens` function (introduced in 1.1.3). The bug could cause exceptions or incorrect behavior when using `tryRemoveTokens`/`tryRequestTokens`. This release ensures that attempting to remove tokens without waiting works as intended without throwing errors.
- **TypeScript Definitions:** Included small fixes to the TypeScript declaration file to address inconsistencies. Types now correctly match the implemented API (e.g. marking optional fields, correct return types).

## [1.1.3] - 2018-04-17
### Added
- **Monotonic Clock Support:** Rate limiting now uses a monotonic clock for tracking intervals. Where available, the library uses `process.hrtime` instead of the system clock (`Date`). This prevents issues if the system time is changed (e.g., NTP adjustments).
- **Interval Validation:** The library now validates the `interval` option string. If an invalid interval string is provided, an error is thrown immediately (PR [#43](https://github.com/jhurliman/node-rate-limiter/pull/43)). This helps catch misconfigurations early.

### Fixed
- **System Clock Changes:** Fixed a bug in token bucket resetting when the system clock moves backwards (e.g., DST or manual time change). Now, if a backward time jump is detected, the current interval is reset to avoid unintended token accumulation or delays (PR [#48](https://github.com/jhurliman/node-rate-limiter/pull/48)).
- **Documentation:** Corrected and clarified documentation examples. For instance, an example for `remainingRequests` (in README) was updated to reflect the actual behavior (PR [#31](https://github.com/jhurliman/node-rate-limiter/pull/31)).

## [1.1.2] - 2017-06-24
### Added
- **Typings in Package:** The TypeScript declaration file (`index.d.ts`) is now included in the published package. This means TypeScript users get typings automatically when installing the package (PR [#40](https://github.com/jhurliman/node-rate-limiter/pull/40)). 

### Fixed
- **Missing Types**: Prior to this, the `.d.ts` file wasn’t packaged, causing TS consumers to have no types. This release fixes that by adding it to the **package.json** “files” whitelist.
- **Interval Type Allowance:** Ensured that the string values `"second"`, `"minute"`, `"hour"`, and `"day"` are accepted for the `interval` option everywhere. (These were documented before, but this release unified support across code and types).

## [1.1.1] - 2017-06-22
### Added
- **TypeScript Definitions:** Added official TypeScript type definitions for the library. The project now ships with an `index.d.ts` file describing the API, thanks to PR [#31](https://github.com/jhurliman/node-rate-limiter/pull/31) and [#39](https://github.com/jhurliman/node-rate-limiter/pull/39).

### Fixed
- **RateLimiter Accuracy:** Fixed an issue where `RateLimiter.tryRemoveTokens()` did not increment the internal `tokensThisInterval` counter. This bug could allow over-consuming tokens within a single interval. After this fix, token removal via `tryRemoveTokens` properly counts toward the per-interval limit.
- **Minor Corrections:** Small fixes to ensure consistency between the callback-based and sync token removal logic. (Functionality remains the same; these changes harden the internals after the 1.1.0 additions.)

## [1.1.0] - 2015-10-28
### Added
- **Bower Support:** Introduced a `bower.json` file for front-end usage. This allows the library to be installed via Bower for browser-based projects (no changes to core functionality). 
- **Badges and Metadata:** Added NPM badge and links in the README for convenience. While not affecting code, this made the project status more visible on GitHub.

### Changed
- **Callback Timing:** Callbacks are now invoked on the next tick (asynchronous defer) instead of immediately within token removal functions. This change (PR [#12](https://github.com/jhurliman/node-rate-limiter/pull/12)) prevents potential recursion and yields more predictable async behavior. Users relying on immediate callback execution should adjust to this slight delay (typically not breaking).
- **Maintenance:** General project maintenance updates (repository URLs, author info, etc.). For example, author contact was updated in package metadata.

## [1.0.5] - 2013-12-31
### Added
- **`tryRemoveTokens()` (Sync Removal):** Introduced a new synchronous method `tryRemoveTokens(count)` on both RateLimiter and TokenBucket. This method attempts to remove the requested number of tokens and returns immediately with a boolean indicating success or failure. It allows token checks/removals without using a callback.

### Fixed
- **Hierarchical Buckets:** Fixed a bug in nested token bucket scenarios. When a TokenBucket had a parent bucket, we now ensure the child bucket still has available tokens after the parent’s tokens are drained. This prevents a condition where a child bucket could erroneously allow a token removal despite the parent bucket being exhausted.

### Changed
- **Documentation:** Updated the README and JSDoc to document `tryRemoveTokens()` and its usage. Also clarified existing docs where necessary (no API changes besides the new method).

## [1.0.4] - 2013-08-02
### Fixed
- **Stale Token Count:** Resolved an issue with `RateLimiter.getTokensRemaining()`. It now calls `tokenBucket.drip()` before reporting the remaining tokens, so the returned count accounts for tokens added over time. Previously, under certain conditions, `getTokensRemaining()` could return an outdated number if no tokens had been removed recently (PR [#6](https://github.com/jhurliman/node-rate-limiter/pull/6)).

## [1.0.3] - 2013-03-20
### Added
- **`getTokensRemaining()` Method:** Added a new helper method `RateLimiter.getTokensRemaining()` to retrieve the number of tokens left in the current interval **outside** of the `removeTokens` callback. This allows users to check remaining capacity at any time (PR [#4](https://github.com/jhurliman/node-rate-limiter/pull/4) by @mluto).

### Changed
- **Documentation:** Updated README with an example of using `getTokensRemaining()` and general usage notes.

## [1.0.1] - 2013-02-26
### Added
- **Immediate Callback Option:** Added support for firing the callback immediately when rate limiting is in effect. A new boolean option `fireImmediately` can be passed to `RateLimiter` to have `removeTokens()` call the callback right away with a negative remaining count when the limit is exceeded. This allows the calling code to handle rate-limit events without waiting for the interval reset.

### Fixed
- **Interval Capping:** Ensured that `RateLimiter` will not allow more tokens to be removed in a given interval than the `tokensPerInterval` limit. Previously, under certain usage patterns, it was possible to schedule removals that exceeded the interval cap. The internal counter `tokensThisInterval` is now properly utilized to cap removals, preventing over-consumption within a single interval.

### Changed
- **Docs and Examples:** Updated documentation to include the `fireImmediately` option usage and clarified the behavior when the rate limit is reached (e.g., remaining tokens can be negative if `fireImmediately` is true).

## [1.0.0] - 2012-07-17
### Added
- **Initial Release:** Introduced the core functionality of the rate limiter.
  - **RateLimiter Class:** Provides generic token bucket rate limiting for arbitrary actions. Configure with `tokensPerInterval` (number of tokens) and `interval` (length of each interval, in ms or as `"second"`, `"minute"`, `"hour"`, `"day"`). Optionally, `fireImmediately` can be set to control callback timing.
  - **TokenBucket Class:** Lower-level utility supporting burst consumption and drip refill rates. Allows hierarchical token buckets (a bucket can have a parent bucket) to model complex rate limits (e.g., sub-limits within global limits).
- **Basic Functionality:** Ability to remove tokens from the bucket (async with a callback in this initial version) to enforce the limit. If insufficient tokens are available, the RateLimiter queues the request and processes it when tokens replenish.
- **Examples Provided:** The README includes examples for common use cases (e.g., “150 requests per hour” client and a rate-limited message sender) to help new users get started.

### Changed
- **Stability:** Marked as a stable 1.0.0 release following testing of core features. Prior 0.x versions are considered prototypes; 1.0.0 signals a stable API.

### Fixed
- **None:** (Initial release – any known issues from beta were resolved prior to 1.0.0.)
