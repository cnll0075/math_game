import type { Point } from '@bundle/core';
import type { Intent } from '../intent.js';
import { DEFAULT_HOOKS, hooksOf, kitsOf, type RescueDef } from '../logic/rescue-def.js';
import { clippedOn, hooksUsed, trayTaken, type RescueState } from '../logic/rescue.js';

/** Where everything sits, in design coordinates. */
export const LAYOUT = {
  /** The top bar: rescue number left, chapter centre, stars right. */
  hudY: 46,
  /** The story line, under the chapter. */
  lineY: 104,
  /** Where the kits' feet stand. */
  groundY: 560,
  homeX: 300,
  /** Two at Once: where the two kits stand. */
  pairX: [250, 600],
  /** The top of the ledge, up and to the left. */
  ledgeY: 262,
  /** That cliff's edge. */
  cliffEdgeX: 220,
  /** How far apart two kits stand once they are on the ledge. */
  ledgeGap: 95,
  /** Centre line of the tray strip along the bottom. */
  trayY: 690,
  trayLeft: 50,
  trayRight: 890,
  button: { left: 912, top: 626, width: 210, height: 116 },
  /** ↺ Start over: a smaller round button above "Let go!". */
  reset: { x: 1017, y: 574, radius: 36 },
  /** From the feet up to the ring the balloon strings tie to. */
  harnessHeight: 118,
  /** How far below its balloon's place a popped scrap hangs. */
  limpDrop: 40,
  /** How far from a bunch a dragged balloon can be dropped and still clip on. */
  dropReach: 290,
  /** How near the middle of a kit a tap must be to select it. */
  kitReach: 56,
} as const;

export const HOME: Point = { x: LAYOUT.homeX, y: LAYOUT.groundY };

/** A 1 is small and a 10 is big; a 6 and a 7 are nearly the same, so read the number. */
export const balloonRadius = (value: number): number => 20 + (Math.min(10, Math.max(1, value)) - 1) * 2.8;

/** Where a kit stands: home for a lone kit, side by side for two. */
export const homeOf = (def: RescueDef, kit: number): Point =>
  kitsOf(def) > 1 ? { x: LAYOUT.pairX[kit] ?? LAYOUT.homeX, y: LAYOUT.groundY } : HOME;

/** Where a kit stands on the ledge once rescued: the second beside the first. */
export const ledgeSpot = (_def: RescueDef, kit = 0): Point => ({
  x: LAYOUT.cliffEdgeX - 80 - kit * LAYOUT.ledgeGap,
  y: LAYOUT.ledgeY,
});

/** Where the rope from a tied bunch is pegged down, beside the kit. */
export const pegPoint = (feet: Point): Point => ({ x: feet.x + 50, y: feet.y + 6 });

export const harnessPoint = (at: Point): Point => ({ x: at.x, y: at.y - LAYOUT.harnessHeight });

/** Where the balloon on harness slot `slot` of `count` floats, for a kit standing at `at`. */
export function bunchPoint(slot: number, count: number, at: Point): Point {
  const spread = Math.min(64, 320 / Math.max(1, count));
  const offset = slot - (count - 1) / 2;
  return { x: at.x + offset * spread, y: at.y - LAYOUT.harnessHeight - 104 - (slot % 2) * 46 };
}

/** Where a popped balloon's scrap hangs, below the place the balloon was. */
export const limpPoint = (at: Point): Point => ({ x: at.x, y: at.y + LAYOUT.limpDrop });

/**
 * How many places a kit's bunch is laid out for. A limited harness is laid out
 * for all its hooks from the start, so the free ones can be drawn as empty clips
 * and the limit is seen rather than discovered.
 */
export const bunchCount = (state: RescueState, kit = 0): number =>
  hooksOf(state.def) < DEFAULT_HOOKS ? hooksOf(state.def) : hooksUsed(state, kit);

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

/** The kit a dragged balloon dropped here clips to: the nearer bunch within reach, above the tray. */
export function dropKit(point: Point, def: RescueDef): number | null {
  if (point.y >= LAYOUT.trayY - 80) return null;
  let best: { kit: number; distance: number } | null = null;
  for (let kit = 0; kit < kitsOf(def); kit += 1) {
    const home = homeOf(def, kit);
    const distance = Math.hypot(point.x - home.x, point.y - (home.y - LAYOUT.harnessHeight - 120));
    if (distance <= LAYOUT.dropReach && (best === null || distance < best.distance)) best = { kit, distance };
  }
  return best?.kit ?? null;
}

/** Over the tray strip, where a clipped balloon dropped comes off. */
export const inTray = (point: Point): boolean =>
  point.y >= LAYOUT.trayY - 80 && point.x >= LAYOUT.trayLeft - 20 && point.x <= LAYOUT.trayRight + 20;

const near = (point: Point, centre: Point, radius: number): boolean =>
  (point.x - centre.x) ** 2 + (point.y - centre.y) ** 2 <= radius * radius;

/**
 * What a tap at `point` means while building. Generous circles, because a
 * six-year-old's finger is not a mouse; the bunches are searched before the
 * kits and the tray because they are drawn on top.
 */
export function hitTest(point: Point, state: RescueState): Intent | null {
  const { left, top, width, height } = LAYOUT.button;
  if (point.x >= left && point.x <= left + width && point.y >= top && point.y <= top + height) return { kind: 'letGo' };
  if (near(point, LAYOUT.reset, LAYOUT.reset.radius + 6)) return { kind: 'reset' };

  const def = state.def;
  for (let kit = kitsOf(def) - 1; kit >= 0; kit -= 1) {
    const home = homeOf(def, kit);
    const tied = kit === 0 ? state.tied : [];
    const clipped = clippedOn(state, kit);
    const count = bunchCount(state, kit);
    for (let slot = tied.length + clipped.length - 1; slot >= 0; slot -= 1) {
      const balloon = tied[slot];
      const value = balloon?.value ?? clipped[slot - tied.length]?.value ?? 1;
      const place = bunchPoint(slot, count, home);
      // A popped balloon is tapped where its scrap hangs, not where it used to float.
      const hit = balloon?.popped ? near(point, limpPoint(place), 36) : near(point, place, balloonRadius(value) + 8);
      if (!hit) continue;
      return balloon ? { kind: 'tied', index: slot } : { kind: 'clipped', kit, slot: slot - tied.length };
    }
  }

  if (kitsOf(def) > 1) {
    for (let kit = 0; kit < kitsOf(def); kit += 1) {
      const home = homeOf(def, kit);
      if (near(point, { x: home.x, y: home.y - 55 }, LAYOUT.kitReach)) return { kind: 'select', kit };
    }
  }

  // A squeezed tray lets neighbouring tap circles overlap, so the nearest
  // centre wins rather than whichever balloon happens to come first.
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
