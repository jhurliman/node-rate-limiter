import { RateLimiter } from "./RateLimiter.js";

describe("RateLimiter cooldown estimates", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("does not consume or reserve available tokens", () => {
    const limiter = new RateLimiter({ tokensPerInterval: 3, interval: 60000 });
    expect(limiter.getWaitTime(3)).toBe(0);
    expect(limiter.getWaitTime(3)).toBe(0);
    expect(limiter.tryRemoveTokens(3)).toBe(true);
    expect(limiter.getWaitTime(1)).toBe(60000);
  });

  it("waits for the interval even when the underlying bucket has refilled (#25, #61)", () => {
    const limiter = new RateLimiter({ tokensPerInterval: 3, interval: 60000 });
    expect(limiter.tryRemoveTokens(3)).toBe(true);
    jest.advanceTimersByTime(20000);
    expect(limiter.getTokensRemaining()).toBe(1);
    expect(limiter.tryRemoveTokens(1)).toBe(false);
    expect(limiter.getWaitTime(1)).toBe(40000);
    jest.advanceTimersByTime(40000);
    expect(limiter.getWaitTime(3)).toBe(0);
    expect(limiter.tryRemoveTokens(3)).toBe(true);
  });

  it("includes refill time when an interval has expired", () => {
    const limiter = new RateLimiter({ tokensPerInterval: 10, interval: 1000 });
    jest.advanceTimersByTime(900);
    expect(limiter.tryRemoveTokens(10)).toBe(true);
    jest.advanceTimersByTime(100);
    expect(limiter.getWaitTime(10)).toBe(900);
    jest.advanceTimersByTime(900);
    expect(limiter.tryRemoveTokens(10)).toBe(true);
  });

  it("rounds fractional waits up and validates impossible requests", () => {
    const limiter = new RateLimiter({ tokensPerInterval: 1, interval: 2.5 });
    expect(limiter.tryRemoveTokens(1)).toBe(true);
    expect(limiter.getWaitTime(0.5)).toBe(3);
    expect(limiter.getWaitTime(0)).toBe(0);
    for (const count of [-1, NaN, Infinity, 2]) {
      expect(() => limiter.getWaitTime(count)).toThrow(RangeError);
    }
    const disabled = new RateLimiter({ tokensPerInterval: 0, interval: 1000 });
    expect(disabled.getWaitTime(0)).toBe(0);
    expect(() => disabled.getWaitTime(1)).toThrow(RangeError);
  });

  it("drains the reported 5,000-request backlog in FIFO order with one timer (#85)", async () => {
    const limiter = new RateLimiter({ tokensPerInterval: 1, interval: 100 });
    const order: number[] = [];
    const requests = Array.from({ length: 5000 }, (_, index) =>
      limiter.removeTokens(1).then(() => {
        order.push(index);
      }),
    );
    await jest.advanceTimersByTimeAsync(0);
    expect(order).toEqual([0]);
    expect(jest.getTimerCount()).toBe(1);
    await jest.advanceTimersByTimeAsync(499800);
    expect(order).toHaveLength(4999);
    expect(jest.getTimerCount()).toBe(1);
    await jest.advanceTimersByTimeAsync(100);
    await Promise.all(requests);
    expect(order).toEqual(Array.from({ length: 5000 }, (_, index) => index));
    expect(jest.getTimerCount()).toBe(0);
  });
});
