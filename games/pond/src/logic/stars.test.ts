import { describe, it, expect } from 'vitest';
import { recordStars, starsFor } from './stars.js';

describe('stars', () => {
  it('come from misses against pairs', () => {
    expect(starsFor(0, 8)).toBe(3);
    expect(starsFor(8, 8)).toBe(3);
    expect(starsFor(9, 8)).toBe(2);
    expect(starsFor(16, 8)).toBe(2);
    expect(starsFor(17, 8)).toBe(1);
  });

  it('keep the best, and never take stars away', () => {
    const book = recordStars({}, 'a', 2);
    expect(recordStars(book, 'a', 1)).toEqual({ a: 2 });
    expect(recordStars(book, 'a', 3)).toEqual({ a: 3 });
  });
});
