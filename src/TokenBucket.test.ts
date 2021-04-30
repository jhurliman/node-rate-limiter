import { TokenBucket } from "./TokenBucket";
import { wait } from "./clock";

const TIMING_EPSILON = 10;

describe("TokenBucket", () => {
  describe("capacity 10, 1 per 100ms", () => {
    it("is initialized empty", () => {
      const bucket = new TokenBucket({ bucketSize: 10, tokensPerInterval: 1, interval: 100 });
      expect(bucket.bucketSize).toEqual(10);
      expect(bucket.tokensPerInterval).toEqual(1);
      expect(bucket.content).toEqual(0);
    });

    it("removing 10 tokens takes 1 second", async () => {
      const start = +new Date();
      const bucket = new TokenBucket({ bucketSize: 10, tokensPerInterval: 1, interval: 100 });
      const remainingTokens = await bucket.removeTokens(10);

      const duration = +new Date() - start;
      const diff = Math.abs(1000 - duration);
      expect(diff < TIMING_EPSILON);
      expect(remainingTokens).toEqual(0);
      expect(bucket.content).toEqual(0);
    });

    it("removing another 10 tokens takes 1 second", async () => {
      const bucket = new TokenBucket({ bucketSize: 10, tokensPerInterval: 1, interval: 100 });
      await bucket.removeTokens(10);

      const start = +new Date();
      const remainingTokens = await bucket.removeTokens(10);
      const duration = +new Date() - start;
      const diff = Math.abs(1000 - duration);
      expect(diff < TIMING_EPSILON);
      expect(remainingTokens).toEqual(0);
      expect(bucket.content).toEqual(0);
    });

    it("waiting 2 seconds gives us only 10 tokens", async () => {
      const bucket = new TokenBucket({ bucketSize: 10, tokensPerInterval: 1, interval: 100 });
      await wait(2000);
      const start = +new Date();
      const remainingTokens = await bucket.removeTokens(10);
      const duration = +new Date() - start;
      expect(duration < TIMING_EPSILON);
      expect(remainingTokens).toEqual(0);
    });

    it("removing 1 token takes 100ms", async () => {
      const bucket = new TokenBucket({ bucketSize: 10, tokensPerInterval: 1, interval: 100 });

      const start = +new Date();
      const remainingTokens = await bucket.removeTokens(1);
      const duration = +new Date() - start;
      const diff = Math.abs(100 - duration);
      expect(diff < TIMING_EPSILON);
      expect(remainingTokens).toBeLessThan(1);
    });
  });
});
