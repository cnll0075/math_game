import type { Point } from '@bundle/core';
import { BAY } from '../logic/world.js';

/**
 * Where everything sits, in design pixels. The water takes two thirds of the
 * screen so the fish have room. The bucket rides in the boat; the timer has the
 * top right corner and the level's line runs along the sand.
 */
export const LAYOUT = {
  /** Where the opening banner settles, top middle, before it fades. */
  titleY: 40,
  /** The level's line, along the sand. */
  titleX: 28,
  lineY: 748,
  /** The stopwatch, top right. */
  timer: { x: 1030, y: 8, scale: 0.94 },
  hookButton: { x: 1074, y: 688, r: 56 },
} as const;

/**
 * The boat, the boy sitting in it and the bucket beside him, as one rig cut
 * from the board. In the rig's own pixels the boat (flipped, so the motor is
 * behind him and the bow ahead) has its top left at the origin; the boy and the
 * bucket are drawn between the hull and its near wall, so they are in it.
 */
export const RIG = {
  scale: 1.25,
  boat: { width: 219, height: 156 },
  fisherman: { x: 84, y: -83 },
  rodTip: { x: 249, y: -75 },
  bucket: { x: -6, y: -58, scale: 0.82 },
  /** Where the water meets the hull. */
  waterline: 122,
  /** The middle of the hull on the waterline: where the world's boat is, and what it leans about. */
  pivot: { x: 110, y: 122 },
} as const;


export interface RigPlace {
  /** The middle of the hull. */
  x: number;
  /** Lean, radians, clockwise: towards the line over the bow. */
  angle: number;
  sink: number;
}

/** A point in rig pixels, in design pixels, for a boat placed and leaning so. */
export function rigPoint(place: RigPlace, local: Point): Point {
  const x = (local.x - RIG.pivot.x) * RIG.scale;
  const y = (local.y - RIG.pivot.y) * RIG.scale;
  const cos = Math.cos(place.angle);
  const sin = Math.sin(place.angle);
  return { x: place.x + x * cos - y * sin, y: BAY.surfaceY + place.sink + x * sin + y * cos };
}

/** The boat, the boy and the bucket, for taps: a tap there casts. */
export function onBoat(point: Point, boatX: number): boolean {
  const a = rigPoint({ x: boatX, angle: 0, sink: 0 }, { x: RIG.bucket.x, y: RIG.fisherman.y });
  const b = rigPoint({ x: boatX, angle: 0, sink: 0 }, { x: RIG.boat.width, y: RIG.boat.height });
  return point.x >= a.x && point.x <= b.x && point.y >= a.y && point.y <= b.y;
}

/** Generous: small fingers miss by a lot. */
export const onHookButton = (point: Point): boolean =>
  Math.hypot(point.x - LAYOUT.hookButton.x, point.y - LAYOUT.hookButton.y) <= LAYOUT.hookButton.r + 14;

/** The bucket picture, in its own pixels: its open top, and the side the count is written on. */
export const BUCKET = {
  width: 149,
  height: 160,
  opening: { x: 79, y: 27, rx: 50, ry: 18 },
  /** Where the count goes: on its side, above where the hull hides it. */
  label: { x: 79, y: 84 },
  /** The side below the rim, as a trapezoid the rising fill is clipped to. */
  body: { top: 58, bottom: 148, topLeft: 22, topRight: 136, bottomLeft: 34, bottomRight: 124 },
} as const;

/** A point on the bucket, in its own pixels, as a point in the rig. */
export const bucketLocal = (point: Point): Point => ({
  x: RIG.bucket.x + point.x * RIG.bucket.scale,
  y: RIG.bucket.y + point.y * RIG.bucket.scale,
});

/** The stopwatch, in its own pixels: its face. */
export const TIMER = { width: 116, height: 142, face: { x: 60, y: 88, r: 46 } } as const;

/** Where a caught fish flies to: into the bucket's mouth, wherever the boat is. */
export const bucketMouth = (place: RigPlace): Point => rigPoint(place, bucketLocal(BUCKET.opening));
