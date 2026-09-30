import { describe, it, expect } from 'vitest';
import { acrossNeed, hooksOf, problemsWith, tiedOf, type RescueDef } from './rescue-def.js';

const plain: RescueDef = { id: 'x', line: 'x', weight: 8, tray: [5, 3] };

describe('a rescue definition', () => {
  it('has six hooks and nothing tied unless it says otherwise', () => {
    expect(hooksOf(plain)).toBe(6);
    expect(tiedOf(plain)).toEqual([]);
    expect(hooksOf({ ...plain, hooks: 2 })).toBe(2);
  });

  it('counts the wind towards the ledge, and against it', () => {
    expect(acrossNeed({ ledge: 7, wind: 3, puffs: [] })).toBe(4);
    expect(acrossNeed({ ledge: 5, wind: -2, puffs: [] })).toBe(7);
  });

  it('finds nothing wrong with a sound rescue', () => {
    expect(problemsWith(plain)).toEqual([]);
  });

  it('rejects numbers outside the ranges the game draws', () => {
    expect(problemsWith({ ...plain, weight: 21 })).not.toEqual([]);
    expect(problemsWith({ ...plain, tray: [11] })).not.toEqual([]);
    expect(problemsWith({ ...plain, tray: [0] })).not.toEqual([]);
    expect(problemsWith({ ...plain, wind: { ledge: 7, wind: 3, puffs: [6] } })).not.toEqual([]);
    expect(problemsWith({ ...plain, hooks: 7 })).not.toEqual([]);
  });

  it('rejects more tied balloons than hooks, and a wind that does the whole job', () => {
    expect(problemsWith({ ...plain, hooks: 2, tied: [1, 1, 1] })).not.toEqual([]);
    expect(problemsWith({ ...plain, wind: { ledge: 3, wind: 3, puffs: [1] } })).not.toEqual([]);
  });
});
