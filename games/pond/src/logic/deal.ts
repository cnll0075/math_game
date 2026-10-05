import type { Rng } from '@bundle/core';
import { pairsOf, starIndexOf, type BoardDef } from './boards.data.js';
import { additionsFor, subtractionsFor, sumText, type Sum } from './sums.js';

/** One pad's card. `null` is the free ★, which matches nothing. */
export interface Card {
  sum: Sum | null;
}

function shuffle<T>(rng: Rng, items: T[]): T[] {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const other = rng.int(index + 1);
    [items[index], items[other]] = [items[other]!, items[index]!];
  }
  return items;
}

export const hasNearMiss = (values: readonly number[]): boolean => values.some((value) => values.includes(value + 1));

/**
 * The values a board asks about: spread as evenly over 2..limit as the board
 * allows, so a big board does not pile up on a few answers. From 4×4 up, at
 * least two of them sit next to each other, so a quick guess at a similar sum
 * can fail.
 */
function valuesFor(board: BoardDef, rng: Rng): number[] {
  const pool: number[] = [];
  for (let value = 2; value <= board.limit; value += 1) pool.push(value);
  const spread: number[] = [];
  while (spread.length < pairsOf(board)) spread.push(...shuffle(rng, [...pool]));
  const values = spread.slice(0, pairsOf(board));
  if (board.size >= 4 && !hasNearMiss(values)) {
    const first = values[0]!;
    values[values.length - 1] = first < board.limit ? first + 1 : first - 1;
  }
  return values;
}

/**
 * Two different sums for one value, neither already on the board: an addition
 * and a subtraction where both are left, so spotting two additions with the
 * same first number is never the way to a match.
 */
function pairFor(value: number, limit: number, used: Set<string>, rng: Rng): [Sum, Sum] {
  const fresh = (sums: Sum[]) => sums.filter((sum) => !used.has(sumText(sum)));
  const adds = fresh(additionsFor(value, limit));
  const subs = fresh(subtractionsFor(value, limit));
  const pair = adds.length > 0 && subs.length > 0 ? [rng.pick(adds), rng.pick(subs)] : shuffle(rng, [...adds, ...subs]).slice(0, 2);
  const [first, second] = pair;
  if (!first || !second) throw new Error(`no two fresh sums left for ${value}`);
  used.add(sumText(first));
  used.add(sumText(second));
  return [first, second];
}

/** A fresh board: every pair placed at random, the ★ (if any) in the middle. */
export function dealBoard(board: BoardDef, rng: Rng): Card[] {
  const used = new Set<string>();
  const cards: Card[] = valuesFor(board, rng).flatMap((value) => pairFor(value, board.limit, used, rng).map((sum) => ({ sum })));
  const dealt = shuffle(rng, cards);
  const star = starIndexOf(board);
  if (star !== null) dealt.splice(star, 0, { sum: null });
  return dealt;
}
