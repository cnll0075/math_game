import type { Rng } from '@bundle/core';
import { answerSet, type Band } from './bands.data.js';
import type { Sum } from './equation.js';

/**
 * Whether a number is worth putting in front of a player while this sum is
 * live: an operand, or a near miss. Either forces the answer to be computed
 * instead of picked out as the only plausible number on screen.
 */
export const isTrapFor = (sum: Sum, value: number): boolean =>
  value !== sum.answer &&
  (value === sum.left || value === sum.right || Math.abs(value - sum.answer) <= 2);

/**
 * A trap to use. An operand first — taking the 7 when asked for 7 + 8 is the
 * characteristic error at this age, and it should be there to make — then a
 * near miss, then anything the band allows rather than nothing at all.
 */
export const trapNumber = (rng: Rng, sum: Sum, band: Band): number => {
  const allowed = answerSet(band);
  const operands = [sum.left, sum.right].filter((value) => isTrapFor(sum, value) && allowed.includes(value));
  if (operands.length > 0) return rng.pick(operands);
  const nearby = [sum.answer - 1, sum.answer + 1, sum.answer - 2, sum.answer + 2].filter(
    (value) => allowed.includes(value) && isTrapFor(sum, value),
  );
  return nearby.length > 0 ? rng.pick(nearby) : rng.pick(allowed);
};
