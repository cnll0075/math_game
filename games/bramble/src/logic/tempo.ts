import type { Rng } from '@bundle/core';

/**
 * How the path is paced. Elapsed time is the only input, so a player doing well
 * is not punished for it: skill shows up in the distance, not in the difficulty.
 */
export interface Tempo {
  /**
   * The shortest gap between two rows the game will ever ask for. This is the
   * fairness floor — the least time a player is ever given to read a sum and
   * pick a lane — and everything else is built as a multiple of it.
   */
  minGap: number;
  /** Seconds a row takes to travel from the horizon to the rabbit. */
  approachSeconds: number;
  /**
   * How hard the path is pressing, 0 to 1. Low means mostly breathers; high
   * means mostly tight. This is what makes the cadence pick up over a run.
   */
  pressure: number;
  /**
   * How far the long *gaps* reach past the floor. Kept modest even at the start:
   * an opening dominated by breathers reads as a game that has not begun.
   */
  gapSpread: number;
  /**
   * How far the slow *speeds* reach past the floor. Kept wide, because this is
   * the variation a player can actually see — one row drifting while another
   * closes up behind it — and it costs nothing in rhythm.
   */
  speedSpread: number;
  /** Chance a long enough gap carries a carrot. */
  berryChance: number;
}

/**
 * Bursts to full pace. The ramp is driven by what the player has *done*, not by
 * how long they have been sitting there: get good and the path answers back.
 * A child who is struggling never gets rushed, and one who is flying does.
 */
const RAMP_BURSTS = 60;
/**
 * How long a row takes to come down the path, as a multiple of the floor. Three
 * speeds, drawn per row.
 *
 * With one fixed speed and one row on the path at a time, every row looked
 * exactly like the last — appear at the horizon, travel down, land — and the
 * variation in the *gaps* was invisible, because there was never a second row
 * on screen to compare against. A row that visibly rushes and a row that
 * visibly drifts are variation a player can actually see.
 *
 * All three are at least the floor, so the slowest gap still cannot shorten the
 * time a child gets; and the slowest is twice the floor at most, so two rows on
 * the path is the ceiling and three never happens.
 */
const APPROACHES = {
  quick: 1.15,
  even: 1.8,
  slow: 2.4,
} as const;

export type Approach = keyof typeof APPROACHES;

/** The average, for anything that needs one number rather than a draw. */
const LOOK_AHEAD = APPROACHES.even;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));
const lerp = (from: number, to: number, t: number): number => from + (to - from) * t;
/** Ease out, so the first minute tightens gently and the third is brisk. */
const ease = (t: number): number => 1 - (1 - t) * (1 - t);

export function tempoAt(bursts: number): Tempo {
  const ramp = ease(clamp01(bursts / RAMP_BURSTS));
  const beyond = clamp01((bursts - RAMP_BURSTS) / RAMP_BURSTS);
  const minGap = lerp(2.4, 1.6, ramp) - 0.1 * beyond;
  return {
    minGap,
    approachSeconds: minGap * LOOK_AHEAD,
    pressure: clamp01(0.3 + 0.65 * ramp),
    // The gap spread narrows as the pace climbs, so the slowest stretch late in
    // a run is still brisker than the quickest stretch at the start. Without
    // that the ranges overlapped and no amount of ramping the average showed.
    gapSpread: lerp(0.35, 0.15, ramp),
    speedSpread: lerp(1, 0.55, ramp),
    berryChance: lerp(0.4, 0.22, ramp),
  };
}

/**
 * The shapes a gap comes in, as multiples of the floor. Rows arriving on an
 * even beat read as one long identical corridor however much you jitter the
 * beat; what makes a path feel like somewhere is phrasing — two close together,
 * then room to breathe, then a flurry.
 */
const GAP_SHAPES = {
  tight: 1.0,
  steady: 1.45,
  breather: 2.3,
} as const;

export type GapShape = keyof typeof GAP_SHAPES;

/** A gap is long enough for a carrot when it is more than a tight one. */
export const ROOMY_GAP = GAP_SHAPES.steady;

/**
 * Picks the next gap. As pressure rises the tight ones crowd out the breathers,
 * so the cadence picks up without the floor ever moving under the player.
 */
/** How long the next row should take to come down. */
export function drawApproach(rng: Rng, tempo: Tempo): { seconds: number; speed: Approach } {
  const speed = rng.pick(['quick', 'quick', 'even', 'slow', 'slow'] as const);
  const reach = 1 + (APPROACHES[speed] - 1) * tempo.speedSpread;
  return { seconds: tempo.minGap * reach, speed };
}

export function drawGap(rng: Rng, tempo: Tempo): { seconds: number; shape: GapShape } {
  const weights: [GapShape, number][] = [
    ['tight', 0.15 + tempo.pressure * 1.5],
    ['steady', 1],
    ['breather', 1.15 - tempo.pressure],
  ];
  const total = weights.reduce((sum, [, weight]) => sum + Math.max(0, weight), 0);
  let roll = rng.next() * total;
  let shape: GapShape = 'steady';
  for (const [name, weight] of weights) {
    roll -= Math.max(0, weight);
    if (roll <= 0) {
      shape = name;
      break;
    }
  }
  // A little wobble on top, so even two breathers in a row are not twins.
  const wobble = 1 + (rng.next() * 2 - 1) * 0.1;
  // The shape's reach past the floor shrinks as the pace climbs.
  const reach = 1 + (GAP_SHAPES[shape] - 1) * tempo.gapSpread;
  return { seconds: tempo.minGap * reach * wobble, shape };
}
