import { RateLimiter } from "./RateLimiter.js";
import { TokenBucket } from "./TokenBucket.js";

describe("rate limiting invariants", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("accounts for concurrent immediate calls before their promises resolve", async () => {
    const limiter = new RateLimiter({ tokensPerInterval: 2, interval: 100, fireImmediately: true });
    expect(
      await Promise.all([
        limiter.removeTokens(1),
        limiter.removeTokens(1),
        limiter.removeTokens(1),
      ]),
    ).toEqual([1, 0, -1]);
  });

  it("rechecks interval limits after waking and resets the interval", async () => {
    const limiter = new RateLimiter({ tokensPerInterval: 2, interval: 100 });
    await limiter.removeTokens(2);
    let completed = 0;
    const requests = Array.from({ length: 6 }, () =>
      limiter.removeTokens(1).then(() => completed++),
    );
    await jest.advanceTimersByTimeAsync(100);
    expect(completed).toBe(2);
    await jest.advanceTimersByTimeAsync(100);
    expect(completed).toBe(4);
    await jest.advanceTimersByTimeAsync(100);
    await Promise.all(requests);
    expect(completed).toBe(6);
  });

  it("does not double-charge a parent when sibling requests compete", async () => {
    const parent = new TokenBucket({ bucketSize: 10, tokensPerInterval: 1, interval: 100 });
    parent.content = 10;
    const child = new TokenBucket({
      bucketSize: 1,
      tokensPerInterval: 1,
      interval: 100,
      parentBucket: parent,
    });
    child.content = 1;
    const requests = [child.removeTokens(1), child.removeTokens(1)];
    await jest.advanceTimersByTimeAsync(100);
    await Promise.all(requests);
    expect(parent.content).toBe(9);
  });

  it.each([-1, NaN, Infinity])(
    "rejects invalid token count %s without changing balances",
    async (count) => {
      const bucket = new TokenBucket({ bucketSize: 10, tokensPerInterval: 1, interval: 100 });
      bucket.content = 5;
      expect(() => bucket.tryRemoveTokens(count)).toThrow();
      await expect(bucket.removeTokens(count)).rejects.toThrow();
      expect(bucket.content).toBe(5);
    },
  );

  it.each([0, -1, NaN, Infinity])("rejects invalid interval %s", (interval) => {
    expect(() => new TokenBucket({ bucketSize: 1, tokensPerInterval: 1, interval })).toThrow();
  });
  it("serves a large backlog in FIFO order with one active timer", async () => {
    const limiter = new RateLimiter({ tokensPerInterval: 1, interval: 10 });
    const order: number[] = [];
    const requests = Array.from({ length: 1000 }, (_, i) =>
      limiter.removeTokens(1).then(() => order.push(i)),
    );
    await jest.advanceTimersByTimeAsync(1);
    expect(jest.getTimerCount()).toBe(1);
    await jest.advanceTimersByTimeAsync(9999);
    await Promise.all(requests);
    expect(order).toEqual(Array.from({ length: 1000 }, (_, i) => i));
    expect(jest.getTimerCount()).toBe(0);
  });

  it("preserves zero-rate and unlimited bucket semantics", async () => {
    const unlimited = new TokenBucket({ bucketSize: 0, tokensPerInterval: 1, interval: 100 });
    expect(await unlimited.removeTokens(100)).toBe(Infinity);
    const burst = new TokenBucket({ bucketSize: 5, tokensPerInterval: 0, interval: 100 });
    expect(burst.tryRemoveTokens(5)).toBe(true);
    expect(burst.tryRemoveTokens(5)).toBe(true);
  });

  it("rejects impossible parent requests without poisoning the queue", async () => {
    const parent = new TokenBucket({ bucketSize: 1, tokensPerInterval: 0, interval: 100 });
    const child = new TokenBucket({
      bucketSize: 5,
      tokensPerInterval: 0,
      interval: 100,
      parentBucket: parent,
    });
    await expect(child.removeTokens(2)).rejects.toThrow();
    expect(await child.removeTokens(1)).toBe(0);
  });

  it("rejects cyclic hierarchies without debiting them", async () => {
    const a = new TokenBucket({ bucketSize: 5, tokensPerInterval: 0, interval: 100 });
    const b = new TokenBucket({
      bucketSize: 5,
      tokensPerInterval: 0,
      interval: 100,
      parentBucket: a,
    });
    a.parentBucket = b;
    expect(() => a.tryRemoveTokens(1)).toThrow("Circular");
    await expect(a.removeTokens(1)).rejects.toThrow("Circular");
  });

  it("supports fractional counts and intervals", async () => {
    const bucket = new TokenBucket({ bucketSize: 1.5, tokensPerInterval: 0.5, interval: 2.5 });
    const request = bucket.removeTokens(0.5);
    await jest.advanceTimersByTimeAsync(3);
    expect(await request).toBeCloseTo(0.1);
  });

  it("does not corrupt balances when a finite interval produces an infinite rate", () => {
    const bucket = new TokenBucket({
      bucketSize: 1,
      tokensPerInterval: 1,
      interval: Number.MIN_VALUE,
    });
    expect(bucket.tryRemoveTokens(1)).toBe(false);
    expect(bucket.content).toBe(0);
    jest.advanceTimersByTime(1);
    expect(bucket.tryRemoveTokens(1)).toBe(true);
    expect(bucket.content).toBe(0);
  });

  it("computes finite waits when both refill inputs are very small", async () => {
    const bucket = new TokenBucket({
      bucketSize: 1,
      tokensPerInterval: 1e-320,
      interval: 1e-320,
    });
    const request = bucket.removeTokens(1);
    await jest.advanceTimersByTimeAsync(1);
    expect(await request).toBe(0);
  });

  it("caps long delays instead of overflowing platform timers", async () => {
    const bucket = new TokenBucket({ bucketSize: 1, tokensPerInterval: 1, interval: 3e9 });
    const request = bucket.removeTokens(1);
    await jest.advanceTimersByTimeAsync(2147483647);
    expect(bucket.content).toBeLessThan(1);
    expect(jest.getTimerCount()).toBe(1);
    // Fractional refill can leave a sub-token rounding remainder; the next
    // millisecond must finish the request without granting it early.
    await jest.advanceTimersByTimeAsync(3e9 - 2147483647 + 1);
    expect(await request).toBe(0);
  });

  it("matches an integer reference model across competing hierarchical requests", () => {
    const root = new TokenBucket({ bucketSize: 20, tokensPerInterval: 1, interval: 1 });
    const children = [3, 7].map(
      (bucketSize) =>
        new TokenBucket({ bucketSize, tokensPerInterval: 1, interval: 1, parentBucket: root }),
    );
    let rootBalance = 0;
    const balances = [0, 0];
    let seed = 123456789;
    const random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0);
    for (let i = 0; i < 10000; i++) {
      const elapsed = random() % 4;
      jest.advanceTimersByTime(elapsed);
      rootBalance = Math.min(20, rootBalance + elapsed);
      for (let j = 0; j < children.length; j++) {
        balances[j] = Math.min(children[j]!.bucketSize, balances[j]! + elapsed);
      }
      const index = random() % children.length;
      const count = random() % 10;
      const accepted = count <= balances[index]! && count <= rootBalance;
      expect(children[index]!.tryRemoveTokens(count)).toBe(accepted);
      if (accepted) {
        balances[index]! -= count;
        rootBalance -= count;
      }
      root.drip();
      children.forEach((child, j) => {
        child.drip();
        expect(child.content).toBe(balances[j]);
      });
      expect(root.content).toBe(rootBalance);
    }
  });

  it("rechecks capacity consumed by synchronous callers while an async request waits", async () => {
    const limiter = new RateLimiter({ tokensPerInterval: 2, interval: 100 });
    await limiter.removeTokens(2);
    let completed = false;
    const request = limiter.removeTokens(2).then(() => {
      completed = true;
    });
    jest.advanceTimersByTime(100);
    expect(limiter.tryRemoveTokens(1)).toBe(true);
    await jest.advanceTimersByTimeAsync(0);
    expect(completed).toBe(false);
    await jest.advanceTimersByTimeAsync(100);
    await request;
    expect(limiter.tokensThisInterval).toBe(2);
  });
});
