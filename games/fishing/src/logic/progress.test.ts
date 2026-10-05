import { describe, it, expect } from 'vitest';
import { LEVELS } from './levels.data.js';
import { MAX_STARS, readBook, startIndex, totalStars } from './progress.js';

describe('progress', () => {
  it('reads only sensible stars from storage', () => {
    expect(readBook(null)).toEqual({});
    expect(readBook([1])).toEqual({});
    expect(readBook({ a: 2, b: 7, c: 'x', d: 0 })).toEqual({ a: 2 });
  });

  it('opens on the first level without stars, a level from the URL, or the start again', () => {
    expect(startIndex({})).toBe(0);
    expect(startIndex({ [LEVELS[0]!.id]: 2 })).toBe(1);
    expect(startIndex({}, 'jellyfish')).toBe(LEVELS.findIndex((level) => level.id === 'jellyfish'));
    expect(startIndex({}, 'nonsense')).toBe(0);
    const all = Object.fromEntries(LEVELS.map((level) => [level.id, 1]));
    expect(startIndex(all)).toBe(0);
  });

  it('counts stars against three a level', () => {
    expect(totalStars({ [LEVELS[0]!.id]: 3, other: 3 })).toBe(3);
    expect(MAX_STARS).toBe(LEVELS.length * 3);
  });
});
