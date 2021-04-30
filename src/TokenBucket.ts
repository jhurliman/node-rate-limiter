import { getMilliseconds, wait } from "./clock";

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
  bucketSize: number;
  tokensPerInterval: number;
  interval: number;
  parentBucket?: TokenBucket;
  content: number;
  lastDrip: number;

  constructor({ bucketSize, tokensPerInterval, interval, parentBucket }: TokenBucketOpts) {
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
    // Is this an infinite size bucket?
    if (this.bucketSize === 0) {
      return Number.POSITIVE_INFINITY;
    }

    // Make sure the bucket can hold the requested number of tokens
    if (count > this.bucketSize) {
      throw new Error(`Requested tokens ${count} exceeds bucket size ${this.bucketSize}`);
    }

    // Drip new tokens into this bucket
    this.drip();

    const comeBackLater = async () => {
      // How long do we need to wait to make up the difference in tokens?
      const waitMs = Math.ceil((count - this.content) * (this.interval / this.tokensPerInterval));
      await wait(waitMs);
      return this.removeTokens(count);
    };

    // If we don't have enough tokens in this bucket, come back later
    if (count > this.content) return comeBackLater();

    if (this.parentBucket != undefined) {
      // Remove the requested from the parent bucket first
      const remainingTokens = await this.parentBucket.removeTokens(count);

      // Check that we still have enough tokens in this bucket
      if (count > this.content) return comeBackLater();

      // Tokens were removed from the parent bucket, now remove them from
      // this bucket. Note that we look at the current bucket and parent
      // bucket's remaining tokens and return the smaller of the two values
      this.content -= count;

      return Math.min(remainingTokens, this.content);
    } else {
      // Remove the requested tokens from this bucket
      this.content -= count;
      return this.content;
    }
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
    // Is this an infinite size bucket?
    if (!this.bucketSize) return true;

    // Make sure the bucket can hold the requested number of tokens
    if (count > this.bucketSize) return false;

    // Drip new tokens into this bucket
    this.drip();

    // If we don't have enough tokens in this bucket, return false
    if (count > this.content) return false;

    // Try to remove the requested tokens from the parent bucket
    if (this.parentBucket && !this.parentBucket.tryRemoveTokens(count)) return false;

    // Remove the requested tokens from this bucket and return
    this.content -= count;
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

    const dripAmount = deltaMS * (this.tokensPerInterval / this.interval);
    const prevContent = this.content;
    this.content = Math.min(this.content + dripAmount, this.bucketSize);
    return Math.floor(this.content) > Math.floor(prevContent);
  }
}
