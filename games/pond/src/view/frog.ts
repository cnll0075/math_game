import type { Point, Rng } from '@bundle/core';

/**
 * The frog's habits, in one place. It is decoration: it never stops on the
 * screen, only leaps out of the water and straight back in, and nothing it does
 * touches the board.
 */
export const FROG = {
  /** The first visit comes sooner than later ones, so a child meets it early. */
  firstMin: 3,
  firstMax: 7,
  /** How long it stays under between visits. */
  hiddenMin: 6,
  hiddenMax: 14,
  /** Leaps in one visit, with a short beat underwater between each. */
  leapsMin: 1,
  leapsMax: 3,
  underMin: 0.25,
  underMax: 0.6,
  /** One leap, out of the water and back in. Long enough to reach out and tap. */
  leapSeconds: 1.2,
  /** How high a leap arcs. */
  arc: 160,
  /** A leap prefers somewhere this near; the far side of the pond if nowhere is. */
  near: 520,
  cheerSeconds: 1.2,
  /** How tall it is, and how near its middle a tap must land. */
  height: 96,
  reach: 54,
} as const;

export type FrogPhase = 'hidden' | 'leaping' | 'under';

export type FrogEvent = { type: 'emerged'; at: Point } | { type: 'dived'; at: Point } | { type: 'cheered' };

/** How to draw the frog this frame. */
export interface FrogPose {
  /** Where its feet are. */
  at: Point;
  /** 1 faces right, −1 left. */
  facing: 1 | -1;
  scale: number;
  /** Leaning into the leap: nose up going out, nose down coming in. */
  tilt: number;
  /** A full turn while it cheers, in radians. */
  spin: number;
  /** 0..1 through a cheer, 0 otherwise: the "Ribbit!" and the hearts. */
  cheer: number;
}

export interface Frog {
  readonly phase: FrogPhase;
  step(dt: number, spots: readonly Point[]): FrogEvent[];
  /** A tap: it cheers if the tap is on it while it is in the air. */
  tap(point: Point): FrogEvent[];
  hit(point: Point): boolean;
  pose(): FrogPose | null;
  /** The board changed: it finishes this leap and then stays under. */
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
  let from: Point = { x: 0, y: 0 };
  let to: Point = { x: 0, y: 0 };
  let leapsLeft = 0;
  /** Seconds into a cheer, or null when not cheering. */
  let cheering: number | null = null;

  /** Somewhere to land: not where it is, and near if anywhere near is open. */
  const landing = (spots: readonly Point[], start: Point): Point | null => {
    const others = spots.filter((spot) => !same(spot, start));
    const near = others.filter((spot) => Math.hypot(spot.x - start.x, spot.y - start.y) <= FROG.near);
    const options = near.length > 0 ? near : others;
    return options.length > 0 ? rng.pick(options) : null;
  };

  /** Out of the water at `start`; false if there is nowhere to land. */
  const leapFrom = (start: Point, spots: readonly Point[]): boolean => {
    const end = landing(spots, start);
    if (!end) return false;
    from = start;
    to = end;
    phase = 'leaping';
    t = 0;
    return true;
  };

  const pose = (): FrogPose | null => {
    if (phase !== 'leaping') return null;
    const p = Math.min(1, t / FROG.leapSeconds);
    const along = ease(p);
    const lift = Math.sin(Math.PI * p);
    const cheer = cheering === null ? 0 : Math.min(1, cheering / FROG.cheerSeconds);
    return {
      at: { x: lerp(from.x, to.x, along), y: lerp(from.y, to.y, along) - lift * FROG.arc },
      facing: to.x >= from.x ? 1 : -1,
      // Rising out of the water at the start, sinking back in at the end.
      scale: 0.65 + 0.35 * Math.min(1, lift * 2),
      tilt: (0.5 - p) * 0.9,
      spin: ease(cheer) * Math.PI * 2,
      cheer,
    };
  };

  const hit = (point: Point): boolean => {
    const now = pose();
    return now !== null && Math.hypot(point.x - now.at.x, point.y - (now.at.y - FROG.height / 2)) <= FROG.reach;
  };

  return {
    get phase() {
      return phase;
    },

    step(dt, spots) {
      const events: FrogEvent[] = [];
      if (cheering !== null) {
        cheering += dt;
        if (cheering >= FROG.cheerSeconds) cheering = null;
      }
      switch (phase) {
        case 'hidden': {
          wait -= dt;
          if (wait > 0) break;
          const start = spots.length > 0 ? rng.pick(spots) : null;
          leapsLeft = FROG.leapsMin + rng.int(FROG.leapsMax - FROG.leapsMin + 1);
          if (start && leapFrom(start, spots)) {
            events.push({ type: 'emerged', at: start });
          } else {
            wait = 2; // no open water just now; look again shortly
          }
          break;
        }
        case 'leaping':
          t += dt;
          if (t < FROG.leapSeconds) break;
          events.push({ type: 'dived', at: to });
          cheering = null;
          leapsLeft -= 1;
          if (leapsLeft > 0) {
            phase = 'under';
            wait = between(FROG.underMin, FROG.underMax);
          } else {
            phase = 'hidden';
            wait = between(FROG.hiddenMin, FROG.hiddenMax);
          }
          break;
        case 'under':
          wait -= dt;
          if (wait > 0) break;
          // Straight back out from where it went in, if it is still open water.
          if (spots.some((spot) => same(spot, to)) && leapFrom(to, spots)) {
            events.push({ type: 'emerged', at: from });
          } else {
            phase = 'hidden';
            wait = between(FROG.hiddenMin, FROG.hiddenMax);
          }
          break;
      }
      return events;
    },

    tap(point) {
      if (cheering !== null || !hit(point)) return [];
      cheering = 0;
      return [{ type: 'cheered' }];
    },

    hit,
    pose,

    scatter() {
      leapsLeft = Math.min(leapsLeft, 1);
      if (phase === 'under') {
        phase = 'hidden';
        wait = between(FROG.hiddenMin, FROG.hiddenMax);
      }
    },
  };
}
