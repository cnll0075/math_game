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
    expect(ARCADE_LEVELS.map((level) => level.id)).toEqual([
      'level-6',
      'level-7',
      'level-8',
      'level-9',
      'level-10',
    ]);
    expect(LEVELS).toHaveLength(10);
  });

  it('gets harder without getting longer', () => {
    const [six, seven, eight] = ARCADE_LEVELS as [ArcadeLevelDef, ArcadeLevelDef, ArcadeLevelDef];
    expect(seven.arcade.arrivalSeconds).toBeLessThan(six.arcade.arrivalSeconds);
    expect(eight.arcade.arrivalSeconds).toBeLessThan(seven.arcade.arrivalSeconds);
    expect(eight.arcade.dangerFillSeconds).toBeLessThan(six.arcade.dangerFillSeconds);
    expect(eight.objective.kind === 'survive' && eight.objective.seconds).toBeLessThanOrEqual(45);
  });

  it('introduces the weather only at level 9, and keeps it there', () => {
    const withWind = ARCADE_LEVELS.filter((level) => level.arcade.wind).map((level) => level.id);
    expect(withWind).toEqual(['level-9', 'level-10']);
  });

  it('ends with one endless level and no others', () => {
    const endless = ARCADE_LEVELS.filter((level) => level.objective.kind === 'endless');
    expect(endless.map((level) => level.id)).toEqual(['level-10']);
  });

  const TIMED = ARCADE_LEVELS.filter((level) => level.objective.kind === 'survive');

  it.each(TIMED.map((level) => [level.id, level] as const))(
    '%s can be survived by playing it sensibly',
    (_id, level) => {
      const result = playWell(level);
      expect(result.status).toBe('won');
    },
  );

  // The real claim: the generator cannot deal an unwinnable round. If any seed
  // kills a competent player, the fairness rules are wrong, not the player.
  it.each(TIMED.map((level) => [level.id, level] as const))(
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


describe('the endless park', () => {
  const park = ARCADE_LEVELS.find((level) => level.objective.kind === 'endless')!;

  it('has no finish line', () => {
    const arcade = createArcadeRun(park);
    expect(arcade.target).toBeNull();
    expect(arcade.progress).toBeNull();
  });

  it('is never won, however well it is played', () => {
    const result = playWell(park);
    expect(result.status).toBe('lost');
  });

  it('lasts a good while before the pace catches a competent player', () => {
    const result = playWell(park);
    // Long enough to feel like a run rather than a round, and it does end.
    expect(result.elapsed).toBeGreaterThan(30);
  });

  it('rewards playing well with a longer run than ignoring it', () => {
    const attentive = playWell(park).elapsed;
    const ignored = (() => {
      const arcade = createArcadeRun(park);
      while (arcade.state.status === 'playing') arcade.tick(FRAME);
      return arcade.state.elapsed;
    })();
    expect(attentive).toBeGreaterThan(ignored * 2);
  });

  it('keeps a record of the run worth remembering', () => {
    const arcade = createArcadeRun(park);
    while (arcade.state.status === 'playing') {
      arcade.tick(FRAME);
      if (arcade.state.status !== 'playing') break;
      const next = arcade.state.queue[0];
      if (next) {
        const { balanceDifference } = arcade.snapshot();
        const weight = weightOf(next);
        arcade.place(Math.abs(balanceDifference + weight) <= Math.abs(balanceDifference - weight) ? 'left' : 'right');
      }
    }
    const { stats } = arcade.state;
    expect(stats.secondsSurvived).toBeGreaterThan(10);
    expect(stats.animalsHandled).toBeGreaterThan(5);
    expect(stats.perfectBalances).toBeGreaterThan(0);
    expect(stats.longestStreak).toBeGreaterThanOrEqual(1);
    expect(stats.nearMisses).toBeGreaterThanOrEqual(0);
  });

  it('tightens the pace as the run goes on', () => {
    const arcade = createArcadeRun(park);
    const early: number[] = [];
    const late: number[] = [];
    let previous = 0;
    while (arcade.state.status === 'playing' && arcade.state.elapsed < 120) {
      const events = arcade.tick(FRAME);
      if (events.some((event) => event.type === 'arrived')) {
        const gap = arcade.state.elapsed - previous;
        previous = arcade.state.elapsed;
        (arcade.state.elapsed < 40 ? early : late).push(gap);
      }
      const next = arcade.state.queue[0];
      if (next) {
        const { balanceDifference } = arcade.snapshot();
        const weight = weightOf(next);
        arcade.place(Math.abs(balanceDifference + weight) <= Math.abs(balanceDifference - weight) ? 'left' : 'right');
      }
    }
    const mean = (values: number[]) => values.reduce((total, value) => total + value, 0) / values.length;
    if (late.length > 2) expect(mean(late)).toBeLessThan(mean(early));
  });
});
