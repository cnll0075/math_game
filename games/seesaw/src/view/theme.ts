import type { AnimalId } from '../logic/animals.js';
import type { Side, Zone } from '../logic/seesaw-state.js';
import type { Bounds } from './layout.js';

export type Expression = 'calm' | 'surprised' | 'alarmed' | 'cheer';

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
  /**
   * 0..1 celebration intensity for this animal. Sprite art drives a dance clip
   * from it; the prototype hops and spins procedurally.
   */
  dance: number;
  /**
   * 0..1 through this animal's arrival: 0 the moment it sets off, 1 once it has
   * landed. Each species travels in its own way — a chicken flaps, a cat runs,
   * a bear lumbers.
   */
  arriving: number;
  /** Seconds since the scene began, for idle movement that never stops. */
  clock: number;
  /** 1 faces right, -1 faces left. Animals look towards the middle. */
  facing: 1 | -1;
  expression: Expression;
}

export interface AnimalArtist {
  draw(ctx: CanvasRenderingContext2D, species: AnimalId, pose: AnimalPose): void;
  /**
   * The weight tag alone. Drawn in a second pass over a row of animals so a
   * number is never hidden behind the animal in front of it.
   */
  drawTag(ctx: CanvasRenderingContext2D, species: AnimalId, pose: AnimalPose): void;
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
  /** 0..1 celebration intensity, during a perfect balance or a finished level. */
  celebrate: number;
  /** 0..1 how far the flag that marks a level plank has popped up. */
  levelled: number;
  /** 0..1 how far past safely tilted the seesaw is. */
  danger: number;
  /** Marker for a tilt objective, in the same units as plankAngle; null if unused. */
  targetAngle: number | null;
  /**
   * The whole canvas in design coordinates. Scenery paints across this so no
   * letterbox bars show; gameplay stays inside the design rect.
   */
  bounds: Bounds;
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
  /**
   * The near wall of each tray, drawn after the animals so they stand INSIDE
   * the basket instead of on top of it. Themes whose baskets have no near wall
   * draw nothing here.
   */
  drawSeesawFront(ctx: CanvasRenderingContext2D, view: SeesawView): void;
  /**
   * The flag that says the plank is level. Drawn over the seesaw, at the point
   * the whole game turns on, because "flat" is hard to see and easy to doubt.
   */
  drawLevelFlag(ctx: CanvasRenderingContext2D, view: SeesawView): void;
  /** The target marker, drawn over the animals so it is never hidden. */
  drawTarget(ctx: CanvasRenderingContext2D, view: SeesawView): void;
  drawGauge(ctx: CanvasRenderingContext2D, view: SeesawView): void;
  /** Celebration dressing over the whole scene; draws nothing when idle. */
  drawCelebration(ctx: CanvasRenderingContext2D, view: SeesawView): void;
  /** A warning over the whole scene when the plank is badly over; nothing when safe. */
  drawDanger(ctx: CanvasRenderingContext2D, view: SeesawView): void;
  animals: AnimalArtist;
}
