import type { AnimalId } from '../logic/animals.js';
import type { Side, Zone } from '../logic/seesaw-state.js';

export type Expression = 'calm' | 'surprised' | 'alarmed';

/** Everything an animal's art needs. Logic never sees this. */
export interface AnimalPose {
  x: number;
  y: number;
  scale: number;
  /** Matches the plank angle so animals stand on the board, not beside it. */
  tiltRad: number;
  /** -1..1 procedural sway. */
  wobble: number;
  /** Offset along the plank as the animal slides downhill. */
  slide: number;
  expression: Expression;
}

export interface AnimalArtist {
  draw(ctx: CanvasRenderingContext2D, species: AnimalId, pose: AnimalPose): void;
}

export interface SeesawView {
  /**
   * Plank rotation in radians, in canvas terms: positive rotates the right end
   * downward. The heavier side is the one that goes down, so this is the
   * negation of the normalized balance.
   */
  plankAngle: number;
  /** -1..1 smoothed needle position for the gauge. */
  needle: number;
  zone: Zone;
  /** 0..1 how far the danger flag has risen. */
  flagHeight: number;
  flagSide: Side | null;
  /** 0..1 how far the gate has opened. */
  gateOpen: number;
  /** 0..1 celebration intensity right after a perfect balance. */
  celebrate: number;
  /** Marker for a tilt objective, in the same units as plankAngle; null if unused. */
  targetAngle: number | null;
  time: number;
}

/**
 * All drawing goes through this. `VectorTheme` is the prototype; a sprite theme
 * implements the same calls and the game does not notice the difference.
 */
export interface SeesawTheme {
  preload(): Promise<void>;
  drawBackground(ctx: CanvasRenderingContext2D, view: SeesawView): void;
  drawSeesaw(ctx: CanvasRenderingContext2D, view: SeesawView): void;
  drawGauge(ctx: CanvasRenderingContext2D, view: SeesawView): void;
  drawFlag(ctx: CanvasRenderingContext2D, view: SeesawView): void;
  drawGate(ctx: CanvasRenderingContext2D, view: SeesawView): void;
  animals: AnimalArtist;
}
