// performance.now() is monotonic in both Node.js and browsers.
export function getMilliseconds(): number {
  return performance.now();
}

// Clamp long waits: runtimes turn delays above 2^31 - 1 into near-zero timers.
// Callers recheck availability after waking, including after a capped wait.
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) =>
    setTimeout(resolve, Math.min(2147483647, Math.max(1, Math.ceil(ms)))),
  );
}
