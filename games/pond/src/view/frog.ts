import type { Point, Rng } from '@bundle/core';

/**
 * The frog's habits, in one place. It is decoration: nothing it does touches
 * the board, and it only ever sits where there is room away from the pads.
 */
export const FROG = {
  /** The first leap comes sooner than later ones, so a child meets it early. */
  firstMin: 3,
  firstMax: 7,
  /** How long it stays underwater between visits. */
  hiddenMin: 6,
  hiddenMax: 14,
  /** How long it sits before hopping on or diving. */
  /** Long enough for a child to notice it and reach out. */
  sitMin: 3,
  sitMax: 6,
  /** How many hops a visit has before it dives. */
  hopsMin: 1,
  hopsMax: 3,
  emergeSeconds: 0.7,
  hopSeconds: 0.7,
  diveSeconds: 0.55,
  cheerSeconds: 1.3,
  /** How tall it stands, and how near its middle a tap must land. */
  height: 96,
  reach: 54,
  /** How far from where it sits it leaps out of, or dives into, the water. */
  splashOffset: 50,
} as const;

export type FrogPhase = 'hidden' | 'emerging' | 'sitting' | 'hopping' | 'diving' | 'cheering';

export type FrogEvent = { type: 'emerged'; at: Point } | { type: 'hopped' } | { type: 'dived'; at: Point } | { type: 'cheered' };

/** How to draw the frog this frame. */
export interface FrogPose {
  /** Where its feet are. */
  at: Point;
  /** 1 faces right, −1 left. */
  facing: 1 | -1;
  scale: number;
  /** A full turn while it cheers, in radians. */
  spin: number;
  /** 0..1 through a cheer, 0 otherwise: the "Ribbit!" and the hearts. */
  cheer: number;
  airborne: boolean;
}

export interface Frog {
  readonly phase: FrogPhase;
  /** Where it sits, or is landing. */
  readonly spot: Point | null;
  step(dt: number, spots: readonly Point[]): FrogEvent[];
  /** A tap: it cheers if the tap is on it while it sits. */
  tap(point: Point): FrogEvent[];
  hit(point: Point): boolean;
  pose(): FrogPose | null;
  /** The board changed under it: whatever it is doing, it dives. */
  scatter(): void;
}

const ease = (t: number): number => t * t * (3 - 2 * t);
const lerp = (from: number, to: number, t: number): number => from + (to - from) * t;
const same = (a: Point, b: Point): boolean => a.x === b.x && a.y === b.y;

export function createFrog(rng: Rng): Frog {
  const between = (low: number, high: number): number => low + rng.next() * (high - low);

  let phase: FrogPhase = 'hidden';
  let wait = between(FROG.firstMin, FROG.firstMax);
  let t = 0;
  let duration = 0;
  let spot: Point | null = null;
  let from: Point = { x: 0, y: 0 };
  let to: Point = { x: 0, y: 0 };
  let hops = 0;
  let facing: 1 | -1 = 1;

  const pick = (spots: readonly Point[], not: Point | null): Point | null => {
    const options = spots.filter((each) => !not || !same(each, not));
    return options.length > 0 ? rng.pick(options) : null;
  };

  const sit = (): void => {
    phase = 'sitting';
    t = 0;
    duration = between(FROG.sitMin, FROG.sitMax);
  };

  const dive = (): void => {
    if (!spot) return;
    from = spot;
    to = { x: spot.x + FROG.splashOffset * facing, y: spot.y + FROG.splashOffset };
    phase = 'diving';
    t = 0;
    duration = FROG.diveSeconds;
  };

  const sitting = (): boolean => phase === 'sitting' || phase === 'cheering';

  const hit = (point: Point): boolean =>
    sitting() && spot !== null && Math.hypot(point.x - spot.x, point.y - (spot.y - FROG.height / 2)) <= FROG.reach;

  return {
    get phase() {
      return phase;
    },
    get spot() {
      return spot;
    },

    step(dt, spots) {
      const events: FrogEvent[] = [];
      t += dt;
      switch (phase) {
        case 'hidden': {
          wait -= dt;
          if (wait > 0) break;
          const next = pick(spots, null);
          if (!next) {
            wait = 2; // nowhere to sit just now; look again shortly
            break;
          }
          spot = next;
          facing = rng.next() < 0.5 ? 1 : -1;
          from = { x: next.x - FROG.splashOffset * facing, y: next.y + FROG.splashOffset };
          to = next;
          hops = FROG.hopsMin + rng.int(FROG.hopsMax - FROG.hopsMin + 1);
          phase = 'emerging';
          t = 0;
          duration = FROG.emergeSeconds;
          events.push({ type: 'emerged', at: from });
          break;
        }
        case 'emerging':
        case 'hopping':
          if (t >= duration) sit();
          break;
        case 'cheering':
          if (t >= duration) sit();
          break;
        case 'sitting': {
          if (t < duration) break;
          const next = hops > 0 && spot ? pick(spots, spot) : null;
          if (next && spot) {
            hops -= 1;
            from = spot;
            to = next;
            facing = next.x >= spot.x ? 1 : -1;
            spot = next;
            phase = 'hopping';
            t = 0;
            duration = FROG.hopSeconds;
            events.push({ type: 'hopped' });
          } else {
            dive();
          }
          break;
        }
        case 'diving':
          if (t >= duration) {
            events.push({ type: 'dived', at: to });
            phase = 'hidden';
            spot = null;
            wait = between(FROG.hiddenMin, FROG.hiddenMax);
          }
          break;
      }
      return events;
    },

    tap(point) {
      if (phase !== 'sitting' || !hit(point)) return [];
      phase = 'cheering';
      t = 0;
      duration = FROG.cheerSeconds;
      return [{ type: 'cheered' }];
    },

    hit,

    pose() {
      if (phase === 'hidden' || !spot) return null;
      const p = Math.min(1, t / Math.max(duration, 0.0001));
      switch (phase) {
        case 'emerging':
        case 'hopping': {
          const height = phase === 'hopping' ? 90 : 70;
          const along = ease(p);
          return {
            at: { x: lerp(from.x, to.x, along), y: lerp(from.y, to.y, along) - Math.sin(Math.PI * p) * height },
            facing,
            scale: phase === 'emerging' ? 0.6 + 0.4 * p : 1,
            spin: 0,
            cheer: 0,
            airborne: true,
          };
        }
        case 'diving': {
          const along = ease(p);
          return {
            at: { x: lerp(from.x, to.x, along), y: lerp(from.y, to.y, along) - Math.sin(Math.PI * p) * 40 },
            facing,
            scale: 1 - 0.5 * p,
            spin: 0,
            cheer: 0,
            airborne: true,
          };
        }
        case 'cheering':
          return { at: { x: spot.x, y: spot.y - Math.sin(Math.PI * p) * 30 }, facing, scale: 1, spin: ease(p) * Math.PI * 2, cheer: p, airborne: false };
        default:
          return { at: spot, facing, scale: 1, spin: 0, cheer: 0, airborne: false };
      }
    },

    scatter() {
      if (phase !== 'hidden' && phase !== 'diving') dive();
    },
  };
}
