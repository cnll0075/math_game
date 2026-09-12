import { describe, it, expect } from 'vitest';
import { createSpring } from './spring.js';
import { TIMING } from './timing.js';

const settleTime = (spring: ReturnType<typeof createSpring>, limit = 3): number => {
  let elapsed = 0;
  while (!spring.settled && elapsed < limit) {
    spring.step(1 / 60);
    elapsed += 1 / 60;
  }
  return elapsed;
};

describe('createSpring', () => {
  it('converges to the target', () => {
    const spring = createSpring(0);
    spring.target = 1;
    for (let i = 0; i < 300; i++) spring.step(1 / 60);
    expect(spring.value).toBeCloseTo(1, 3);
    expect(spring.settled).toBe(true);
  });

  it('starts settled at its initial value', () => {
    expect(createSpring(0.5).settled).toBe(true);
  });

  it('reports unsettled as soon as the target moves', () => {
    const spring = createSpring(0);
    spring.target = 1;
    expect(spring.settled).toBe(false);
  });

  it('settles within roughly the configured time', () => {
    const spring = createSpring(0);
    spring.target = 1;
    expect(settleTime(spring)).toBeLessThan(TIMING.settleSeconds * 3);
  });

  it('does not overshoot appreciably', () => {
    const spring = createSpring(0);
    spring.target = 1;
    let peak = 0;
    for (let i = 0; i < 300; i++) {
      spring.step(1 / 60);
      peak = Math.max(peak, spring.value);
    }
    expect(peak).toBeLessThan(1.05);
  });

  it('stays finite under a huge dt', () => {
    const spring = createSpring(0);
    spring.target = 1;
    spring.step(10);
    expect(Number.isFinite(spring.value)).toBe(true);
    expect(spring.value).toBeLessThanOrEqual(1.05);
  });

  it('ignores a zero or negative dt', () => {
    const spring = createSpring(0);
    spring.target = 1;
    spring.step(0);
    spring.step(-1);
    expect(spring.value).toBe(0);
  });

  it('can be snapped to a value', () => {
    const spring = createSpring(0);
    spring.target = 1;
    spring.snap(1);
    expect(spring.value).toBe(1);
    expect(spring.settled).toBe(true);
  });
});
