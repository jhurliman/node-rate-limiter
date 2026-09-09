import { RequestQueue } from "./RequestQueue.js";
import { getMilliseconds, wait } from "./clock.js";

export type Interval = number | "second" | "sec" | "minute" | "min" | "hour" | "hr" | "day";

export type TokenBucketOpts = {
  bucketSize: number;
  tokensPerInterval: number;
  interval: Interval;
  parentBucket?: TokenBucket;
};

/**
 * A hierarchical token bucket for rate limiting. See
 * http://en.wikipedia.org/wiki/Token_bucket for more information.
 *
 * @param options
 * @param options.bucketSize Maximum number of tokens to hold in the bucket.
 *  Also known as the burst rate.
 * @param options.tokensPerInterval Number of tokens to drip into the bucket
 *  over the course of one interval.
 * @param options.interval The interval length in milliseconds, or as
 *  one of the following strings: 'second', 'minute', 'hour', day'.
 * @param options.parentBucket Optional. A token bucket that will act as
 *  the parent of this bucket.
 */
export class TokenBucket {
  private readonly requests = new RequestQueue();
  bucketSize: number;
  tokensPerInterval: number;
  interval: number;
  parentBucket?: TokenBucket;
  content: number;
  lastDrip: number;

  constructor({ bucketSize, tokensPerInterval, interval, parentBucket }: TokenBucketOpts) {
    validateTokens(bucketSize, "bucketSize");
    validateTokens(tokensPerInterval, "tokensPerInterval");
    this.bucketSize = bucketSize;
    this.tokensPerInterval = tokensPerInterval;

    if (typeof interval === "string") {
      switch (interval) {
        case "sec":
        case "second":
          this.interval = 1000;
          break;
        case "min":
        case "minute":
          this.interval = 1000 * 60;
          break;
        case "hr":
        case "hour":
          this.interval = 1000 * 60 * 60;
          break;
        case "day":
          this.interval = 1000 * 60 * 60 * 24;
          break;
        default:
          throw new Error("Invalid interval " + interval);
      }
    } else {
      this.interval = interval;
    }

    if (!Number.isFinite(this.interval) || this.interval <= 0) {
      throw new RangeError("interval must be a finite positive number of milliseconds");
    }
    this.parentBucket = parentBucket;
    this.content = 0;
    this.lastDrip = getMilliseconds();
  }

  /**
   * Remove the requested number of tokens. If the bucket (and any parent
   * buckets) contains enough tokens this will happen immediately. Otherwise,
   * the removal will happen when enough tokens become available.
   * @param count The number of tokens to remove.
   * @returns A promise for the remainingTokens count.
   */
  async removeTokens(count: number): Promise<number> {
    validateTokens(count, "count");
    this.getWaitTime(count);
    return this.requests.run(async () => {
      while (true) {
        if (this.tryRemoveTokens(count)) return this.remainingTokens();
        await wait(Math.max(1, this.getWaitTime(count)));
      }
    });
  }

  /** Return the wait required by this bucket and all of its ancestors. */
  getWaitTime(count: number): number {
    validateTokens(count, "count");
    let delay = 0;
    for (const bucket of hierarchy(this)) {
      if (count > bucket.bucketSize) {
        throw new RangeError(`Requested tokens ${count} exceeds bucket size ${bucket.bucketSize}`);
      }
      bucket.drip();
      if (count > bucket.content) {
        delay = Math.max(
          delay,
          Math.ceil((count - bucket.content) / (bucket.tokensPerInterval / bucket.interval)),
        );
      }
    }
    return delay;
  }

  private remainingTokens(): number {
    if (!this.parentBucket) return this.bucketSize === 0 ? Number.POSITIVE_INFINITY : this.content;
    let remaining = Number.POSITIVE_INFINITY;
    for (const bucket of hierarchy(this)) {
      remaining = Math.min(remaining, bucket.content);
    }
    return remaining;
  }

  /**
   * Attempt to remove the requested number of tokens and return immediately.
   * If the bucket (and any parent buckets) contains enough tokens this will
   * return true, otherwise false is returned.
   * @param {Number} count The number of tokens to remove.
   * @param {Boolean} True if the tokens were successfully removed, otherwise
   *  false.
   */
  tryRemoveTokens(count: number): boolean {
    validateTokens(count, "count");
    // Check the whole hierarchy before charging any bucket. No await may occur
    // between this check and the debit: competing callers must see the debit.
    if (this.bucketSize === 0) return true;
    if (!this.parentBucket) {
      if (count > this.bucketSize) return false;
      this.drip();
      if (count > this.content) return false;
      this.content -= count;
      return true;
    }
    const buckets = hierarchy(this);
    for (const bucket of buckets) {
      if (count > bucket.bucketSize) return false;
      bucket.drip();
      if (count > bucket.content) return false;
    }
    for (const bucket of buckets) bucket.content -= count;
    return true;
  }

  /**
   * Add any new tokens to the bucket since the last drip.
   * @returns {Boolean} True if new tokens were added, otherwise false.
   */
  drip(): boolean {
    if (this.tokensPerInterval === 0) {
      const prevContent = this.content;
      this.content = this.bucketSize;
      return this.content > prevContent;
    }

    const now = getMilliseconds();
    const deltaMS = Math.max(now - this.lastDrip, 0);
    this.lastDrip = now;

    // An extremely short interval can overflow the rate even though both
    // inputs are finite. In particular, 0 * Infinity would poison the bucket.
    const rate = this.tokensPerInterval / this.interval;
    const dripAmount = Number.isFinite(rate)
      ? deltaMS * rate
      : (deltaMS * this.tokensPerInterval) / this.interval;
    const prevContent = this.content;
    this.content = Math.min(this.content + dripAmount, this.bucketSize);
    return Math.floor(this.content) > Math.floor(prevContent);
  }
}

export function validateTokens(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0 || value > Number.MAX_SAFE_INTEGER) {
    throw new RangeError(
      `${name} must be a finite non-negative number no greater than Number.MAX_SAFE_INTEGER`,
    );
  }
}

function hierarchy(start: TokenBucket): TokenBucket[] {
  const buckets: TokenBucket[] = [];
  const visited = new Set<TokenBucket>();
  for (
    let bucket: TokenBucket | undefined = start;
    bucket && bucket.bucketSize !== 0;
    bucket = bucket.parentBucket
  ) {
    if (visited.has(bucket)) throw new Error("Circular parentBucket hierarchy");
    visited.add(bucket);
    buckets.push(bucket);
  }
  return buckets;
}
