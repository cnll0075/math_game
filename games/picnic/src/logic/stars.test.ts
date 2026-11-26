import { describe, it, expect } from 'vitest';
import { LEVELS } from './levels.data.js';
import { bestShares, recordStars, starsFor } from './stars.js';

const level = (id: string) => LEVELS.find((entry) => entry.id === id)!;

describe('stars', () => {
  it('count the dial shares a round needs at best: one a course', () => {
    expect(bestShares(level('two-friends'))).toBe(0);
    expect(bestShares(level('the-dial'))).toBe(1);
    expect(bestShares(level('who-can-come'))).toBe(1);
    expect(bestShares(level('pizza-halves'))).toBe(0);
    expect(bestShares(level('picnic-party'))).toBe(2);
  });

  it('give three for the fewest shares, two for one more, and never less than one', () => {
    expect(starsFor(level('the-dial'), 1)).toBe(3);
    expect(starsFor(level('the-dial'), 2)).toBe(2);
    expect(starsFor(level('the-dial'), 9)).toBe(1);
    expect(starsFor(level('picnic-party'), 3)).toBe(2);
  });

  it('give three for finishing a round shared by tapping or cutting', () => {
    expect(starsFor(level('two-friends'), 0)).toBe(3);
    expect(starsFor(level('cake-quarters'), 0)).toBe(3);
  });

  it('keep the best a round has had', () => {
    expect(recordStars({ a: 2 }, 'a', 1)).toEqual({ a: 2 });
    expect(recordStars({ a: 2 }, 'a', 3)).toEqual({ a: 3 });
  });
});
