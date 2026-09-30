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
  /** Chance a long enough gap carries a carrot. */
  berryChance: number;
}

const RAMP_SECONDS = 180;
/**
 * A row is visible for this many of its own shortest gaps before it lands. It
 * has to exceed the longest gap the game can draw (a breather, plus its
 * wobble), or a breather would leave the path empty and the rabbit with no sum
 * on its sign at all.
 */
const LOOK_AHEAD = 2.75;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));
const lerp = (from: number, to: number, t: number): number => from + (to - from) * t;
/** Ease out, so the first minute tightens gently and the third is brisk. */
const ease = (t: number): number => 1 - (1 - t) * (1 - t);

export function tempoAt(elapsed: number): Tempo {
  const ramp = ease(clamp01(elapsed / RAMP_SECONDS));
  const beyond = clamp01((elapsed - RAMP_SECONDS) / RAMP_SECONDS);
  const minGap = lerp(2.4, 1.3, ramp) - 0.15 * beyond;
  return {
    minGap,
    approachSeconds: minGap * LOOK_AHEAD,
    pressure: clamp01(0.15 + 0.78 * ramp),
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
  steady: 1.5,
  breather: 2.35,
} as const;

export type GapShape = keyof typeof GAP_SHAPES;

/** A gap is long enough for a carrot when it is more than a tight one. */
export const ROOMY_GAP = GAP_SHAPES.steady;

/**
 * Picks the next gap. As pressure rises the tight ones crowd out the breathers,
 * so the cadence picks up without the floor ever moving under the player.
 */
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
  return { seconds: tempo.minGap * GAP_SHAPES[shape] * wobble, shape };
}
