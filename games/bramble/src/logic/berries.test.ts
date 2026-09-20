import { describe, it, expect } from 'vitest';
import { createRng } from '@bundle/core';
import { LANES } from './lanes.js';
import { makeBerry, BERRY_LATEST_SHARE } from './berries.js';

describe('a berry', () => {
  it('sits in one of the lanes, at the horizon, uneaten', () => {
    const rng = createRng(3);
    for (let i = 0; i < 200; i += 1) {
      const berry = makeBerry(rng, `b${i}`, 5);
      expect(berry.lane).toBeGreaterThanOrEqual(0);
      expect(berry.lane).toBeLessThan(LANES);
      expect(berry.progress).toBe(0);
      expect(berry.taken).toBe(false);
    }
  });

  it('uses every lane sooner or later', () => {
    const rng = createRng(4);
    const seen = new Set(Array.from({ length: 300 }, (_, i) => makeBerry(rng, `b${i}`, 5).lane));
    expect(seen.size).toBe(LANES);
  });

  it('arrives early enough in the gap that taking it is always safe', () => {
    // Half the gap left after it lands, so the rabbit can always reach any lane
    // before the next row. A reward that could cost 10% is not a reward.
    expect(BERRY_LATEST_SHARE).toBeLessThanOrEqual(0.5);
  });
});
