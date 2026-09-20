import type { Rng } from '@bundle/core';
import { LANES } from './lanes.js';

/**
 * The latest point in the gap between rows at which a berry may land, as a
 * share of that gap. At a half, there is always at least half a gap left
 * afterwards — time to reach any lane before the next row. The choice a berry
 * offers is whether to bother, never whether to survive.
 */
export const BERRY_LATEST_SHARE = 0.5;

export interface Berry {
  readonly uid: string;
  readonly lane: number;
  /** 0 at the horizon, 1 at the rabbit. */
  progress: number;
  approachSeconds: number;
  taken: boolean;
}

export function makeBerry(rng: Rng, uid: string, approachSeconds: number): Berry {
  return { uid, lane: rng.int(LANES), progress: 0, approachSeconds, taken: false };
}
