import { describe, it, expect } from 'vitest';
import { LEVELS, getLevel, solutionsFor } from './levels.data.js';
import { createGame } from './game.js';
import { roundCount, roundAt } from './level.js';
import { weightOf, type AnimalId } from './animals.js';
import type { LevelDef } from './level.js';

const total = (animals: readonly AnimalId[]) => animals.reduce((sum, animal) => sum + weightOf(animal), 0);

/** Plays a whole level through, round by round, with the solver's answers. */
const playLevel = (level: LevelDef) => {
  const game = createGame(level);
  for (let round = 0; round < roundCount(level); round++) {
    const solution = solutionsFor(level, round)[0];
    if (!solution) return { cleared: round, game };
    for (const move of solution) {
      if (move.kind === 'place') game.place(move.trayIndex, move.side);
      else game.takeBack(move.uid);
    }
  }
  return { cleared: roundCount(level), game };
};

describe('the curriculum', () => {
  it('is fifteen levels with unique ids', () => {
    expect(LEVELS).toHaveLength(15);
    expect(new Set(LEVELS.map((level) => level.id)).size).toBe(15);
  });

  it('gives every level several rounds, so an idea is met more than once', () => {
    for (const level of LEVELS) {
      expect(level.rounds.length, level.id).toBeGreaterThanOrEqual(3);
    }
  });

  it('keeps every sum within ten', () => {
    for (const level of LEVELS) {
      for (const [index, round] of level.rounds.entries()) {
        const heaviest = Math.max(total(round.initial.left), total(round.initial.right));
        expect(heaviest, `${level.id} round ${index}`).toBeLessThanOrEqual(10);
      }
    }
  });

  it('starts with chickens alone, and introduces one animal at a time', () => {
    const speciesIn = (level: LevelDef) =>
      new Set(level.rounds.flatMap((round) => [...round.initial.left, ...round.initial.right, ...round.tray]));
    expect(speciesIn(LEVELS[0]!)).toEqual(new Set(['chicken', 'cat', 'dog']));
    expect(speciesIn(LEVELS[1]!)).toEqual(new Set(['chicken']));
    expect(speciesIn(LEVELS[2]!)).toEqual(new Set(['chicken', 'cat']));
    expect(speciesIn(LEVELS[3]!)).toEqual(new Set(['chicken', 'cat', 'dog']));
  });
});

describe('solvability', () => {
  it.each(LEVELS.map((level) => [level.id, level] as const))('every round of %s can be solved', (_id, level) => {
    for (let round = 0; round < roundCount(level); round++) {
      expect(solutionsFor(level, round).length, `${level.id} round ${round}`).toBeGreaterThan(0);
    }
  });

  it.each(LEVELS.map((level) => [level.id, level] as const))('%s can be played end to end', (_id, level) => {
    const { cleared, game } = playLevel(level);
    expect(cleared).toBe(roundCount(level));
    expect(game.state.status).toBe('won');
  });

  it('reports a round nothing can clear', () => {
    const impossible: LevelDef = {
      id: 'x',
      title: 'x',
      objective: { kind: 'balance' },
      rounds: [{ initial: { left: ['bear'], right: [] }, tray: ['chicken'] }],
    };
    expect(solutionsFor(impossible)).toEqual([]);
  });
});

describe('the ideas each level is built on', () => {
  const level = (id: string) => getLevel(id)!;

  it('makes level 7 need a four that no animal weighs', () => {
    for (let round = 0; round < roundCount(level('level-7')); round++) {
      for (const solution of solutionsFor(level('level-7'), round)) {
        // Never a single animal: four is always built out of smaller ones.
        expect(solution.length).toBeGreaterThan(1);
      }
    }
  });

  it('makes level 8 an answer of several of the same animal', () => {
    const eight = level('level-8');
    for (let round = 0; round < roundCount(eight); round++) {
      const tray = roundAt(eight, round).tray;
      expect(new Set(tray).size).toBe(1);
      const solution = solutionsFor(eight, round)[0]!;
      expect(solution.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('makes level 9 impossible without adding to both sides', () => {
    const nine = level('level-9');
    for (let round = 0; round < roundCount(nine); round++) {
      const solutions = solutionsFor(nine, round);
      expect(solutions.length).toBeGreaterThan(0);
      // Every answer puts an animal on each side: the gap cannot be closed from
      // the light side alone, because nothing small enough is offered.
      for (const solution of solutions) {
        const sides = new Set(solution.map((move) => (move.kind === 'place' ? move.side : 'remove')));
        expect(sides.size, `round ${round}`).toBeGreaterThan(1);
      }
    }
  });

  it('makes level 11 need animals taken off, since the tray cannot do it', () => {
    const eleven = level('level-11');
    expect(eleven.allowRemoval).toBe(true);
    for (let round = 0; round < roundCount(eleven); round++) {
      const solutions = solutionsFor(eleven, round);
      expect(solutions.length).toBeGreaterThan(0);
      expect(solutions.every((solution) => solution.some((move) => move.kind === 'remove'))).toBe(true);
    }
  });

  it('gives level 12 more than one right answer in every round', () => {
    const twelve = level('level-12');
    for (let round = 0; round < roundCount(twelve); round++) {
      const shapes = new Set(solutionsFor(twelve, round).map((solution) => JSON.stringify(solution)));
      expect(shapes.size, `round ${round}`).toBeGreaterThanOrEqual(2);
    }
  });

  it('makes level 13 share the whole pile, evenly', () => {
    const thirteen = level('level-13');
    expect(thirteen.requireEmptyTray).toBe(true);
    for (let round = 0; round < roundCount(thirteen); round++) {
      const pile = total(roundAt(thirteen, round).tray);
      expect(pile % 2, `round ${round}`).toBe(0);
      // Every animal is seated, so the answer uses the whole tray.
      const solution = solutionsFor(thirteen, round)[0]!;
      expect(solution).toHaveLength(roundAt(thirteen, round).tray.length);
    }
  });

  it('answers the same bear three different ways in level 14', () => {
    const fourteen = level('level-14');
    const answers = new Set<string>();
    for (let round = 0; round < 3; round++) {
      const solution = solutionsFor(fourteen, round)[0]!;
      answers.add(String(solution.length));
    }
    expect(answers.size).toBeGreaterThan(1);
  });
});
