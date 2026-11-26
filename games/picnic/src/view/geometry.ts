import type { Point } from '@bundle/core';

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

/** Where the friends' plates rest on the table top. */
const PLATE_Y = 418;
/** How far apart the friends sit, by how many there are. */
const SPACING: Readonly<Record<number, number>> = { 1: 0, 2: 290, 3: 236, 4: 182 };

export const FRIEND = { scale: 1.06 } as const;

/** The middle of each seated friend's plate, left to right. */
export function seats(count: number): Point[] {
  const spacing = SPACING[count] ?? 182;
  const first = 576 - (spacing * (count - 1)) / 2;
  return Array.from({ length: count }, (_, index) => ({ x: first + index * spacing, y: PLATE_Y }));
}

/** The plate under a tap: anywhere on the friend or their plate, for small fingers. */
export function plateAt(point: Point, count: number): number | null {
  const reach = Math.min(90, (SPACING[count] ?? 182) / 2);
  const index = seats(count).findIndex((seat) => Math.abs(point.x - seat.x) <= reach && point.y >= seat.y - 200 && point.y <= seat.y + 50);
  return index >= 0 ? index : null;
}

/** The treats still to share, in rows of five on the grass in front of the table. */
export const POOL = { x: 576, y: 640, size: 46, gap: 52, groupGap: 22 } as const;

/** The basket, beside the table. */
export const BASKET = { x: 112, y: 560, scale: 0.92 } as const;

/** The dial: its middle and how big it is drawn. Its left half turns it down, its right half up. */
export const DIAL = { x: 1030, y: 600, scale: 0.78, halfWidth: 95, halfHeight: 66 } as const;

export const SHARE = { x: 1030, y: 712, scale: 0.68, halfWidth: 96, halfHeight: 32 } as const;

export function onDial(point: Point): 1 | -1 | null {
  if (Math.abs(point.y - DIAL.y) > DIAL.halfHeight + 10 || Math.abs(point.x - DIAL.x) > DIAL.halfWidth + 10) return null;
  return point.x < DIAL.x ? -1 : 1;
}

export const onShare = (point: Point): boolean =>
  Math.abs(point.x - SHARE.x) <= SHARE.halfWidth + 10 && Math.abs(point.y - SHARE.y) <= SHARE.halfHeight + 12;

/** A pizza or cake to cut: its middle on the table, and its radii (it is seen at a slant). */
export const FOOD = { x: 576, y: 446, rx: 190, ry: 104, scale: 1.62 } as const;

/** A point measured from the middle of the food, in its radii. */
export const toFood = (point: Point): Point => ({ x: (point.x - FOOD.x) / FOOD.rx, y: (point.y - FOOD.y) / FOOD.ry });

export const fromFood = (point: Point): Point => ({ x: FOOD.x + point.x * FOOD.rx, y: FOOD.y + point.y * FOOD.ry });

/** Along the top: the round's line in the middle once its title has gone, progress on the right. */
export const HUD = { lineX: 560, lineY: 36, progressX: 1132, progressY: 36, bannerY: 36 } as const;

/** Where Biscuit comes in from, and where he grabs the leftovers. */
export const DOG = { offX: 1260, grabX: 860, y: 640 } as const;
