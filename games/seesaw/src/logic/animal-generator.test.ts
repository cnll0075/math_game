import { describe, it, expect } from 'vitest';
import { createAnimalGenerator } from './animal-generator.js';
import { weightOf } from './animals.js';
import { DEFAULT_BALANCE_CONFIG } from './seesaw-state.js';
import { HEAVY_WEIGHT } from './fairness.js';

const settings = {
  seed: 7,
  pool: ['rabbit', 'cat', 'dog', 'bear'] as const,
  config: DEFAULT_BALANCE_CONFIG,
  maxHeavyRun: 2,
};

describe('createAnimalGenerator', () => {
  it('replays exactly for a given seed', () => {
    const a = createAnimalGenerator(settings);
    const b = createAnimalGenerator(settings);
    const runA = Array.from({ length: 30 }, () => a.next(0));
    const runB = Array.from({ length: 30 }, () => b.next(0));
    expect(runA).toEqual(runB);
  });

  it('differs across seeds', () => {
    const a = createAnimalGenerator({ ...settings, seed: 1 });
    const b = createAnimalGenerator({ ...settings, seed: 2 });
    const runA = Array.from({ length: 30 }, () => a.next(0));
    const runB = Array.from({ length: 30 }, () => b.next(0));
    expect(runA).not.toEqual(runB);
  });

  it('only sends species from the pool', () => {
    const generator = createAnimalGenerator({ ...settings, pool: ['rabbit', 'cat'] });
    for (let i = 0; i < 60; i++) expect(['rabbit', 'cat']).toContain(generator.next(0));
  });

  it('never sends more heavy animals in a row than allowed', () => {
    const generator = createAnimalGenerator(settings);
    let run = 0;
    for (let i = 0; i < 300; i++) {
      const weight = weightOf(generator.next(0));
      run = weight >= HEAVY_WEIGHT ? run + 1 : 0;
      expect(run).toBeLessThanOrEqual(settings.maxHeavyRun);
    }
  });

  it('never sends an animal that would trap the player', () => {
    const generator = createAnimalGenerator(settings);
    // A difference of zero: a bear would leave 5 either way, past the red line.
    for (let i = 0; i < 200; i++) expect(weightOf(generator.next(0))).toBeLessThan(5);
  });

  it('sends the heavy animals when they are the useful ones', () => {
    const generator = createAnimalGenerator(settings);
    // Four heavy on the left: a dog or a bear is exactly what recovers this.
    const sent = Array.from({ length: 40 }, () => weightOf(generator.next(4)));
    expect(Math.max(...sent)).toBeGreaterThanOrEqual(3);
  });

  it('keeps producing even when nothing is fair', () => {
    const generator = createAnimalGenerator({ ...settings, pool: ['bear'] });
    // A pool of bears at a hopeless difference: it must still return something
    // rather than spin forever.
    for (let i = 0; i < 20; i++) expect(generator.next(20)).toBe('bear');
  });

  it('uses a spread of species over a long round', () => {
    const generator = createAnimalGenerator(settings);
    const seen = new Set(Array.from({ length: 120 }, () => generator.next(0)));
    expect(seen.size).toBeGreaterThanOrEqual(2);
  });
});
