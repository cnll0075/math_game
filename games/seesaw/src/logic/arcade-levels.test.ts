import { describe, it, expect } from 'vitest';
import { ARCADE_LEVELS, LEVELS, PUZZLE_LEVELS } from './levels.data.js';
import { createArcadeRun } from './arcade.js';
import type { ArcadeLevelDef } from './level.js';
import { weightOf } from './animals.js';

const FRAME = 1 / 60;

/**
 * Models a competent player: places each animal on whichever side leaves the
 * seesaw closest to level. Not clairvoyant — it cannot see the queue or predict
 * who is about to wander off — but it never makes an obviously bad choice.
 */
const playWell = (level: ArcadeLevelDef, seed?: number) => {
  const arcade = createArcadeRun(seed === undefined ? level : { ...level, arcade: { ...level.arcade, seed } });
  let worstDanger = 0;
  while (arcade.state.status === 'playing') {
    arcade.tick(FRAME);
    worstDanger = Math.max(worstDanger, arcade.state.danger);
    if (arcade.state.status !== 'playing') break;

    const next = arcade.state.queue[0];
    if (next) {
      const { balanceDifference } = arcade.snapshot();
      const weight = weightOf(next);
      const onLeft = Math.abs(balanceDifference + weight);
      const onRight = Math.abs(balanceDifference - weight);
      arcade.place(onLeft <= onRight ? 'left' : 'right');
    }
  }
  return { status: arcade.state.status, worstDanger, elapsed: arcade.state.elapsed };
};

/** Does nothing at all, which the drifting seesaw should punish. */
const stall = (level: ArcadeLevelDef) => {
  const arcade = createArcadeRun(level);
  while (arcade.state.status === 'playing') arcade.tick(FRAME);
  return arcade.state.status;
};

describe('arcade levels', () => {
  it('adds three arcade levels after the five puzzles', () => {
    expect(PUZZLE_LEVELS).toHaveLength(5);
    expect(ARCADE_LEVELS.map((level) => level.id)).toEqual(['level-6', 'level-7', 'level-8']);
    expect(LEVELS).toHaveLength(8);
  });

  it('gets harder without getting longer', () => {
    const [six, seven, eight] = ARCADE_LEVELS as [ArcadeLevelDef, ArcadeLevelDef, ArcadeLevelDef];
    expect(seven.arcade.arrivalSeconds).toBeLessThan(six.arcade.arrivalSeconds);
    expect(eight.arcade.arrivalSeconds).toBeLessThan(seven.arcade.arrivalSeconds);
    expect(eight.arcade.dangerFillSeconds).toBeLessThan(six.arcade.dangerFillSeconds);
    expect(eight.objective.seconds).toBeLessThanOrEqual(45);
  });

  it.each(ARCADE_LEVELS.map((level) => [level.id, level] as const))(
    '%s can be survived by playing it sensibly',
    (_id, level) => {
      const result = playWell(level);
      expect(result.status).toBe('won');
    },
  );

  // The real claim: the generator cannot deal an unwinnable round. If any seed
  // kills a competent player, the fairness rules are wrong, not the player.
  it.each(ARCADE_LEVELS.map((level) => [level.id, level] as const))(
    '%s is survivable from any seed, not just its own',
    (_id, level) => {
      const losses: number[] = [];
      for (let seed = 1; seed <= 40; seed++) {
        if (playWell(level, seed).status !== 'won') losses.push(seed);
      }
      expect(losses).toEqual([]);
    },
  );

  it.each(ARCADE_LEVELS.map((level) => [level.id, level] as const))(
    '%s cannot be won by ignoring it',
    (_id, level) => {
      // If standing still survives, the mode has no tension worth the name.
      expect(stall(level)).toBe('lost');
    },
  );

  it('leaves a competent player some room to spare, but not too much', () => {
    const [six, , eight] = ARCADE_LEVELS as [ArcadeLevelDef, ArcadeLevelDef, ArcadeLevelDef];
    // Level 6 should feel forgiving; level 8 should not feel like a formality.
    expect(playWell(six).worstDanger).toBeLessThan(0.7);
    expect(playWell(eight).worstDanger).toBeGreaterThan(0);
  });
});
