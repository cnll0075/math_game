import type { Point } from '@bundle/core';
import type { Outcome } from '../logic/outcome.js';
import { LAYOUT } from './geometry.js';

export type Mood = 'calm' | 'strain' | 'wheee' | 'happy';

export interface Pose {
  at: Point;
  parachute: boolean;
  mood: Mood;
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));
const ease = (t: number): number => t * t * (3 - 2 * t);
const lerp = (from: number, to: number, t: number): number => from + (to - from) * t;
/** How far through the stretch from `from` to `to` the clock is, 0..1. */
const during = (t: number, from: number, to: number): number => clamp01((t - from) / (to - from));

/**
 * Where a kit is, `t` of the way through its flight, given where it stands and
 * where it would land. A function of the outcome and nothing else, so the flight
 * is drawn from state rather than simulated — a flight can never disagree with
 * the verdict it shows. `land` is false when another kit was wrong, so a right
 * kit is shown off and brought home rather than left on the ledge alone.
 */
export function flightPose(outcome: Outcome, rawT: number, home: Point, spot: Point, land = true): Pose {
  const t = clamp01(rawT);

  if (outcome.verdict === 'short') {
    // A strain and a hop: how nearly there it was shows in how high the hop is.
    const through = clamp01(t / 0.8);
    const height = through >= 1 ? 0 : Math.sin(Math.PI * through) * (8 + 32 * clamp01(outcome.have / outcome.need));
    return { at: { x: home.x, y: home.y - height }, parachute: false, mood: 'strain' };
  }

  if (outcome.verdict === 'over') {
    // Whoosh past the ledge and off the top, then a parachute home.
    if (t < 0.45) {
      const up = ease(during(t, 0, 0.35));
      return { at: { x: home.x + Math.sin(t * 14) * 6, y: lerp(home.y, -200, up) }, parachute: false, mood: 'wheee' };
    }
    const down = ease(during(t, 0.45, 1));
    return { at: { x: home.x, y: lerp(-150, home.y, down) }, parachute: true, mood: 'calm' };
  }

  const hover = LAYOUT.ledgeY - 14;
  if (!land) {
    // Just right, but its friend is not: up to the ledge's height to show it,
    // then gently down again to wait, rather than landing alone.
    const up = ease(during(t, 0, 0.45));
    const down = ease(during(t, 0.6, 1));
    return { at: { x: home.x, y: t < 0.6 ? lerp(home.y, hover, up) : lerp(hover, home.y, down) }, parachute: false, mood: 'calm' };
  }

  // Just right: up to the ledge's height, where the breeze carries the kit
  // across onto the cliff.
  const rise = ease(during(t, 0, 0.62));
  const carry = ease(during(t, 0.64, 1));
  return {
    at: { x: lerp(home.x, spot.x, carry), y: lerp(lerp(home.y, hover, rise), spot.y, carry) },
    parachute: false,
    mood: t >= 1 ? 'happy' : 'calm',
  };
}
