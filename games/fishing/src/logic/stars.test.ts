import { describe, it, expect } from 'vitest';
import { recordStars, starsFor } from './stars.js';

describe('stars', () => {
  it('come from time left: a third is three, a sixth is two', () => {
    expect(starsFor(20, 60)).toBe(3);
    expect(starsFor(19, 60)).toBe(2);
    expect(starsFor(10, 60)).toBe(2);
    expect(starsFor(9, 60)).toBe(1);
    expect(starsFor(0, 60)).toBe(1);
  });

  it('keep the best for each level', () => {
    expect(recordStars({ a: 3 }, 'a', 1)).toEqual({ a: 3 });
    expect(recordStars({ a: 1 }, 'a', 2)).toEqual({ a: 2 });
  });
});
