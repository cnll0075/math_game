import type { Point } from '@bundle/core';
import type { Outcome } from '../logic/outcome.js';
import type { RescueDef } from '../logic/rescue-def.js';
import { HOME, LAYOUT, WORLD_RIGHT, ledgeSpot } from './geometry.js';

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
 * Where the kit is, `t` of the way through its flight. A function of the
 * outcome and nothing else, so the flight is drawn from state rather than
 * simulated — a flight can never disagree with the verdict it shows.
 */
export function flightPose(def: RescueDef, outcome: Outcome, rawT: number): Pose {
  const t = clamp01(rawT);
  const hover = LAYOUT.ledgeY - 26;

  if (outcome.verdict === 'exact') {
    const spot = ledgeSpot(def);
    const mood = t >= 1 ? 'happy' : 'calm';
    if (!def.wind) {
      const rise = ease(during(t, 0, 0.7));
      const step = ease(during(t, 0.72, 1));
      return { at: { x: lerp(HOME.x, spot.x, step), y: lerp(lerp(HOME.y, hover, rise), spot.y, step) }, parachute: false, mood };
    }
    const rise = ease(during(t, 0, 0.4));
    const drift = ease(during(t, 0.42, 0.86));
    const settle = ease(during(t, 0.86, 1));
    return { at: { x: lerp(HOME.x, spot.x, drift), y: lerp(lerp(HOME.y, hover, rise), spot.y, settle) }, parachute: false, mood };
  }

  if (outcome.axis === 'up' && outcome.verdict === 'short') {
    // A strain and a hop: how nearly there it was shows in how high the hop is.
    const share = clamp01(outcome.have / outcome.need);
    const through = clamp01(t / 0.8);
    const hop = through >= 1 ? 0 : Math.sin(Math.PI * through) * (8 + 32 * share);
    return { at: { x: HOME.x, y: HOME.y - hop }, parachute: false, mood: 'strain' };
  }

  if (outcome.axis === 'up') {
    // Whoosh past the ledge and off the top, then a parachute home.
    if (t < 0.45) {
      const up = ease(during(t, 0, 0.35));
      return { at: { x: HOME.x + Math.sin(t * 14) * 6, y: lerp(HOME.y, -200, up) }, parachute: false, mood: 'wheee' };
    }
    const down = ease(during(t, 0.45, 1));
    return { at: { x: HOME.x, y: lerp(-150, HOME.y, down) }, parachute: true, mood: 'calm' };
  }

  // Across: up, over to wherever the wind and puffs reached, and back by parachute.
  const reached = Math.min(WORLD_RIGHT, Math.max(50, HOME.x + outcome.have * LAYOUT.stepWidth));
  if (t < 0.72) {
    const rise = ease(during(t, 0, 0.3));
    const drift = ease(during(t, 0.32, 0.62));
    return { at: { x: lerp(HOME.x, reached, drift), y: lerp(HOME.y, hover, rise) }, parachute: false, mood: 'strain' };
  }
  const back = ease(during(t, 0.72, 1));
  return { at: { x: lerp(reached, HOME.x, back), y: lerp(hover, HOME.y, back) }, parachute: true, mood: 'calm' };
}
