import { describe, it, expect } from 'vitest';
import { boardById } from './boards.data.js';
import type { Card } from './deal.js';
import { createGame } from './game.js';

const sum = (a: number, op: '+' | '−', b: number): Card => ({ sum: { a, op, b, value: op === '+' ? a + b : a - b } });
// A 2×2 board: 3 + 4 and 9 − 2 are 7; 2 + 3 and 6 − 1 are 5.
const twoByTwo = (): Card[] => [sum(3, '+', 4), sum(2, '+', 3), sum(6, '−', 1), sum(9, '−', 2)];
const board2 = boardById('board-2')!;

describe('a board in play', () => {
  it('flips a pad up', () => {
    const game = createGame(board2, twoByTwo());
    expect(game.flip(0)).toEqual([{ type: 'flipped', index: 0 }]);
    expect(game.state.pads[0]!.up).toBe(true);
    expect(game.state.first).toBe(0);
  });

  it('keeps two equal pads up, and counts no miss', () => {
    const game = createGame(board2, twoByTwo());
    game.flip(0);
    expect(game.flip(3)).toEqual([
      { type: 'flipped', index: 3 },
      { type: 'matched', a: 0, b: 3, value: 7 },
    ]);
    expect(game.state.pads[0]!.matched && game.state.pads[3]!.matched).toBe(true);
    expect(game.state.misses).toBe(0);
  });

  it('counts a miss for two unequal pads, holds them up, and puts them back when told', () => {
    const game = createGame(board2, twoByTwo());
    game.flip(0);
    expect(game.flip(1)).toEqual([
      { type: 'flipped', index: 1 },
      { type: 'missed', a: 0, b: 1 },
    ]);
    expect(game.state.misses).toBe(1);
    expect(game.state.pending).toEqual([0, 1]);
    expect(game.hide()).toEqual([{ type: 'hidden', a: 0, b: 1 }]);
    expect(game.state.pads[0]!.up || game.state.pads[1]!.up).toBe(false);
    expect(game.hide()).toEqual([]);
  });

  it('puts a missed pair back at once when another pad is tapped, and counts the tap', () => {
    const game = createGame(board2, twoByTwo());
    game.flip(0);
    game.flip(1);
    expect(game.flip(2)).toEqual([
      { type: 'hidden', a: 0, b: 1 },
      { type: 'flipped', index: 2 },
    ]);
    expect(game.state.first).toBe(2);
  });

  it('ignores a second tap on the same pad', () => {
    const game = createGame(board2, twoByTwo());
    game.flip(0);
    expect(game.flip(0)).toEqual([]);
    expect(game.state.first).toBe(0);
    expect(game.state.misses).toBe(0);
  });

  it('ignores a tap on a matched pad, and a second tap on the same pad', () => {
    const game = createGame(board2, twoByTwo());
    game.flip(0);
    game.flip(3); // 7 and 7: matched
    game.flip(1);
    expect(game.flip(0)).toEqual([]);
    expect(game.state.first).toBe(1);
    expect(game.flip(1)).toEqual([]);
    expect(game.state.misses).toBe(0);
  });

  it('ends the board when every pad but the ★ is up, and then takes no more taps', () => {
    const game = createGame(board2, twoByTwo());
    game.flip(0);
    game.flip(3);
    game.flip(1);
    expect(game.flip(2)).toEqual([
      { type: 'flipped', index: 2 },
      { type: 'matched', a: 1, b: 2, value: 5 },
      { type: 'cleared', misses: 0 },
    ]);
    expect(game.flip(0)).toEqual([]);
  });

  it('starts the ★ face up and lets nobody tap it', () => {
    const board3 = boardById('board-3')!;
    const cards: Card[] = [
      sum(1, '+', 1), sum(3, '−', 1), sum(1, '+', 2), sum(4, '−', 1),
      { sum: null },
      sum(1, '+', 3), sum(5, '−', 1), sum(1, '+', 4), sum(6, '−', 1),
    ];
    const game = createGame(board3, cards);
    expect(game.state.pads[4]!.up).toBe(true);
    expect(game.flip(4)).toEqual([]);
  });
});
