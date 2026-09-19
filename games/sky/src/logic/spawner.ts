import type { Rng } from '@bundle/core';
import { answerSet, type Band } from './bands.data.js';
import { drawAnswer, type Sum } from './equation.js';
import { drawType } from './planes.js';
import type { Plane } from './sky-state.js';

/**
 * Whether a number is worth having in the sky while this sum is live: an
 * operand, or a near miss. Either forces the answer to be computed instead of
 * scanned for as the only plausible number up there.
 */
export const isTrapFor = (sum: Sum, value: number): boolean =>
  value !== sum.answer &&
  (value === sum.left || value === sum.right || Math.abs(value - sum.answer) <= 2);

export const hasTrap = (sum: Sum, aloft: readonly Plane[]): boolean =>
  aloft.some((plane) => isTrapFor(sum, plane.number));

/**
 * A trap to send up. An operand first — shooting the 7 when asked for 7 + 8 is
 * the characteristic error at this age, and it should be there to make — then a
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

export interface SpawnSpec {
  uid: string;
  number: number;
  elapsed: number;
  /** The tempo's fall time; the plane's own type stretches or shortens it. */
  fallSeconds: number;
  /** Where to fly, for an escort pair. Random within the playfield otherwise. */
  lane?: number;
}

export function spawnPlane(rng: Rng, spec: SpawnSpec): Plane {
  const type = drawType(rng, spec.elapsed);
  const free = 1 - 2 * type.halfWidth;
  const lane = spec.lane ?? type.halfWidth + rng.next() * free;
  return {
    uid: spec.uid,
    number: spec.number,
    type: type.id,
    progress: 0,
    fallSeconds: spec.fallSeconds / type.speed,
    lane: Math.min(1 - type.halfWidth, Math.max(type.halfWidth, lane)),
    phase: rng.next() * Math.PI * 2,
    age: 0,
    hits: 0,
    hidden: false,
    hideTimer: type.showSeconds,
  };
}

/**
 * The number the next plane wears. A live sum with no trap in the sky gets one
 * now; otherwise the band draws freely.
 */
export const nextNumber = (rng: Rng, band: Band, sum: Sum | null, aloft: readonly Plane[]): number =>
  sum && !hasTrap(sum, aloft) ? trapNumber(rng, sum, band) : drawAnswer(rng, band);
