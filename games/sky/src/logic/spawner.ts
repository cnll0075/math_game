import type { Rng } from '@bundle/core';
import { drawAnswer, isTrapFor, trapNumber, type Band, type Sum } from '@bundle/math';
import { drawType, PLANE_TYPES, type PlaneTypeId } from './planes.js';
import type { Plane } from './sky-state.js';

export { isTrapFor, trapNumber } from '@bundle/math';

/** Whether anything currently aloft is a plausible wrong answer for this sum. */
export const hasTrap = (sum: Sum, aloft: readonly Plane[]): boolean =>
  aloft.some((plane) => isTrapFor(sum, plane.number));

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
