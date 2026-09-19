/**
 * How the sky tightens as a run goes on. Elapsed time is the only input: a
 * player doing well is not punished for it, so skill shows up in the score
 * rather than in the difficulty.
 */
export interface Tempo {
  /** Seconds a plain glider takes to fall from the spawn line to the escape line. */
  fallSeconds: number;
  /** How many planes the sky wants aloft. */
  aloft: number;
  /**
   * Fall time a plane must have left before a sum may ask about it. This is the
   * number that keeps the game arithmetic rather than reflex: a rising tempo
   * shrinks the margin for error, never the thinking time.
   */
  thinkSeconds: number;
  /** Gap between spawns, derived so the sky fills to `aloft` and stays there. */
  spawnEvery: number;
}

/** How long the run takes to reach full pace. */
const RAMP_SECONDS = 180;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));
const lerp = (from: number, to: number, t: number): number => from + (to - from) * t;
/** Ease out, so the first minute tightens gently and the third is brisk. */
const ease = (t: number): number => 1 - (1 - t) * (1 - t);

export function tempoAt(elapsed: number): Tempo {
  const ramp = ease(clamp01(elapsed / RAMP_SECONDS));
  // Past the ramp the sky keeps creeping towards the floor, so a very long run
  // still ends rather than settling into a comfortable plateau.
  const beyond = clamp01((elapsed - RAMP_SECONDS) / RAMP_SECONDS);
  const fallSeconds = lerp(13, 5.5, ramp) - 0.5 * beyond;
  const aloft = Math.round(lerp(4, 7, ramp));
  return { fallSeconds, aloft, thinkSeconds: lerp(5.5, 3, ramp), spawnEvery: fallSeconds / aloft };
}
