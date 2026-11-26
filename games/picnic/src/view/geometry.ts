import type { Point } from '@bundle/core';
import type { FoodId } from '../logic/friends.js';

/**
 * Where everything sits, in design pixels. A park: sky, the fence along the
 * back, the picnic table in the middle with the friends behind it, their
 * plates on its top. What is still to share lies on the grass in front. The
 * dial and Share are bottom right, under the thumb.
 */
export const SKY = { horizon: 268 } as const;

export const FENCE = { y: 176, scale: 0.82 } as const;

/** The table picture, centred, and how big it is drawn. */
export const TABLE = { x: 576, top: 318, scale: 1.38 } as const;

/**
 * Where the friends' plates rest on the cloth. The friends sit behind the
 * table, on its far bench: drawn before it, so it hides all but their heads
 * and shoulders, with their plates on the cloth in front of them.
 */
const PLATE_Y = 392;
/** Where a seated friend's picture stands, behind the table: its foot hides under the cloth. */
export const BODY_Y = 382;
/** How far apart the friends sit, by how many there are. */
const SPACING: Readonly<Record<number, number>> = { 1: 0, 2: 300, 3: 250, 4: 204 };

export const FRIEND = { scale: 1.3 } as const;

/** A plate on the cloth, drawn: the friends' own are hidden with their laps. */
export const PLATE = { rx: 46, ry: 15 } as const;

/** The middle of each seated friend's plate, left to right. */
export function seats(count: number): Point[] {
  const spacing = SPACING[count] ?? 182;
  const first = 576 - (spacing * (count - 1)) / 2;
  return Array.from({ length: count }, (_, index) => ({ x: first + index * spacing, y: PLATE_Y }));
}

/** The plate under a tap: anywhere on the friend or their plate, for small fingers. */
export function plateAt(point: Point, count: number): number | null {
  const reach = Math.min(90, (SPACING[count] ?? 182) / 2);
  const index = seats(count).findIndex((seat) => Math.abs(point.x - seat.x) <= reach && point.y >= seat.y - 230 && point.y <= seat.y + 50);
  return index >= 0 ? index : null;
}

/** The treats still to share, in rows of five on the grass in front of the table. */
export const POOL = { x: 576, y: 640, size: 46, gap: 52, groupGap: 22 } as const;

/** The basket, beside the table. */
export const BASKET = { x: 112, y: 560, scale: 0.92 } as const;

/** The dial: its middle and how big it is drawn. Its left half turns it down, its right half up. */
export const DIAL = { x: 1054, y: 626, scale: 0.74, halfWidth: 90, halfHeight: 62 } as const;

export const SHARE = { x: 1054, y: 726, scale: 0.66, halfWidth: 93, halfHeight: 30 } as const;

export function onDial(point: Point): 1 | -1 | null {
  if (Math.abs(point.y - DIAL.y) > DIAL.halfHeight + 10 || Math.abs(point.x - DIAL.x) > DIAL.halfWidth + 10) return null;
  return point.x < DIAL.x ? -1 : 1;
}

export const onShare = (point: Point): boolean =>
  Math.abs(point.x - SHARE.x) <= SHARE.halfWidth + 10 && Math.abs(point.y - SHARE.y) <= SHARE.halfHeight + 12;

/**
 * A pizza or cake to cut: the middle of the face that is cut, on the table,
 * and its radii (it is seen at a slant). The cake is cut across its top.
 */
export const FOOD: Readonly<Record<FoodId, { x: number; y: number; rx: number; ry: number }>> = {
  pizza: { x: 576, y: 478, rx: 150, ry: 80 },
  cake: { x: 576, y: 452, rx: 124, ry: 32 },
};

/** A point measured from the middle of the food, in its radii. */
export const toFood = (food: FoodId, point: Point): Point => {
  const shape = FOOD[food];
  return { x: (point.x - shape.x) / shape.rx, y: (point.y - shape.y) / shape.ry };
};

export const fromFood = (food: FoodId, point: Point): Point => {
  const shape = FOOD[food];
  return { x: shape.x + point.x * shape.rx, y: shape.y + point.y * shape.ry };
};

/** Along the top: the round's line in the middle once its title has gone, progress on the right. */
export const HUD = { lineX: 560, lineY: 36, progressX: 1132, progressY: 36, bannerY: 36 } as const;

/** Biscuit sits by the table, hoping, with his bowl beside him: what cannot go round goes in it. */
export const DOG = { x: 1082, y: 548, scale: 0.68 } as const;
export const BOWL = { x: 972, y: 556, rx: 52, ry: 17 } as const;

/**
 * Friends not yet asked to the table peek over the fence, each at their own
 * spot (by their place in the round's list; the host is never there).
 */
const FENCE_X: readonly number[] = [0, 122, 1030, 236];
export const FENCE_FRIEND = { y: 262, scale: 0.92 } as const;

export const fenceSpot = (friend: number): Point => ({ x: FENCE_X[friend] ?? 576, y: FENCE_FRIEND.y });

/** The waiting friend under a tap, by their place in the round's list. */
export function fenceAt(point: Point, waiting: readonly number[]): number | null {
  const friend = waiting.find((index) => {
    const spot = fenceSpot(index);
    return Math.abs(point.x - spot.x) <= 62 && point.y <= spot.y && point.y >= spot.y - 170;
  });
  return friend ?? null;
}
