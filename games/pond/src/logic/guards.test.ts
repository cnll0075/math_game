import { describe, it, expect } from 'vitest';
import { createRng, type Rng } from '@bundle/core';
import { BOARDS, pairsOf } from './boards.data.js';
import { dealBoard } from './deal.js';
import { createGame, valueAt, type Game } from './game.js';
import { starsFor } from './stars.js';

const faceDown = (game: Game): number[] =>
  game.state.pads.flatMap((pad, index) => (!pad.up && pad.card.sum ? [index] : []));

/** Remembers every pad it has seen and works every sum out. */
function perfect(game: Game, rng: Rng): number {
  const seen = new Map<number, number>();
  const unseen = () => faceDown(game).filter((index) => !seen.has(index));
  while (!game.state.cleared) {
    const known = [...seen].filter(([index]) => !game.state.pads[index]!.matched);
    const pair = known.find(([index, value]) => known.some(([other, v]) => other !== index && v === value));
    if (pair) {
      const partner = known.find(([other, v]) => other !== pair[0] && v === pair[1])!;
      game.flip(pair[0]);
      game.flip(partner[0]);
      continue;
    }
    const pool = unseen();
    const first = pool[rng.int(pool.length)]!;
    game.flip(first);
    const value = valueAt(game.state, first)!;
    seen.set(first, value);
    const partner = known.find(([, v]) => v === value);
    if (partner) {
      game.flip(partner[0]);
      continue;
    }
    const rest = unseen();
    const second = rest[rng.int(rest.length)]!;
    game.flip(second);
    seen.set(second, valueAt(game.state, second)!);
    game.hide();
  }
  return game.state.misses;
}

/** Turns over two pads at random, every time, remembering nothing. */
function random(game: Game, rng: Rng): number {
  while (!game.state.cleared) {
    const pool = faceDown(game);
    const first = pool[rng.int(pool.length)]!;
    const rest = pool.filter((index) => index !== first);
    const second = rest[rng.int(rest.length)]!;
    game.flip(first);
    game.flip(second);
    game.hide();
  }
  return game.state.misses;
}

const averageStars = (bot: (game: Game, rng: Rng) => number, size: number, games: number): number => {
  const board = BOARDS.find((each) => each.size === size)!;
  let total = 0;
  for (let seed = 1; seed <= games; seed += 1) {
    const rng = createRng(seed);
    const game = createGame(board, dealBoard(board, rng));
    total += starsFor(bot(game, rng), pairsOf(board));
  }
  return total / games;
};

describe('memory and arithmetic are load-bearing', () => {
  it('a bot with perfect memory that works every sum out averages at least 2.5 stars on every board', () => {
    for (const board of BOARDS) expect(averageStars(perfect, board.size, 30), board.id).toBeGreaterThanOrEqual(2.5);
  });

  it('a bot that flips at random averages at most 1.5 stars on every board from 4×4 up', () => {
    for (const board of BOARDS.filter((each) => each.size >= 4)) {
      expect(averageStars(random, board.size, 10), board.id).toBeLessThanOrEqual(1.5);
    }
  });
});
