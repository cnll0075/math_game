import { DESIGN, type Point } from '@bundle/core';
import { PLANE_TYPES, type PlaneType } from '../logic/planes.js';
import { planeX, type Plane } from '../logic/sky-state.js';

/**
 * Where everything sits, in design coordinates. The playfield is inset from the
 * screen so a blimp at the far edge of its lane still has both wings on screen,
 * and the escape line sits well above the fighter so a plane that gets away is
 * seen to get away rather than vanishing behind the guns.
 */
export const SKY = {
  /** The top bar: hearts on the left, score on the right. */
  hudY: 46,
  /** Where planes enter, clear of the top bar. */
  spawnY: 128,
  /** Where a plane counts as having got away. */
  escapeY: 616,
  /** The fighter's altitude. */
  fighterY: 700,
  /** The sides of the playfield. */
  fieldLeft: 84,
  fieldRight: DESIGN.width - 84,
  /** How big the fighter is drawn. */
  fighterWidth: 96,
  fighterHeight: 74,
  /** The shell. */
  bulletWidth: 8,
  bulletLength: 26,
} as const;

export const FIELD_WIDTH = SKY.fieldRight - SKY.fieldLeft;
export const FALL_HEIGHT = SKY.escapeY - SKY.spawnY;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/** A point in the playfield, from its normalised place. */
export const skyPoint = (x: number, progress: number): Point => ({
  x: SKY.fieldLeft + x * FIELD_WIDTH,
  y: SKY.spawnY + progress * FALL_HEIGHT,
});

export const planePoint = (plane: Plane): Point => skyPoint(planeX(plane), plane.progress);

/**
 * How big a plane is drawn — derived from the hit box in its catalog entry
 * rather than kept separately, so what a child aims at is exactly what the
 * shell collides with.
 */
export const planeSize = (type: PlaneType): { width: number; height: number } => ({
  width: type.halfWidth * 2 * FIELD_WIDTH,
  height: type.halfHeight * 2 * FALL_HEIGHT,
});

export const fighterPoint = (x: number): Point => ({ x: SKY.fieldLeft + x * FIELD_WIDTH, y: SKY.fighterY });

/** Where a shell is, from the run's normalised bullet position. */
export const bulletPoint = (x: number, y: number): Point => ({
  x: SKY.fieldLeft + x * FIELD_WIDTH,
  y: SKY.spawnY + y * FALL_HEIGHT,
});

/** Turns a tap's design x into the fighter's lane. */
export const laneAt = (designX: number): number => clamp01((designX - SKY.fieldLeft) / FIELD_WIDTH);

/** The biggest plane in the game, for the clearance tests. */
export const WIDEST_PLANE = PLANE_TYPES.blimp;
