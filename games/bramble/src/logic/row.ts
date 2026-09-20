import type { Rng } from '@bundle/core';
import { answerSet, drawAnswer, isTrapFor, trapNumber, writeSum, type Band, type Sum } from '@bundle/math';
import { LANES } from './lanes.js';

/** What an obstacle looks like. Cosmetic: all three behave the same. */
export type ObstacleKind = 'rock' | 'bear' | 'log';

const KINDS: readonly ObstacleKind[] = ['rock', 'bear', 'log'];

export interface Row {
  readonly uid: string;
  /** One number per lane. Exactly one of them is the answer. */
  readonly numbers: readonly number[];
  readonly answerLane: number;
  readonly sum: Sum;
  readonly kinds: readonly ObstacleKind[];
  /** 0 at the horizon, 1 at the rabbit. */
  progress: number;
  approachSeconds: number;
  /** Set once the rabbit has met it, so it is only ever scored once. */
  resolved: boolean;
}

/** Seconds before this row reaches the rabbit. */
export const remaining = (row: Row): number => Math.max(0, (1 - row.progress) * row.approachSeconds);

/**
 * A wrong number for a lane: plausible, and not one already used in this row.
 * Two lanes wearing the same number would waste one of only three chances to
 * make the player read, and a number nobody could mistake for the answer lets
 * them pick by elimination without adding anything.
 */
const wrongNumber = (rng: Rng, band: Band, sum: Sum, taken: readonly number[]): number => {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const candidate = trapNumber(rng, sum, band);
    if (!taken.includes(candidate)) return candidate;
  }
  // Nothing plausible left that is not already up there: take the nearest
  // unused number the band allows rather than repeating one.
  const allowed = answerSet(band).filter((value) => !taken.includes(value) && value !== sum.answer);
  const nearest = [...allowed].sort((a, b) => Math.abs(a - sum.answer) - Math.abs(b - sum.answer))[0];
  return nearest ?? sum.answer;
};

export function buildRow(rng: Rng, band: Band, uid: string, approachSeconds: number): Row {
  const answer = drawAnswer(rng, band);
  // Nothing is "already in the sky" here as it is in Sky Patrol: the row is
  // built all at once, so the sum is written first and the lanes fill round it.
  const sum = writeSum(rng, band, answer, []) ?? { left: answer, op: '+' as const, right: 0, answer };
  const answerLane = rng.int(LANES);

  const numbers: number[] = [];
  for (let lane = 0; lane < LANES; lane += 1) {
    numbers.push(lane === answerLane ? answer : wrongNumber(rng, band, sum, numbers));
  }

  return {
    uid,
    numbers,
    answerLane,
    sum,
    kinds: numbers.map(() => rng.pick(KINDS)),
    progress: 0,
    approachSeconds,
    resolved: false,
  };
}

/** Whether a lane's number is one a player could plausibly mistake for the answer. */
export const isPlausible = (row: Row, lane: number): boolean =>
  lane === row.answerLane || isTrapFor(row.sum, row.numbers[lane] ?? -1);
