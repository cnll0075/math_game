import { describe, it, expect } from 'vitest';
import { playOut } from './bot.js';
import { createRun } from './run.js';

const SEEDS = Array.from({ length: 12 }, (_, index) => index + 1);
const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;

/**
 * The tests that keep the yard fair. A child who loads well, at a child's
 * pace, must last a good while; a child who freezes must not be left watching
 * for long; and loading without reading the numbers must cost dearly. If any
 * of these stops holding, retune the yard, never the test.
 */
describe('the guards', () => {
  const careful = SEEDS.map((seed) => playOut(createRun({ seed }), 'careful', { every: 1.2, seed }));

  it('a careful player loading a crate every 1.2 seconds lasts at least two minutes', () => {
    const lasted = careful.filter((result) => result.seconds >= 120);
    expect(lasted.length, careful.map((result) => Math.round(result.seconds)).join(', ')).toBeGreaterThanOrEqual(SEEDS.length - 2);
    for (const result of careful) expect(result.broken).toBe(0);
  });

  it('a player who does nothing is out in under thirty seconds', () => {
    for (const seed of SEEDS) expect(playOut(createRun({ seed }), 'idle').seconds).toBeLessThan(30);
  });

  it('loading without reading the numbers breaks trains and ends much sooner', () => {
    const random = SEEDS.map((seed) => playOut(createRun({ seed }), 'random', { every: 1.2, seed }));
    expect(mean(random.map((result) => result.broken))).toBeGreaterThan(3);
    expect(mean(random.map((result) => result.seconds))).toBeLessThan(mean(careful.map((result) => result.seconds)) * 0.6);
  });
});
