import { performance } from "just-performance";

// generate timestamp or delta
// see http://nodejs.org/api/process.html#process_process_hrtime
function hrtime(previousTimestamp?: [number, number]): [number, number] {
  const clocktime = performance.now() * 1e-3;
  let seconds = Math.floor(clocktime);
  let nanoseconds = Math.floor((clocktime % 1) * 1e9);
  if (previousTimestamp != undefined) {
    seconds = seconds - previousTimestamp[0];
    nanoseconds = nanoseconds - previousTimestamp[1];
    if (nanoseconds < 0) {
      seconds--;
      nanoseconds += 1e9;
    }
  }
  return [seconds, nanoseconds];
}

// The current timestamp in whole milliseconds
export function getMilliseconds(): number {
  const [seconds, nanoseconds] = hrtime();
  return seconds * 1e3 + Math.floor(nanoseconds / 1e6);
}

// Wait for a specified number of milliseconds before fulfilling the returned promise.
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
