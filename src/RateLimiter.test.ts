import { RateLimiter } from "./RateLimiter";
import { Interval } from "./TokenBucket";

describe("RateLimiter", () => {
  describe("interval validation", () => {
    it("invalid interval", () => {
      const junkInterval = ("junk" as unknown) as Interval;
      expect(() => new RateLimiter({ tokensPerInterval: 1, interval: junkInterval })).toThrow();
    });

    it("valid intervals", () => {
      expect(() => new RateLimiter({ tokensPerInterval: 1, interval: "sec" })).not.toThrow();
      expect(() => new RateLimiter({ tokensPerInterval: 1, interval: "second" })).not.toThrow();
      expect(() => new RateLimiter({ tokensPerInterval: 1, interval: "min" })).not.toThrow();
      expect(() => new RateLimiter({ tokensPerInterval: 1, interval: "minute" })).not.toThrow();
      expect(() => new RateLimiter({ tokensPerInterval: 1, interval: "hr" })).not.toThrow();
      expect(() => new RateLimiter({ tokensPerInterval: 1, interval: "hour" })).not.toThrow();
      expect(() => new RateLimiter({ tokensPerInterval: 1, interval: "day" })).not.toThrow();
    });
  });
});
