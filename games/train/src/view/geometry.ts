import type { Point } from '@bundle/core';
import { QUEUE_SLOTS } from '../logic/run.js';

/**
 * Where everything sits, in design pixels. The painted yard from the sheet
 * covers the top; the floor below it, where the queue runs, is drawn.
 */
export const BACKDROP = { width: 852, height: 467, scale: 1152 / 852 } as const;
export const FLOOR = { top: 628, colour: '#a8938a', kerb: '#857981' } as const;

export interface TrackPlace {
  /** Where the wheels sit. */
  railY: number;
  /** The middle of a waiting train. */
  trainX: number;
  /** The sign at the track's right end. */
  sign: Point;
}

/** Red, blue, green, top to bottom, as on the sheet. */
export const TRACKS: readonly TrackPlace[] = [
  { railY: 299, trainX: 585, sign: { x: 979, y: 284 } },
  { railY: 411, trainX: 585, sign: { x: 979, y: 381 } },
  { railY: 525, trainX: 585, sign: { x: 979, y: 472 } },
];
export const TRAIN = { width: 250, height: 84 } as const;
/** A dropped crate counts for a track anywhere in this band of x, and between the rails above and below. */
const DROP = { left: 250, right: 1110, tops: [150, 345, 455], bottom: 600 } as const;

export const QUEUE = {
  /** Where the crates sit, the port end first. */
  y: 700,
  firstX: 120,
  pitch: 78,
  crate: 72,
  /** The marker the queue must not reach, at its right end. */
  markerX: 1060,
} as const;

export const HUD = {
  clock: { x: 590, y: 46 },
  sent: { x: 400, y: 46 },
  pause: { x: 1100, y: 46, r: 34 },
  bandY: 112,
  coachY: 610,
} as const;

export const slotCentre = (index: number): Point => ({ x: QUEUE.firstX + index * QUEUE.pitch, y: QUEUE.y });

/** The queued crate under a point, by its place in the queue; generous, for small fingers. */
export function crateAt(point: Point, count: number): number | null {
  if (Math.abs(point.y - QUEUE.y) > QUEUE.crate * 0.75) return null;
  const index = Math.round((point.x - QUEUE.firstX) / QUEUE.pitch);
  return index >= 0 && index < Math.min(count, QUEUE_SLOTS) ? index : null;
}

export function trackAt(point: Point): number | null {
  if (point.x < DROP.left || point.x > DROP.right || point.y > DROP.bottom) return null;
  for (let index = DROP.tops.length - 1; index >= 0; index -= 1) {
    if (point.y >= DROP.tops[index]!) return index;
  }
  return null;
}

export const onPause = (point: Point): boolean => Math.hypot(point.x - HUD.pause.x, point.y - HUD.pause.y) <= HUD.pause.r + 12;
