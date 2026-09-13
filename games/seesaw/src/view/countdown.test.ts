import { describe, it, expect } from 'vitest';
import { countdownStep, COUNTDOWN_FROM } from './countdown.js';

/** Runs a clock down from `from` to zero at 60fps, collecting the ticks. */
const runClock = (from: number) => {
  const ticks: number[] = [];
  let whole = Number.POSITIVE_INFINITY;
  for (let remaining = from; remaining > 0; remaining -= 1 / 60) {
    const step = countdownStep(whole, remaining);
    whole = step.whole;
    if (step.tick) ticks.push(whole);
  }
  return ticks;
};

describe('countdownStep', () => {
  it('counts the closing seconds, once each, in order', () => {
    expect(runClock(10)).toEqual([5, 4, 3, 2, 1]);
  });

  it('says nothing early in a round', () => {
    let whole = Number.POSITIVE_INFINITY;
    for (let remaining = 60; remaining > 30; remaining -= 1 / 60) {
      const step = countdownStep(whole, remaining);
      whole = step.whole;
      expect(step.tick).toBe(false);
    }
  });

  it('never ticks twice for the same second', () => {
    const ticks = runClock(8);
    expect(new Set(ticks).size).toBe(ticks.length);
  });

  it('counts a round shorter than the countdown itself, from its first second', () => {
    expect(runClock(3)).toEqual([3, 2, 1]);
  });

  it('stays quiet when a round has no clock at all', () => {
    expect(countdownStep(3, null)).toEqual({ tick: false, whole: Number.POSITIVE_INFINITY });
  });

  it('resets when the clock goes away, so the next round counts again', () => {
    const { whole } = countdownStep(2, null);
    expect(countdownStep(whole, 4.5).tick).toBe(true);
  });

  it('counts from the documented number of seconds', () => {
    expect(runClock(30)[0]).toBe(COUNTDOWN_FROM);
  });
});
