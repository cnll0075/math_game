import { describe, it, expect } from 'vitest';
import { createRng } from '@bundle/core';
import { chooseCrate, chooseTarget, openingCrates, openingTarget, starTarget } from './choose.js';
import { BANDS, bandById } from './tempo.js';

const SEEDS = Array.from({ length: 200 }, (_, index) => index + 1);
const little = bandById('little')!;
const heavy = bandById('heavy')!;

describe('a new train', () => {
  it('takes a target in band that no waiting train has', () => {
    for (const band of BANDS) {
      for (const seed of SEEDS) {
        const target = chooseTarget(createRng(seed), band, [6, 7]);
        expect(target).toBeGreaterThanOrEqual(band.targets[0]);
        expect(target).toBeLessThanOrEqual(band.targets[1]);
        expect([6, 7]).not.toContain(target);
      }
    }
  });
});

describe('a new crate', () => {
  it('always fits some waiting train', () => {
    for (const seed of SEEDS) {
      const weight = chooseCrate(createRng(seed), heavy, [2, 3]);
      expect(weight).toBeLessThanOrEqual(3);
      expect(weight).toBeGreaterThanOrEqual(1);
    }
  });

  it('is any crate in band when the gaps are all big, or no train is waiting', () => {
    const seen = new Set<number>();
    for (const seed of SEEDS) seen.add(chooseCrate(createRng(seed), little, []));
    expect([...seen].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
    for (const seed of SEEDS) expect(chooseCrate(createRng(seed), little, [15])).toBeLessThanOrEqual(5);
  });
});

describe('the opening', () => {
  it('gives the first train a target the first two crates make, even in the heavy band', () => {
    for (const band of BANDS) {
      for (const seed of SEEDS) {
        const rng = createRng(seed);
        const target = openingTarget(rng, band);
        const [a, b] = openingCrates(rng, band, target);
        expect(a + b).toBe(target);
        for (const weight of [a, b]) {
          expect(weight).toBeGreaterThanOrEqual(band.crates[0]);
          expect(weight).toBeLessThanOrEqual(band.crates[1]);
        }
      }
    }
  });
});

describe('a star train', () => {
  it('wants a sum of two or three crates in the queue, in band and not taken', () => {
    for (const seed of SEEDS) {
      const target = starTarget(createRng(seed), little, [1, 4, 2], [5]);
      expect(target).not.toBeNull();
      // Pairs and triples of 1, 4, 2 make 3, 5, 6 and 7: 5 is taken and 3 is below the band.
      expect([6, 7]).toContain(target);
    }
  });

  it('is not offered when the queue cannot make one', () => {
    expect(starTarget(createRng(1), little, [2], [])).toBeNull();
    expect(starTarget(createRng(1), little, [1, 1], [])).toBeNull();
  });
});
