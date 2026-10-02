import type { Point } from '@bundle/core';
import type { Outcome } from '../logic/outcome.js';
import { LAYERS, layerOf, type RescueDef } from '../logic/rescue-def.js';
import { HOME, LAYOUT, layerY, ledgeSpot } from './geometry.js';

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

/** Where a kit blown the wrong way has got to when the parachute opens. */
const BLOWN_X = HOME.x - 200;

/** A strain and a hop: how nearly there it was shows in how high the hop is. */
function hop(share: number, t: number): Pose {
  const through = clamp01(t / 0.8);
  const height = through >= 1 ? 0 : Math.sin(Math.PI * through) * (8 + 32 * clamp01(share));
  return { at: { x: HOME.x, y: HOME.y - height }, parachute: false, mood: 'strain' };
}

/** Whoosh past everything and off the top, then a parachute home. */
function whoosh(t: number): Pose {
  if (t < 0.45) {
    const up = ease(during(t, 0, 0.35));
    return { at: { x: HOME.x + Math.sin(t * 14) * 6, y: lerp(HOME.y, -200, up) }, parachute: false, mood: 'wheee' };
  }
  const down = ease(during(t, 0.45, 1));
  return { at: { x: HOME.x, y: lerp(-150, HOME.y, down) }, parachute: true, mood: 'calm' };
}

/**
 * Where the kit is, `t` of the way through its flight. A function of the
 * outcome and nothing else, so the flight is drawn from state rather than
 * simulated — a flight can never disagree with the verdict it shows.
 */
export function flightPose(def: RescueDef, outcome: Outcome, rawT: number): Pose {
  const t = clamp01(rawT);
  if (layerOf(def) > 0) return layeredPose(def, outcome, t);
  if (outcome.verdict === 'short') return hop(outcome.have / outcome.need, t);
  if (outcome.verdict === 'over') return whoosh(t);

  // Just right: up to the ledge's height, where the breeze carries the kit
  // across onto the cliff.
  const spot = ledgeSpot(def);
  const hover = LAYOUT.ledgeY - 14;
  const rise = ease(during(t, 0, 0.62));
  const carry = ease(during(t, 0.64, 1));
  return {
    at: { x: lerp(HOME.x, spot.x, carry), y: lerp(lerp(HOME.y, hover, rise), spot.y, carry) },
    parachute: false,
    mood: t >= 1 ? 'happy' : 'calm',
  };
}

/**
 * Windy Ridge. The kit rises lift minus weight layers, and the layer it reaches
 * decides where the wind takes it: towards the ledge from the right layer, away
 * from it from any other.
 */
function layeredPose(def: RescueDef, outcome: Outcome, t: number): Pose {
  if (outcome.have < outcome.weight) return hop(outcome.have / outcome.weight, t);
  const rise = outcome.have - outcome.weight;
  if (rise > LAYERS) return whoosh(t);
  if (rise === 0) {
    // Floating, but no higher than the still air by the ground.
    const through = clamp01(t / 0.85);
    const lift = through >= 1 ? 0 : Math.sin(Math.PI * through) * 60;
    return { at: { x: HOME.x, y: HOME.y - lift }, parachute: false, mood: 'calm' };
  }

  const height = layerY(rise) - 14;
  if (outcome.verdict === 'exact') {
    const spot = ledgeSpot(def);
    const up = ease(during(t, 0, 0.42));
    const across = ease(during(t, 0.44, 0.88));
    const settle = ease(during(t, 0.88, 1));
    return {
      at: { x: lerp(HOME.x, spot.x, across), y: lerp(lerp(HOME.y, height, up), spot.y, settle) },
      parachute: false,
      mood: t >= 1 ? 'happy' : 'calm',
    };
  }
  if (t < 0.7) {
    const up = ease(during(t, 0, 0.35));
    const blown = ease(during(t, 0.37, 0.65));
    return { at: { x: lerp(HOME.x, BLOWN_X, blown), y: lerp(HOME.y, height, up) }, parachute: false, mood: 'strain' };
  }
  const back = ease(during(t, 0.7, 1));
  return { at: { x: lerp(BLOWN_X, HOME.x, back), y: lerp(height, HOME.y, back) }, parachute: true, mood: 'calm' };
}
