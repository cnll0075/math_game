import { describe, it, expect } from 'vitest';
import { hooksOf, kitsOf, problemsWith, tiedOf, weightsOf, type RescueDef } from './rescue-def.js';

const plain: RescueDef = { id: 'x', line: 'x', weight: 8, tray: [5, 3] };

describe('a rescue definition', () => {
  it('has six hooks and nothing tied unless it says otherwise', () => {
    expect(hooksOf(plain)).toBe(6);
    expect(tiedOf(plain)).toEqual([]);
    expect(hooksOf({ ...plain, hooks: 2 })).toBe(2);
  });

  it('has one kit, or two when a friend shares the tray', () => {
    expect(weightsOf(plain)).toEqual([8]);
    expect(kitsOf(plain)).toBe(1);
    expect(weightsOf({ ...plain, friend: 5 })).toEqual([8, 5]);
    expect(kitsOf({ ...plain, friend: 5 })).toBe(2);
  });

  it('finds nothing wrong with a sound rescue', () => {
    expect(problemsWith(plain)).toEqual([]);
    expect(problemsWith({ ...plain, friend: 5 })).toEqual([]);
  });

  it('rejects numbers outside the ranges the game draws', () => {
    expect(problemsWith({ ...plain, weight: 21 })).not.toEqual([]);
    expect(problemsWith({ ...plain, friend: 0 })).not.toEqual([]);
    expect(problemsWith({ ...plain, friend: 21 })).not.toEqual([]);
    expect(problemsWith({ ...plain, tray: [11] })).not.toEqual([]);
    expect(problemsWith({ ...plain, tray: [0] })).not.toEqual([]);
    expect(problemsWith({ ...plain, hooks: 7 })).not.toEqual([]);
  });

  it('rejects more tied balloons than hooks', () => {
    expect(problemsWith({ ...plain, hooks: 2, tied: [1, 1, 1] })).not.toEqual([]);
  });
});
