import { RequestQueue } from "./RequestQueue.js";
import { Interval, TokenBucket, validateTokens } from "./TokenBucket.js";
import { getMilliseconds, wait } from "./clock.js";

export type RateLimiterOpts = {
  tokensPerInterval: number;
  interval: Interval;
  fireImmediately?: boolean;
};

/**
 * A generic rate limiter. Underneath the hood, this uses a token bucket plus
 * an additional check to limit how many tokens we can remove each interval.
 *
 * @param options
 * @param options.tokensPerInterval Maximum number of tokens that can be
 *  removed at any given moment and over the course of one interval.
 * @param options.interval The interval length in milliseconds, or as
 *  one of the following strings: 'second', 'minute', 'hour', day'.
 * @param options.fireImmediately Whether or not the promise will resolve
 *  immediately when rate limiting is in effect (default is false).
 */
export class RateLimiter {
  private readonly requests = new RequestQueue();
  tokenBucket: TokenBucket;
  curIntervalStart: number;
  tokensThisInterval: number;
  fireImmediately: boolean;

  constructor({ tokensPerInterval, interval, fireImmediately }: RateLimiterOpts) {
    this.tokenBucket = new TokenBucket({
      bucketSize: tokensPerInterval,
      tokensPerInterval,
      interval,
    });

    // Fill the token bucket to start
    this.tokenBucket.content = tokensPerInterval;

    this.curIntervalStart = getMilliseconds();
    this.tokensThisInterval = 0;
    this.fireImmediately = fireImmediately ?? false;
  }

  /**
   * Remove the requested number of tokens. If the rate limiter contains enough
   * tokens and we haven't spent too many tokens in this interval already, this
   * will happen immediately. Otherwise, the removal will happen when enough
   * tokens become available.
   * @param count The number of tokens to remove.
   * @returns A promise for the remainingTokens count.
   */
  async removeTokens(count: number): Promise<number> {
    validateTokens(count, "count");
    if (count > this.tokenBucket.bucketSize) {
      throw new RangeError(
        `Requested tokens ${count} exceeds maximum tokens per interval ${this.tokenBucket.bucketSize}`,
      );
    }
    if (this.fireImmediately) {
      return this.tryRemoveTokens(count) ? this.tokenBucket.content : -1;
    }
    return this.requests.run(async () => {
      while (true) {
        if (this.tryRemoveTokens(count)) return this.tokenBucket.content;
        await wait(this.getWaitTime(count));
      }
    });
  }

  /**
   * Attempt to remove the requested number of tokens and return immediately.
   * If the bucket (and any parent buckets) contains enough tokens and we
   * haven't spent too many tokens in this interval already, this will return
   * true. Otherwise, false is returned.
   * @param {Number} count The number of tokens to remove.
   * @param {Boolean} True if the tokens were successfully removed, otherwise
   *  false.
   */
  tryRemoveTokens(count: number): boolean {
    validateTokens(count, "count");
    // Make sure the request isn't for more than we can handle
    if (count > this.tokenBucket.bucketSize) return false;

    const now = getMilliseconds();

    // Advance the current interval and reset the current interval token count
    // if needed
    if (now < this.curIntervalStart || now - this.curIntervalStart >= this.tokenBucket.interval) {
      this.curIntervalStart = now;
      this.tokensThisInterval = 0;
    }

    // If we don't have enough tokens left in this interval, return false
    if (count > this.tokenBucket.tokensPerInterval - this.tokensThisInterval) return false;

    // Try to remove the requested number of tokens from the token bucket
    const removed = this.tokenBucket.tryRemoveTokens(count);
    if (removed) {
      this.tokensThisInterval += count;
    }
    return removed;
  }

  /**
   * Estimate milliseconds until count tokens can be removed, accounting for
   * both bucket refill and the interval allowance. Does not reserve tokens or
   * account for queued requests; competing removals can change the estimate.
   * Throws RangeError for invalid counts or requests exceeding capacity.
   */
  getWaitTime(count: number): number {
    validateTokens(count, "count");
    if (count > this.tokenBucket.bucketSize) {
      throw new RangeError(
        `Requested tokens ${count} exceeds maximum tokens per interval ${this.tokenBucket.bucketSize}`,
      );
    }
    const bucketDelay = this.tokenBucket.getWaitTime(count);
    const now = getMilliseconds();
    const intervalActive =
      now >= this.curIntervalStart && now - this.curIntervalStart < this.tokenBucket.interval;
    const intervalDelay =
      intervalActive && count > this.tokenBucket.tokensPerInterval - this.tokensThisInterval
        ? this.curIntervalStart + this.tokenBucket.interval - now
        : 0;
    return Math.max(0, Math.ceil(intervalDelay), bucketDelay);
  }

  /**
   * Returns the number of tokens remaining in the TokenBucket.
   * @returns {Number} The number of tokens remaining.
   */
  getTokensRemaining(): number {
    this.tokenBucket.drip();
    return this.tokenBucket.content;
  }
}
