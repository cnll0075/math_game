import type { Rng } from '@bundle/core';

export type PlaneTypeId = 'glider' | 'weaver' | 'blimp' | 'scout' | 'hider' | 'treasure';

/**
 * A kind of plane. Each one is a different *reason* to be hard — thumbs, time,
 * commitment, memory — so the ramp is never merely "faster".
 *
 * Sizes are fractions of the playfield, and they are the hit box: the view
 * draws a plane from these numbers rather than keeping its own, so what a child
 * aims at and what the shell collides with can never drift apart.
 */
export interface PlaneType {
  id: PlaneTypeId;
  label: string;
  /** Multiplies the tempo's fall speed: 1.8 falls nearly twice as fast. */
  speed: number;
  /** Shots needed to bring it down. */
  hits: number;
  /** Seconds into a run before it may appear. */
  from: number;
  /** How likely it is against the other types that have arrived. */
  weight: number;
  halfWidth: number;
  halfHeight: number;
  /** Sideways sway, as a fraction of the playfield's width. */
  sway: number;
  /** Sways per second. */
  swayHz: number;
  /** Seconds its number is hidden at a time; 0 never hides it. */
  hideSeconds: number;
  /** Seconds its number shows between hides. */
  showSeconds: number;
}

export const PLANE_TYPES: Record<PlaneTypeId, PlaneType> = {
  // Straight down, steady, readable. The plane everything else is measured against.
  glider: { id: 'glider', label: 'Glider', speed: 1, hits: 1, from: 0, weight: 5, halfWidth: 0.055, halfHeight: 0.045, sway: 0, swayHz: 0, hideSeconds: 0, showSeconds: 0 },
  // Falls in an S. The number is plain; lining up is the work — so it delays a
  // child who knows the answer and never punishes them for knowing it.
  weaver: { id: 'weaver', label: 'Weaver', speed: 1, hits: 1, from: 30, weight: 3, halfWidth: 0.05, halfHeight: 0.042, sway: 0.12, swayHz: 0.35, hideSeconds: 0, showSeconds: 0 },
  // Slow, big, and it bursts into two planes whose numbers add up to the one it
  // was wearing. Three hits on the same answer was three identical taps; this
  // way the big one is a sum coming apart in front of you.
  blimp: { id: 'blimp', label: 'Blimp', speed: 0.55, hits: 1, from: 50, weight: 2, halfWidth: 0.085, halfHeight: 0.06, sway: 0.02, swayHz: 0.15, hideSeconds: 0, showSeconds: 0 },
  // The type that genuinely threatens a heart. The fair window still applies, so
  // a scout you are asked about is always winnable.
  scout: { id: 'scout', label: 'Scout', speed: 1.8, hits: 1, from: 75, weight: 2, halfWidth: 0.045, halfHeight: 0.035, sway: 0, swayHz: 0, hideSeconds: 0, showSeconds: 0 },
  // Ducks behind cloud, so the player must remember which plane was the 15.
  hider: { id: 'hider', label: 'Cloud-hider', speed: 0.9, hits: 1, from: 110, weight: 2, halfWidth: 0.055, halfHeight: 0.045, sway: 0.05, swayHz: 0.2, hideSeconds: 1.2, showSeconds: 1.6 },
  // Rare, golden, and wearing a heart: shoot it when the sum asks for it and you
  // get one back. Gold used to be the weaver's paint job, which promised a
  // reward the game never paid.
  treasure: { id: 'treasure', label: 'Treasure', speed: 0.8, hits: 1, from: 60, weight: 1, halfWidth: 0.06, halfHeight: 0.05, sway: 0.03, swayHz: 0.18, hideSeconds: 0, showSeconds: 0 },
};

/** Arrival order, which is also the order the catalog is read in. */
export const PLANE_IDS: readonly PlaneTypeId[] = ['glider', 'weaver', 'blimp', 'scout', 'hider', 'treasure'];

export const typesAt = (elapsed: number): readonly PlaneType[] =>
  PLANE_IDS.map((id) => PLANE_TYPES[id]).filter((type) => elapsed >= type.from);

/**
 * A type to send up. `maxSpeed` keeps the fast ones out when the plane is being
 * spawned to be asked about: a scout's fall is short enough that late in a run
 * it would arrive already outside the fair window, and the game would be asking
 * a question it had not left time to answer.
 */
export function drawType(rng: Rng, elapsed: number, maxSpeed = Infinity): PlaneType {
  const arrived = typesAt(elapsed);
  const slow = arrived.filter((type) => type.speed <= maxSpeed);
  const available = slow.length > 0 ? slow : [PLANE_TYPES.glider];
  const total = available.reduce((sum, type) => sum + type.weight, 0);
  let roll = rng.next() * total;
  for (const type of available) {
    roll -= type.weight;
    if (roll <= 0) return type;
  }
  return available[0] ?? PLANE_TYPES.glider;
}
