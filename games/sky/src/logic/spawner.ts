import type { Rng } from '@bundle/core';
import { answerSet, type Band } from './bands.data.js';
import { drawAnswer, type Sum } from './equation.js';
import { drawType, PLANE_TYPES, type PlaneTypeId } from './planes.js';
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
  /** Where to fly, for an escort pair. Chosen within the playfield otherwise. */
  lane?: number;
  /** Lanes already busy near the top, so a new plane does not land on one. */
  avoid?: readonly number[];
  /**
   * Shortest fall this plane may have. Set when it is being sent up to be asked
   * about, so it cannot arrive already too fast to be a fair question.
   */
  minFallSeconds?: number;
  /** Force a type, for the halves a blimp bursts into. */
  type?: PlaneTypeId;
  /** Where down the screen it starts; halves carry on from where it burst. */
  progress?: number;
}

/** How many lanes to try before settling for the roomiest of them. */
const LANE_TRIES = 6;

/**
 * A lane with room in it. Picked at random, a new plane regularly came down on
 * top of one already flying, and two numbers in the same place cannot be read —
 * which in a game about reading the number is the whole game broken. So several
 * lanes are tried and the one furthest from its neighbours wins.
 */
const roomyLane = (rng: Rng, halfWidth: number, avoid: readonly number[]): number => {
  const free = 1 - 2 * halfWidth;
  let best = halfWidth + rng.next() * free;
  if (avoid.length === 0) return best;
  let bestGap = -1;
  for (let i = 0; i < LANE_TRIES; i += 1) {
    const candidate = halfWidth + rng.next() * free;
    const gap = Math.min(...avoid.map((lane) => Math.abs(candidate - lane)));
    if (gap > bestGap) {
      bestGap = gap;
      best = candidate;
    }
    // Two half-widths clear of everything is room enough; stop looking.
    if (bestGap > halfWidth * 2) break;
  }
  return best;
};

export function spawnPlane(rng: Rng, spec: SpawnSpec): Plane {
  const maxSpeed = spec.minFallSeconds ? spec.fallSeconds / spec.minFallSeconds : Infinity;
  const type = spec.type ? PLANE_TYPES[spec.type] : drawType(rng, spec.elapsed, maxSpeed);
  const lane = spec.lane ?? roomyLane(rng, type.halfWidth, spec.avoid ?? []);
  return {
    uid: spec.uid,
    number: spec.number,
    type: type.id,
    progress: spec.progress ?? 0,
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
