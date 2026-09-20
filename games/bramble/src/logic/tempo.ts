/**
 * How the path tightens as a run goes on. Elapsed time is the only input, so a
 * player doing well is not punished for it: skill shows up in the distance, not
 * in the difficulty.
 *
 * The ramp is in reading speed rather than reaction time. The rabbit steers as
 * quickly as it ever did; what shrinks is how long a row's numbers are on
 * screen before the rabbit reaches them.
 */
export interface Tempo {
  /** Seconds between one row and the next. */
  rowEvery: number;
  /** Seconds a row takes to travel from the horizon to the rabbit. */
  approachSeconds: number;
  /** Chance a gap between rows carries a berry. */
  berryChance: number;
}

const RAMP_SECONDS = 180;
/** More than one row on the path at a time, so the next can be read early. */
const LOOK_AHEAD = 1.6;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));
const lerp = (from: number, to: number, t: number): number => from + (to - from) * t;
/** Ease out, so the first minute tightens gently and the third is brisk. */
const ease = (t: number): number => 1 - (1 - t) * (1 - t);

export function tempoAt(elapsed: number): Tempo {
  const ramp = ease(clamp01(elapsed / RAMP_SECONDS));
  // Past the ramp it keeps creeping towards the floor, so a very long run still
  // asks more of the player rather than settling into a plateau.
  const beyond = clamp01((elapsed - RAMP_SECONDS) / RAMP_SECONDS);
  const rowEvery = lerp(3.5, 1.8, ramp) - 0.2 * beyond;
  return {
    rowEvery,
    approachSeconds: rowEvery * LOOK_AHEAD,
    berryChance: lerp(0.33, 0.2, ramp),
  };
}
