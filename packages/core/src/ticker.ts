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
    const dt = previousTime === null ? 0 : Math.min((time - previousTime) / 1000, MAX_DELTA_SECONDS);
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
