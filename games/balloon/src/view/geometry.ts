import type { Point } from '@bundle/core';
import type { Intent } from '../intent.js';
import { DEFAULT_HOOKS, hooksOf, layerOf, type RescueDef } from '../logic/rescue-def.js';
import { trayTaken, type RescueState } from '../logic/rescue.js';

/** Where everything sits, in design coordinates. */
export const LAYOUT = {
  /** The top bar: rescue number left, chapter centre, stars right. */
  hudY: 46,
  /** The story line, under the chapter. */
  lineY: 104,
  /** Where the kit's feet stand. */
  groundY: 560,
  homeX: 300,
  /** The top of the ledge, in the chapters where it is up and to the left. */
  ledgeY: 262,
  /** That left cliff's edge. */
  cliffEdgeX: 220,
  /** Windy Ridge: the right cliff's edge, and how tall one wind layer is. */
  rightCliffEdgeX: 780,
  layerHeight: 95,
  /** Centre line of the tray strip along the bottom. */
  trayY: 690,
  trayLeft: 50,
  trayRight: 890,
  button: { left: 912, top: 626, width: 210, height: 116 },
  /** From the feet up to the ring the balloon strings tie to. */
  harnessHeight: 118,
  /** How far from the bunch a dragged balloon can be dropped and still clip on. */
  dropReach: 290,
} as const;

export const HOME: Point = { x: LAYOUT.homeX, y: LAYOUT.groundY };

/** A 1 is small and a 10 is big; a 6 and a 7 are nearly the same, so read the number. */
export const balloonRadius = (value: number): number => 20 + (Math.min(10, Math.max(1, value)) - 1) * 2.8;

/** Where a kit's feet are once it has risen `layer` wind layers. */
export const layerY = (layer: number): number => LAYOUT.groundY - layer * LAYOUT.layerHeight;

export const ledgeSpot = (def: RescueDef): Point =>
  layerOf(def) > 0
    ? { x: LAYOUT.rightCliffEdgeX + 70, y: layerY(layerOf(def)) }
    : { x: LAYOUT.cliffEdgeX - 80, y: LAYOUT.ledgeY };

/** Where the rope from a tied bunch is pegged down, beside the kit. */
export const pegPoint = (feet: Point): Point => ({ x: feet.x + 50, y: feet.y + 6 });

export const harnessPoint = (at: Point): Point => ({ x: at.x, y: at.y - LAYOUT.harnessHeight });

/** Where the balloon on harness slot `slot` of `count` floats, for a kit standing at `at`. */
export function bunchPoint(slot: number, count: number, at: Point): Point {
  const spread = Math.min(64, 320 / Math.max(1, count));
  const offset = slot - (count - 1) / 2;
  return { x: at.x + offset * spread, y: at.y - LAYOUT.harnessHeight - 104 - (slot % 2) * 46 };
}

/**
 * How many places the bunch is laid out for. A limited harness is laid out for
 * all its hooks from the start, so the free ones can be drawn as empty clips and
 * the limit is seen rather than discovered.
 */
export const bunchCount = (state: RescueState): number => {
  const used = state.tied.length + state.clipped.length;
  return hooksOf(state.def) < DEFAULT_HOOKS ? hooksOf(state.def) : used;
};

/**
 * Tray balloons are packed by their own widths rather than spaced evenly, so a
 * row of big ones still fits and a pair of small ones does not drift apart. A
 * short tray is spread a little, never more than half again.
 */
export function trayPoint(def: RescueDef, index: number): Point {
  const widths = def.tray.map((value) => 2 * balloonRadius(value) + 10);
  const total = widths.reduce((sum, width) => sum + width, 0);
  const room = LAYOUT.trayRight - LAYOUT.trayLeft;
  const scale = Math.min(1.5, room / Math.max(1, total));
  const before = widths.slice(0, index).reduce((sum, width) => sum + width, 0);
  const start = LAYOUT.trayLeft + (room - total * scale) / 2;
  return { x: start + scale * (before + (widths[index] ?? 0) / 2), y: LAYOUT.trayY - 10 };
}

/** Near enough the bunch that a dragged balloon dropped here clips on: around the kit, above the tray. */
export const inDropZone = (point: Point): boolean =>
  point.y < LAYOUT.trayY - 80 &&
  Math.hypot(point.x - HOME.x, point.y - (HOME.y - LAYOUT.harnessHeight - 120)) <= LAYOUT.dropReach;

/** Over the tray strip, where a clipped balloon dropped comes off. */
export const inTray = (point: Point): boolean =>
  point.y >= LAYOUT.trayY - 80 && point.x >= LAYOUT.trayLeft - 20 && point.x <= LAYOUT.trayRight + 20;

const near = (point: Point, centre: Point, radius: number): boolean =>
  (point.x - centre.x) ** 2 + (point.y - centre.y) ** 2 <= radius * radius;

/**
 * What a tap at `point` means while building. Generous circles, because a
 * six-year-old's finger is not a mouse; the harness is searched first because
 * it is drawn on top.
 */
export function hitTest(point: Point, state: RescueState): Intent | null {
  const { left, top, width, height } = LAYOUT.button;
  if (point.x >= left && point.x <= left + width && point.y >= top && point.y <= top + height) return { kind: 'letGo' };

  const used = state.tied.length + state.clipped.length;
  const count = bunchCount(state);
  for (let slot = used - 1; slot >= 0; slot -= 1) {
    const tied = state.tied[slot];
    const clipped = state.clipped[slot - state.tied.length];
    const value = tied?.value ?? clipped?.value ?? 1;
    if (!near(point, bunchPoint(slot, count, HOME), balloonRadius(value) + 8)) continue;
    return tied ? { kind: 'tied', index: slot } : { kind: 'clipped', slot: slot - state.tied.length };
  }

  // A squeezed tray lets neighbouring tap circles overlap, so the nearest
  // centre wins rather than whichever balloon happens to come first.
  const def = state.def;
  const candidates: Array<{ intent: Intent; distance: number }> = [];
  def.tray.forEach((value, index) => {
    if (trayTaken(state, index)) return;
    const centre = trayPoint(def, index);
    const distance = Math.hypot(point.x - centre.x, point.y - centre.y);
    if (distance <= balloonRadius(value) + 10) candidates.push({ intent: { kind: 'tray', index }, distance });
  });
  candidates.sort((a, b) => a.distance - b.distance);
  return candidates[0]?.intent ?? null;
}
