import { describe, it, expect } from 'vitest';
import { playOut } from './bot.js';
import { LEVELS } from './levels.data.js';
import { createWorld } from './world.js';

const SEEDS = Array.from({ length: 12 }, (_, index) => index + 1);

/**
 * The tests that keep the levels honest. A careful player who lands the
 * biggest fish that still fits must finish every level with most of the clock
 * left — a child is far slower than a bot, so the margin is theirs. And landing
 * big fish must really pay: only ever taking the smallest must need far more
 * catches. If either stops holding, fix the levels, never the test.
 */
describe('the guards', () => {
  for (const level of LEVELS) {
    it(`${level.id}: a careful player fills it with most of the clock to spare`, () => {
      const runs = SEEDS.map((seed) => playOut(createWorld(level, { seed }), 'biggest'));
      const full = runs.filter((run) => run.outcome === 'full');
      expect(full.length, `filled ${full.length} of ${runs.length}`).toBeGreaterThanOrEqual(SEEDS.length - 2);
      const used = full.map((run) => 1 - run.timeLeft / level.seconds);
      const mean = used.reduce((sum, share) => sum + share, 0) / used.length;
      expect(mean, 'share of the clock used').toBeLessThan(0.35);
    });
  }

  it('landing the big fish takes far fewer catches than only the small ones', () => {
    const catches = (policy: 'biggest' | 'smallest') =>
      LEVELS.slice(2).reduce((sum, level) => {
        const world = createWorld(level, { seed: 4 });
        playOut(world, policy);
        return sum + world.state.bucket.length - (level.start?.length ?? 0);
      }, 0);
    expect(catches('smallest')).toBeGreaterThan(catches('biggest') * 1.6);
  });
});
