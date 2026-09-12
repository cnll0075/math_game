import { describe, it, expect } from 'vitest';
import { createTicker, type RafLike } from './ticker.js';

const fakeRaf = () => {
  const frames: Array<(time: number) => void> = [];
  const raf: RafLike = {
    request: (callback) => {
      frames.push(callback);
      return frames.length;
    },
    cancel: () => {},
  };
  return { frames, raf };
};

describe('createTicker', () => {
  it('reports seconds between frames', () => {
    const { frames, raf } = fakeRaf();
    const deltas: number[] = [];
    createTicker((dt) => deltas.push(dt), raf).start();
    frames[0]!(1000);
    frames[1]!(1016);
    expect(deltas[0]).toBe(0);
    expect(deltas[1]).toBeCloseTo(0.016, 3);
  });

  it('clamps a long stall', () => {
    const { frames, raf } = fakeRaf();
    const deltas: number[] = [];
    createTicker((dt) => deltas.push(dt), raf).start();
    frames[0]!(0);
    frames[1]!(5000);
    expect(deltas[1]).toBeLessThanOrEqual(0.1);
  });

  it('stops delivering after stop()', () => {
    const { frames, raf } = fakeRaf();
    const deltas: number[] = [];
    const ticker = createTicker((dt) => deltas.push(dt), raf);
    ticker.start();
    frames[0]!(0);
    ticker.stop();
    expect(ticker.running).toBe(false);
    frames[1]?.(16);
    expect(deltas).toHaveLength(1);
  });

  it('ignores a second start', () => {
    const { frames, raf } = fakeRaf();
    const ticker = createTicker(() => {}, raf);
    ticker.start();
    ticker.start();
    expect(frames).toHaveLength(1);
  });
});
