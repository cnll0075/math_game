export interface RafLike {
  request(callback: (time: number) => void): number;
  cancel(handle: number): void;
}

export interface Ticker {
  start(): void;
  stop(): void;
  readonly running: boolean;
}

/** Longest frame we will simulate; a backgrounded tab must not teleport the game. */
const MAX_DELTA_SECONDS = 0.1;

const defaultRaf: RafLike = {
  request: (callback) => globalThis.requestAnimationFrame(callback),
  cancel: (handle) => globalThis.cancelAnimationFrame(handle),
};

export function createTicker(onTick: (dtSeconds: number) => void, raf: RafLike = defaultRaf): Ticker {
  let handle: number | null = null;
  let previousTime: number | null = null;

  const frame = (time: number): void => {
    if (handle === null) return;
    // Clamped at both ends. The ceiling stops a backgrounded tab teleporting the
    // game on its first frame back; the floor stops a timestamp that goes
    // backwards from running it in reverse, which winds clocks back and sends
    // everything off the top of the screen.
    const elapsed = previousTime === null ? 0 : (time - previousTime) / 1000;
    const dt = Math.min(Math.max(elapsed, 0), MAX_DELTA_SECONDS);
    previousTime = time;
    handle = raf.request(frame);
    onTick(dt);
  };

  return {
    start() {
      if (handle !== null) return;
      previousTime = null;
      handle = raf.request(frame);
    },
    stop() {
      if (handle === null) return;
      raf.cancel(handle);
      handle = null;
      previousTime = null;
    },
    get running() {
      return handle !== null;
    },
  };
}
