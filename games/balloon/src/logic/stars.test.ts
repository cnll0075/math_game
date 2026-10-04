import { describe, it, expect } from 'vitest';
import { recordStars, starsFor } from './stars.js';

describe('stars', () => {
  it('rewards working it out before letting go', () => {
    expect(starsFor(1)).toBe(3);
    expect(starsFor(2)).toBe(2);
    expect(starsFor(3)).toBe(1);
    expect(starsFor(9)).toBe(1);
  });

  it('keeps the best, and never takes stars away', () => {
    const book = recordStars({}, 'a', 2);
    expect(book).toEqual({ a: 2 });
    expect(recordStars(book, 'a', 1)).toEqual({ a: 2 });
    expect(recordStars(book, 'a', 3)).toEqual({ a: 3 });
  });

  it('does not change the book it was given', () => {
    const book = { a: 1 };
    recordStars(book, 'a', 3);
    expect(book).toEqual({ a: 1 });
  });
});
