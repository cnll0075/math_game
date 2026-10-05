import type { Point } from '@bundle/core';
import { BAY } from '../logic/world.js';

/**
 * Where everything sits, in design pixels. The water takes two thirds of the
 * screen so the fish have room; the bucket and the timer take the top corners
 * so they are always in view and never under the boat.
 */
export const LAYOUT = {
  titleY: 28,
  lineY: 64,
  /** The bucket, top left, big: it is the goal. */
  bucket: { x: 70, y: 6, scale: 1.08 },
  /** The stopwatch, top right. */
  timer: { x: 1030, y: 8, scale: 0.94 },
  hookButton: { x: 1074, y: 688, r: 56 },
} as const;

/**
 * The boat and the fisherman, as one rig cut from the board. In the rig's own
 * pixels the boat (flipped, so the motor is behind him) has its top left at
 * the origin, the fisherman stands in it, and his rod tip is out past the bow.
 */
export const RIG = {
  scale: 0.82,
  boat: { width: 219, height: 156 },
  fisherman: { x: 55, y: -100 },
  rodTip: { x: 220, y: -92 },
  /** Where the water meets the hull. */
  waterline: 122,
  /** The point the rig leans about, on the waterline under the middle of the hull. */
  pivot: { x: 110, y: 122 },
} as const;

/** The rig's origin, so the rod tip is over `hookX` and the hull sits on the water. */
export const rigOrigin = (hookX: number, sink = 0): Point => ({
  x: hookX - RIG.rodTip.x * RIG.scale,
  y: BAY.surfaceY - RIG.waterline * RIG.scale + sink,
});

/** A point in rig pixels, in design pixels, once the rig has leant by `angle`. */
export function rigPoint(hookX: number, local: Point, angle: number, sink = 0): Point {
  const origin = rigOrigin(hookX, sink);
  const pivot = { x: origin.x + RIG.pivot.x * RIG.scale, y: origin.y + RIG.pivot.y * RIG.scale };
  const x = origin.x + local.x * RIG.scale - pivot.x;
  const y = origin.y + local.y * RIG.scale - pivot.y;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return { x: pivot.x + x * cos - y * sin, y: pivot.y + x * sin + y * cos };
}

/** The boat and its fisherman, for taps: a tap there casts. */
export function onBoat(point: Point, hookX: number): boolean {
  const origin = rigOrigin(hookX);
  return (
    point.x >= origin.x &&
    point.x <= origin.x + RIG.rodTip.x * RIG.scale &&
    point.y >= origin.y + RIG.fisherman.y * RIG.scale &&
    point.y <= origin.y + RIG.boat.height * RIG.scale
  );
}

/** Generous: small fingers miss by a lot. */
export const onHookButton = (point: Point): boolean =>
  Math.hypot(point.x - LAYOUT.hookButton.x, point.y - LAYOUT.hookButton.y) <= LAYOUT.hookButton.r + 14;

/** The bucket picture, in its own pixels: the opening the count is written in, and its body. */
export const BUCKET = {
  width: 149,
  height: 160,
  opening: { x: 79, y: 24, rx: 50, ry: 18 },
  /** The body below the rim, as a trapezoid the fill is clipped to. */
  body: { top: 46, bottom: 148, topLeft: 20, topRight: 138, bottomLeft: 34, bottomRight: 124 },
} as const;

/** The stopwatch, in its own pixels: its face. */
export const TIMER = { width: 116, height: 142, face: { x: 60, y: 88, r: 46 } } as const;

/** Where a caught fish flies to: the bucket's opening, in design pixels. */
export const bucketMouth = (): Point => ({
  x: LAYOUT.bucket.x + BUCKET.opening.x * LAYOUT.bucket.scale,
  y: LAYOUT.bucket.y + BUCKET.opening.y * LAYOUT.bucket.scale,
});
