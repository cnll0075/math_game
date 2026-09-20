import { DESIGN, type Point } from '@bundle/core';
import { LANES } from '../logic/lanes.js';

/**
 * Where everything sits, in design coordinates.
 *
 * The path runs straight down the screen rather than away to a horizon. In a
 * perspective runner an obstacle's number is smallest exactly when the player
 * most needs to read it and biggest when it is too late to act — the arithmetic
 * would lose to the eyesight. Straight down keeps every number full size from
 * the moment it appears.
 */
export const PATH = {
  /** The top bar: the fuel bar on the left, score on the right. */
  hudY: 46,
  /** Where a row appears — far enough down that a whole obstacle clears the bar. */
  horizonY: 152,
  /** Where the rabbit runs, and where a row is met. */
  rabbitY: 620,
  left: 180,
  right: DESIGN.width - 180,
  rabbitWidth: 108,
  rabbitHeight: 96,
} as const;

export const PATH_WIDTH = PATH.right - PATH.left;
export const RUN_HEIGHT = PATH.rabbitY - PATH.horizonY;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

export const pathPoint = (x: number, progress: number): Point => ({
  x: PATH.left + x * PATH_WIDTH,
  y: PATH.horizonY + progress * RUN_HEIGHT,
});

export const laneWidth = (): number => PATH_WIDTH / LANES;

/** One size for every obstacle, whatever its kind, and whatever its distance. */
export const obstacleSize = (): { width: number; height: number } => ({
  width: laneWidth() * 0.72,
  height: laneWidth() * 0.46,
});

/** Turns a touch's design x into a position across the path. */
export const pathXTo = (designX: number): number => clamp01((designX - PATH.left) / PATH_WIDTH);
