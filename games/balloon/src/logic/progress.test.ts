import { describe, it, expect } from 'vitest';
import { MAX_STARS, readBook, resumeIndex, startIndex, totalStars } from './progress.js';
import { RESCUES } from './levels.data.js';

const indexOf = (id: string) => RESCUES.findIndex((rescue) => rescue.id === id);

describe('progress', () => {
  it('opens a new player at the very first rescue', () => {
    expect(resumeIndex({})).toBe(0);
  });

  it('picks up at the first rescue without stars', () => {
    expect(resumeIndex({ 'first-flight-1': 3, 'first-flight-2': 1 })).toBe(2);
  });

  it('goes round again once everything has stars', () => {
    const all = Object.fromEntries(RESCUES.map((rescue) => [rescue.id, 3]));
    expect(resumeIndex(all)).toBe(0);
    expect(totalStars(all)).toBe(MAX_STARS);
  });

  it('opens a named rescue, or the first rescue of a named chapter', () => {
    expect(startIndex({}, 'pop-3')).toBe(indexOf('pop-3'));
    expect(startIndex({}, 'two-at-once')).toBe(indexOf('two-at-once-1'));
  });

  it('ignores a level it does not know and opens where the player left off', () => {
    expect(startIndex({ 'first-flight-1': 2 }, 'nonsense')).toBe(1);
  });

  it('survives saved stars that are damaged or out of date', () => {
    expect(readBook(null)).toEqual({});
    expect(readBook('3')).toEqual({});
    expect(readBook([3, 3])).toEqual({});
    expect(readBook({ 'first-flight-1': 'three', 'first-flight-2': 2, gone: 3, 'whoosh-1': 9 })).toEqual({
      'first-flight-2': 2,
      gone: 3,
    });
    expect(totalStars({ gone: 3 })).toBe(0);
  });
});
