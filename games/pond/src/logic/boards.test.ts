import { describe, it, expect } from 'vitest';
import { BOARDS, boardById, padsOf, pairsOf, starIndexOf } from './boards.data.js';

describe('the boards', () => {
  it('are the eight squares from 2×2 to 9×9', () => {
    expect(BOARDS.map((board) => board.size)).toEqual([2, 3, 4, 5, 6, 7, 8, 9]);
    expect(BOARDS.map((board) => board.id)).toEqual(['board-2', 'board-3', 'board-4', 'board-5', 'board-6', 'board-7', 'board-8', 'board-9']);
    expect(BOARDS[3]!.title).toBe('5 × 5');
  });

  it('keep sums within 10 on the two smallest, and within 20 after', () => {
    expect(BOARDS.map((board) => board.limit)).toEqual([10, 10, 20, 20, 20, 20, 20, 20]);
  });

  it('have the pads and pairs the spec lists', () => {
    expect(BOARDS.map(padsOf)).toEqual([4, 9, 16, 25, 36, 49, 64, 81]);
    expect(BOARDS.map(pairsOf)).toEqual([2, 4, 8, 12, 18, 24, 32, 40]);
  });

  it('put the free ★ in the very middle of an odd board, and none on an even one', () => {
    expect(starIndexOf(boardById('board-3')!)).toBe(4);
    expect(starIndexOf(boardById('board-9')!)).toBe(40);
    expect(starIndexOf(boardById('board-4')!)).toBeNull();
  });

  it('knows a board by its id, and nothing else', () => {
    expect(boardById('board-5')?.size).toBe(5);
    expect(boardById('board-10')).toBeUndefined();
  });
});
