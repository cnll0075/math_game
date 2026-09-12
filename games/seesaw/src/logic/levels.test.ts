import { describe, it, expect } from 'vitest';
import { PUZZLE_LEVELS, getLevel, solutionsFor } from './levels.data.js';
import { createGame } from './game.js';
import type { LevelDef } from './level.js';

describe('level catalog', () => {
  it('defines five puzzle levels with unique ids', () => {
    expect(PUZZLE_LEVELS).toHaveLength(5);
    expect(new Set(PUZZLE_LEVELS.map((level) => level.id)).size).toBe(5);
    expect(PUZZLE_LEVELS.every((level) => level.mode === 'puzzle')).toBe(true);
  });

  it('looks a level up by id', () => {
    expect(getLevel('level-3')?.title).toBeTruthy();
    expect(getLevel('nope')).toBeUndefined();
  });

  it('keeps early levels to at most five animals a side', () => {
    for (const level of PUZZLE_LEVELS) {
      const most = level.initial.left.length + level.initial.right.length + level.tray.length;
      expect(most, level.id).toBeLessThanOrEqual(10);
    }
  });

  it('introduces animals gradually', () => {
    expect(new Set([...PUZZLE_LEVELS[0]!.initial.left, ...PUZZLE_LEVELS[0]!.tray])).toEqual(new Set(['rabbit']));
    expect(new Set([...PUZZLE_LEVELS[1]!.initial.left, ...PUZZLE_LEVELS[1]!.tray])).toEqual(new Set(['rabbit', 'cat']));
  });

  it('makes level 2 teach equivalence rather than matching', () => {
    const level = PUZZLE_LEVELS.find((entry) => entry.id === 'level-2')!;
    expect(level.tray).not.toContain('cat');
    for (const solution of solutionsFor(level)) expect(solution.length).toBeGreaterThanOrEqual(2);
  });
});

describe('solvability', () => {
  it.each(PUZZLE_LEVELS.map((level) => [level.id, level] as const))('%s is solvable from its tray', (_id, level) => {
    expect(solutionsFor(level).length).toBeGreaterThan(0);
  });

  it('level 4 accepts several different combinations', () => {
    const solutions = solutionsFor(PUZZLE_LEVELS.find((entry) => entry.id === 'level-4')!);
    const shapes = new Set(solutions.map((solution) => JSON.stringify(solution)));
    expect(shapes.size).toBeGreaterThanOrEqual(3);
  });

  it('every level can be driven to won by its own solution', () => {
    for (const level of PUZZLE_LEVELS) {
      const solution = solutionsFor(level)[0]!;
      const game = createGame(level);
      for (const move of solution) game.place(move.trayIndex, move.side);
      expect(game.state.status, level.id).toBe('won');
    }
  });

  it('reports no solution when the tray cannot reach the objective', () => {
    const impossible: LevelDef = {
      id: 'x',
      mode: 'puzzle',
      title: 'x',
      objective: { kind: 'tilt', target: 99 },
      initial: { left: [], right: [] },
      tray: ['rabbit'],
    };
    expect(solutionsFor(impossible)).toEqual([]);
  });

  it('finds the shortest solutions first', () => {
    const solutions = solutionsFor(PUZZLE_LEVELS[0]!);
    expect(solutions[0]!.length).toBeLessThanOrEqual(solutions.at(-1)!.length);
  });
});
