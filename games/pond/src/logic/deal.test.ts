import { describe, it, expect } from 'vitest';
import { createRng } from '@bundle/core';
import { BOARDS, padsOf, pairsOf, starIndexOf } from './boards.data.js';
import { dealBoard, hasNearMiss, type Card } from './deal.js';
import { additionsFor, subtractionsFor, sumText, valueOf } from './sums.js';

const SEEDS = Array.from({ length: 25 }, (_, index) => index + 1);
const sumsOf = (cards: Card[]) => cards.flatMap((card) => (card.sum ? [card.sum] : []));

describe('dealing a board', () => {
  it('lays out every pad, with the ★ in the middle of an odd board', () => {
    for (const board of BOARDS) {
      const cards = dealBoard(board, createRng(1));
      expect(cards, board.id).toHaveLength(padsOf(board));
      expect(sumsOf(cards), board.id).toHaveLength(pairsOf(board) * 2);
      const star = starIndexOf(board);
      if (star !== null) expect(cards[star]!.sum, board.id).toBeNull();
    }
  });

  it('writes only sums within the board\'s limit, every number at least 1, every value at least 2', () => {
    for (const board of BOARDS) {
      for (const seed of SEEDS) {
        for (const sum of sumsOf(dealBoard(board, createRng(seed)))) {
          expect(sum.a, board.id).toBeGreaterThanOrEqual(1);
          expect(sum.b, board.id).toBeGreaterThanOrEqual(1);
          expect(valueOf(sum), board.id).toBe(sum.value);
          expect(sum.value, board.id).toBeGreaterThanOrEqual(2);
          expect(sum.value, board.id).toBeLessThanOrEqual(board.limit);
          expect(Math.max(sum.a, sum.b, sum.value), board.id).toBeLessThanOrEqual(board.limit);
        }
      }
    }
  });

  it('never writes two cards the same', () => {
    for (const board of BOARDS) {
      for (const seed of SEEDS) {
        const texts = sumsOf(dealBoard(board, createRng(seed))).map(sumText);
        expect(new Set(texts).size, `${board.id} seed ${seed}`).toBe(texts.length);
      }
    }
  });

  it('puts every value down an even number of times, so the pond can always be cleared', () => {
    for (const board of BOARDS) {
      for (const seed of SEEDS) {
        const counts = new Map<number, number>();
        for (const sum of sumsOf(dealBoard(board, createRng(seed)))) counts.set(sum.value, (counts.get(sum.value) ?? 0) + 1);
        for (const [value, count] of counts) expect(count % 2, `${board.id} seed ${seed} value ${value}`).toBe(0);
      }
    }
  });

  it('pairs an addition with a subtraction wherever the value has both to give', () => {
    for (const board of BOARDS) {
      for (const seed of SEEDS) {
        const sums = sumsOf(dealBoard(board, createRng(seed)));
        const values = new Set(sums.map((sum) => sum.value));
        for (const value of values) {
          const ofValue = sums.filter((sum) => sum.value === value);
          const pairs = ofValue.length / 2;
          if (additionsFor(value, board.limit).length < pairs || subtractionsFor(value, board.limit).length < pairs) continue;
          const adds = ofValue.filter((sum) => sum.op === '+').length;
          expect(adds, `${board.id} seed ${seed} value ${value}`).toBe(pairs);
        }
      }
    }
  });

  it('puts near misses on every board of 4×4 or more', () => {
    for (const board of BOARDS.filter((each) => each.size >= 4)) {
      for (const seed of SEEDS) {
        const values = [...new Set(sumsOf(dealBoard(board, createRng(seed))).map((sum) => sum.value))];
        expect(hasNearMiss(values), `${board.id} seed ${seed}`).toBe(true);
      }
    }
  });

  it('deals the same board from the same seed, and a different one from another', () => {
    const board = BOARDS[2]!;
    const texts = (seed: number) => dealBoard(board, createRng(seed)).map((card) => (card.sum ? sumText(card.sum) : '★'));
    expect(texts(7)).toEqual(texts(7));
    expect(texts(7)).not.toEqual(texts(8));
  });
});
