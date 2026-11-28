import { describe, it, expect } from 'vitest';
import { playRound } from './bot.js';
import { LEVELS } from './levels.data.js';
import { starsFor } from './stars.js';
import { createTable } from './table.js';

describe('a player who reads the numbers', () => {
  it('finishes every round with three stars', () => {
    for (const level of LEVELS) {
      const table = createTable(level);
      playRound(table, 'best');
      expect(table.state.phase, level.id).toBe('done');
      expect(starsFor(level, table.state.shares), level.id).toBe(3);
    }
  });
});

describe('a player who only ever shares one at a time', () => {
  it('still finishes every round, with fewer stars where the dial was the quick way', () => {
    for (const level of LEVELS) {
      const table = createTable(level);
      playRound(table, 'ones');
      expect(table.state.phase, level.id).toBe('done');
    }
    const table = createTable(LEVELS.find((level) => level.id === 'three-plates')!);
    playRound(table, 'ones');
    expect(starsFor(table.state.def, table.state.shares)).toBe(1);
  });
});
