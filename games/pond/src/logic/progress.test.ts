import { describe, it, expect } from 'vitest';
import { isOpen, MAX_STARS, readBook, resumeIndex, startIndex, totalStars } from './progress.js';

describe('progress', () => {
  it('opens only the first board for a new player', () => {
    expect(isOpen({}, 0)).toBe(true);
    expect(isOpen({}, 1)).toBe(false);
    expect(resumeIndex({})).toBe(0);
  });

  it('opens the next board once the last is finished, and resumes there', () => {
    const book = { 'board-2': 2 };
    expect(isOpen(book, 1)).toBe(true);
    expect(isOpen(book, 2)).toBe(false);
    expect(resumeIndex(book)).toBe(1);
  });

  it('stays on the summit once every board has stars', () => {
    const all = Object.fromEntries([2, 3, 4, 5, 6, 7, 8, 9].map((size) => [`board-${size}`, 3]));
    expect(resumeIndex(all)).toBe(7);
    expect(totalStars(all)).toBe(MAX_STARS);
  });

  it('opens a board named in the URL, and ignores one it does not know', () => {
    expect(startIndex({}, 'board-5')).toBe(3);
    expect(startIndex({ 'board-2': 1 }, 'board-12')).toBe(1);
  });

  it('survives saved stars that are damaged or out of date', () => {
    expect(readBook(null)).toEqual({});
    expect(readBook('3')).toEqual({});
    expect(readBook([1])).toEqual({});
    expect(readBook({ 'board-2': 'three', 'board-3': 2, 'board-4': 9 })).toEqual({ 'board-3': 2 });
  });
});
