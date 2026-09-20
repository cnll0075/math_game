import type { Rng } from '@bundle/core';
import type { Band } from './bands.data.js';

export type Op = '+' | '-';

/** The question on the fighter's fuselage. */
export interface Sum {
  left: number;
  op: Op;
  right: number;
  answer: number;
}

/** The biggest number anything in this game is allowed to reach. */
export const CEILING = 20;

/** U+2212, not a hyphen: at 64px a hyphen reads as a dash. */
export const sumText = (sum: Sum): string => `${sum.left} ${sum.op === '+' ? '+' : '−'} ${sum.right}`;

/** Every addition that makes this answer. Neither operand is ever zero. */
export const additionsFor = (answer: number): readonly Sum[] => {
  const sums: Sum[] = [];
  for (let left = 1; left < answer; left += 1) sums.push({ left, op: '+', right: answer - left, answer });
  return sums;
};

/** Every take-away that makes this answer without going over the ceiling. */
export const subtractionsFor = (answer: number): readonly Sum[] => {
  const sums: Sum[] = [];
  for (let left = answer + 1; left <= CEILING; left += 1) sums.push({ left, op: '-', right: left - answer, answer });
  return sums;
};

/** A number for a plane to wear, drawn from what this band allows. */
export const drawAnswer = (rng: Rng, band: Band): number => {
  if (rng.next() < band.easyMix) return 2 + rng.int(9);
  return band.answers.from + rng.int(band.answers.to - band.answers.from + 1);
};

/**
 * A sum for this answer, preferring operands already in the sky: asked about a
 * plane wearing 15 with a 7 aloft, the fighter shows `7 + 8`, so the sky baits
 * its own trap. Shooting an operand instead of the answer is the characteristic
 * error at this age, and it should be available to make.
 *
 * Null is unreachable for answers 1..20 — 1 has no addition and 20 has no
 * take-away, and each falls back to the other form — but the caller checks.
 */
export const writeSum = (rng: Rng, band: Band, answer: number, inTheSky: readonly number[]): Sum | null => {
  const wantsAddition = rng.next() < band.addMix;
  const preferred = wantsAddition ? additionsFor(answer) : subtractionsFor(answer);
  const other = wantsAddition ? subtractionsFor(answer) : additionsFor(answer);
  const pool = preferred.length > 0 ? preferred : other;
  if (pool.length === 0) return null;
  const baited = pool.filter((sum) => inTheSky.includes(sum.left) || inTheSky.includes(sum.right));
  return rng.pick(baited.length > 0 ? baited : pool);
};
