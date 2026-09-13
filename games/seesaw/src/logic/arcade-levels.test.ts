import { describe, it, expect } from 'vitest';
import { ARCADE_LEVELS, LEVELS, PUZZLE_LEVELS } from './levels.data.js';
import { createArcadeRun } from './arcade.js';
import type { ArcadeLevelDef } from './level.js';
import { weightOf } from './animals.js';
import type { Side } from './seesaw-state.js';

const FRAME = 1 / 60;

type Run = ReturnType<typeof createArcadeRun>;

const withSeed = (level: ArcadeLevelDef, seed?: number): ArcadeLevelDef =>
  seed === undefined ? level : { ...level, arcade: { ...level.arcade, seed } };

/**
 * Plays the way the game asks to be played: looks at the gap, looks at the
 * animals on offer, and picks the one that closes it — landing exactly on zero
 * when that is possible. This is arithmetic, and the levels are tuned so that
 * it is rewarded.
 */
const playWithArithmetic = (run: Run): void => {
  const { queue, selected } = run.state;
  if (queue.length === 0) return;
  const difference = run.snapshot().balanceDifference;
  const choices = run.state.groupSize > 0 ? Math.min(run.state.groupSize, queue.length) : queue.length;

  let best: { index: number; side: Side; outcome: number } = {
    index: selected,
    side: 'left',
    outcome: Number.POSITIVE_INFINITY,
  };
  for (let index = 0; index < choices; index++) {
    const weight = weightOf(queue[index]!);
    for (const side of ['left', 'right'] as const) {
      const outcome = Math.abs(difference + (side === 'left' ? weight : -weight));
      if (outcome < best.outcome) best = { index, side, outcome };
    }
  }
  run.select(best.index);
  run.place(best.side);
};

/**
 * Plays the way the old arcade could be beaten: takes whatever is at the front
 * of the queue and drops it on the lighter side. No numbers consulted.
 */
const playByComparison = (run: Run): void => {
  if (run.state.queue.length === 0) return;
  run.select(0);
  run.place(run.snapshot().balanceDifference > 0 ? 'right' : 'left');
};

/**
 * Plays at a child's pace rather than a computer's: a placement roughly every
 * 1.6 seconds. It matters — a simulation that places every frame never holds
 * more than one animal, so it never has a choice to get right or wrong, and
 * would tell us nothing about whether the arithmetic is doing any work.
 */
const DELIBERATION_FRAMES = 96;

const playRound = (level: ArcadeLevelDef, strategy: (run: Run) => void, seed?: number, cap = 60 * 200) => {
  const run = createArcadeRun(withSeed(level, seed));
  let frames = 0;
  while (run.state.status === 'playing' && frames < cap) {
    run.tick(FRAME);
    frames += 1;
    if (run.state.status !== 'playing') break;
    if (frames % DELIBERATION_FRAMES === 0) strategy(run);
  }
  return { status: run.state.status, bells: run.state.bells, elapsed: run.state.elapsed };
};

describe('arcade levels', () => {
  const COUNTED = ARCADE_LEVELS.filter((level) => level.objective.kind === 'bells');

  it('is five Balance Rush levels after the five puzzles', () => {
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

  it('asks for more bells and bigger gaps as it goes', () => {
    const [six, seven] = COUNTED as [ArcadeLevelDef, ArcadeLevelDef];
    const bells = (level: ArcadeLevelDef) => (level.objective.kind === 'bells' ? level.objective.count : 0);
    expect(bells(seven)).toBeGreaterThanOrEqual(bells(six));
    expect(seven.arcade.seedGap![1]).toBeGreaterThan(six.arcade.seedGap![1]);
  });

  it('introduces families at level 8 and the weather at level 9', () => {
    expect(ARCADE_LEVELS.filter((level) => level.arcade.groupSize).map((level) => level.id)).toEqual([
      'level-8',
      'level-9',
      'level-10',
    ]);
    expect(ARCADE_LEVELS.filter((level) => level.arcade.wind).map((level) => level.id)).toEqual([
      'level-9',
      'level-10',
    ]);
  });

  it.each(COUNTED.map((level) => [level.id, level] as const))(
    '%s is won by working out which animal closes the gap',
    (_id, level) => {
      expect(playRound(level, playWithArithmetic).status).toBe('won');
    },
  );

  it.each(COUNTED.map((level) => [level.id, level] as const))(
    '%s is winnable from any seed, so the generator cannot deal a dead round',
    (_id, level) => {
      const losses: number[] = [];
      for (let seed = 1; seed <= 25; seed++) {
        if (playRound(level, playWithArithmetic, seed).status !== 'won') losses.push(seed);
      }
      expect(losses).toEqual([]);
    },
  );

  /**
   * The point of the redesign. The old arcade was won by "drop it on the
   * lighter side", which consults no numbers at all.
   *
   * The claim worth making is not that guessing always loses — squeezing the
   * clock hard enough for that also starts failing careful players on unlucky
   * seeds, and punishing a child for a bad shuffle is worse than letting a
   * guesser scrape through. The claim is that doing the sums is worth a lot:
   * it rings far more bells in the same time, which is what the clock then
   * turns into winning or not.
   */
  it.each(
    COUNTED.filter((level) => level.id !== 'level-6').map((level) => [level.id, level] as const),
  )('%s pays for doing the sums', (_id, level) => {
    const windowed: ArcadeLevelDef = { ...level, objective: { kind: 'endless' } };
    let thinking = 0;
    let guessing = 0;
    for (let seed = 1; seed <= 12; seed++) {
      thinking += playRound(windowed, playWithArithmetic, seed, 60 * 45).bells;
      guessing += playRound(windowed, playByComparison, seed, 60 * 45).bells;
    }
    expect(guessing).toBeGreaterThan(0);
    // Half again as many bells, at least, for the player who works it out.
    expect(thinking).toBeGreaterThan(guessing * 1.5);
  });

  it('leaves a guesser short of the bell count often enough to notice', () => {
    let shortfalls = 0;
    for (const level of COUNTED.filter((entry) => entry.id !== 'level-6')) {
      for (let seed = 1; seed <= 12; seed++) {
        if (playRound(level, playByComparison, seed).status !== 'won') shortfalls += 1;
      }
    }
    expect(shortfalls).toBeGreaterThan(0);
  });

  it('still cannot be won by ignoring it entirely', () => {
    for (const level of COUNTED) {
      expect(playRound(level, () => {}).status).toBe('lost');
    }
  });
});

describe('the endless park', () => {
  const park = ARCADE_LEVELS.find((level) => level.objective.kind === 'endless')!;

  it('has no bell target and no finish line', () => {
    const run = createArcadeRun(park);
    expect(run.bellTarget).toBeNull();
    expect(run.progress).toBeNull();
  });

  it('rings bells for as long as the player keeps up', () => {
    // A flawless player can in principle go on for a very long time, which is
    // the right reward; what matters is that the bells keep coming.
    const result = playRound(park, playWithArithmetic, undefined, 60 * 120);
    expect(result.bells).toBeGreaterThan(8);
  });

  it('rewards arithmetic with a longer run', () => {
    const thinking = playRound(park, playWithArithmetic, 4);
    const guessing = playRound(park, playByComparison, 4);
    expect(thinking.bells).toBeGreaterThan(guessing.bells);
  });
});
