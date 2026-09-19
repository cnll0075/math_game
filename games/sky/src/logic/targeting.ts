import type { Rng } from '@bundle/core';
import { remaining, type Plane } from './sky-state.js';

/**
 * The planes a sum may fairly ask about: those with at least the tempo's
 * thinking time left to fall. A freshly spawned plane always qualifies, which is
 * what lets the run send one up when the sky has nothing askable in it.
 */
export const eligible = (aloft: readonly Plane[], thinkSeconds: number): readonly Plane[] =>
  aloft.filter((plane) => remaining(plane) >= thinkSeconds);

/**
 * Which plane the next sum asks about.
 *
 * Urgency is weighted rather than absolute. The plane furthest down is likeliest,
 * so the pressure is real and the game naturally asks about planes before they
 * get away — but it is not certain, so "shoot the lowest one" never becomes a
 * strategy that works without reading a number. That is the failure the Seesaw
 * arcade half was cut for, and this weighting is where it is designed out.
 */
export function chooseTarget(rng: Rng, aloft: readonly Plane[], thinkSeconds: number): Plane | null {
  const pool = [...eligible(aloft, thinkSeconds)].sort((a, b) => b.progress - a.progress);
  if (pool.length === 0) return null;
  const weights = pool.map((_, index) => 1 / (index + 1));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let roll = rng.next() * total;
  for (let i = 0; i < pool.length; i += 1) {
    roll -= weights[i]!;
    if (roll <= 0) return pool[i]!;
  }
  return pool[0]!;
}
