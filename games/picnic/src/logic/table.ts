import type { Point } from '@bundle/core';
import type { FoodId, FriendId, TreatId } from './friends.js';
import type { Course, LevelDef } from './levels.data.js';

/** The dial shares this many each at most. */
export const DIAL_MAX = 10;

export const CUTTING = {
  /** A cut counts only if its line passes this near the middle, in radii. */
  centre: 0.2,
  /** A swipe shorter than this, in radii, is not a cut at all. */
  shortest: 1.2,
  /** Two cuts for quarters must cross square, give or take this, radians: else the pieces are not equal. */
  square: Math.PI / 9,
} as const;

/** What a finished course came to, for the card: `12 cookies, 3 friends: 4 each`. */
export interface Summary {
  item: TreatId | FoodId;
  count: number;
  friends: number;
  each: number;
  leftover: number;
}

/** A cut accepted through the middle of the food: its direction, radians in [0, π). */
export interface Cut {
  angle: number;
}

/**
 * `sharing` — treats in the basket, going onto plates.
 * `chairs` — choosing how many sit down.
 * `cutting` — a whole pizza or cake, being cut.
 * `between` — a course is finished and shown; the next is about to come out.
 * `done` — the round is over.
 */
export type TablePhase = 'sharing' | 'chairs' | 'cutting' | 'between' | 'done';

export interface TableState {
  def: LevelDef;
  /** Which of the round's courses is on the table. */
  course: number;
  /** Who is sitting at the table now, left to right. */
  seated: FriendId[];
  /** How many each seated friend has, in the same order. */
  plates: number[];
  /** Treats still to share. */
  basket: number;
  /** How many each per share, or how many chairs. */
  dial: number;
  /** Shares made with the dial, over the whole round: what the stars count. */
  shares: number;
  cuts: Cut[];
  phase: TablePhase;
  summaries: Summary[];
  /** Treats Biscuit has had, over the whole round. */
  biscuit: number;
}

export type TableEvent =
  | { type: 'gave'; plate: number }
  | { type: 'refused'; plate: number }
  | { type: 'shared'; each: number }
  | { type: 'short'; need: number; have: number }
  | { type: 'leftover'; count: number }
  | { type: 'course'; summary: Summary }
  | { type: 'next'; course: number }
  | { type: 'seated'; chairs: number }
  | { type: 'unseated'; chairs: number; leftover: number }
  /** A refused cut says why: it missed the middle, or it does not cross the first one square. */
  | { type: 'cut'; ok: true }
  | { type: 'cut'; ok: false; why: 'middle' | 'cross' }
  | { type: 'served' }
  | { type: 'done' };

export interface Table {
  readonly state: TableState;
  /** Give one treat to this plate (tapping rounds). */
  tap(plate: number): TableEvent[];
  /** Turn the dial up or down one. */
  turnDial(step: 1 | -1): TableEvent[];
  /** Share the dial's number to every plate; in a chairs course, seat that many. */
  share(): TableEvent[];
  /** Cut across the food, from one point to another, relative to its middle in radii. */
  cut(from: Point, to: Point): TableEvent[];
  /** Bring out the next course, after the last has been shown. */
  nextCourse(): TableEvent[];
}

export const courseOf = (state: TableState): Course => state.def.courses[state.course]!;

/** What the next share would do: how many each would have, whether it fits, what would be left for Biscuit. */
export function preview(state: TableState): { each: number; fits: boolean; leftover: number } {
  const course = courseOf(state);
  if (state.phase === 'chairs' && course.kind === 'chairs') {
    return { each: Math.floor(course.count / state.dial), fits: course.count % state.dial === 0, leftover: course.count % state.dial };
  }
  const friends = Math.max(1, state.seated.length);
  const need = state.dial * friends;
  const fits = need <= state.basket;
  const after = fits ? state.basket - need : state.basket;
  return { each: (state.plates[0] ?? 0) + state.dial, fits, leftover: fits && after < friends ? after : 0 };
}

export function createTable(def: LevelDef): Table {
  const state: TableState = {
    def,
    course: 0,
    seated: [],
    plates: [],
    basket: 0,
    dial: 1,
    shares: 0,
    cuts: [],
    phase: 'sharing',
    summaries: [],
    biscuit: 0,
  };

  const enter = (): void => {
    const course = courseOf(state);
    state.cuts = [];
    state.dial = 1;
    if (course.kind === 'share') {
      state.phase = 'sharing';
      state.seated = [...def.friends];
      state.basket = course.count;
    } else if (course.kind === 'chairs') {
      state.phase = 'chairs';
      state.seated = [];
      state.basket = course.count;
      state.dial = course.choices[0]!;
    } else {
      state.phase = 'cutting';
      state.seated = [...def.friends];
      state.basket = 0;
    }
    state.plates = state.seated.map(() => 0);
  };

  /** The course is over: what cannot go round goes to Biscuit, and the round moves on. */
  const finish = (events: TableEvent[], item: TreatId | FoodId, count: number): void => {
    const leftover = state.basket;
    if (leftover > 0) {
      state.biscuit += leftover;
      state.basket = 0;
      events.push({ type: 'leftover', count: leftover });
    }
    const summary = { item, count, friends: state.seated.length, each: state.plates[0] ?? 0, leftover };
    state.summaries.push(summary);
    events.push({ type: 'course', summary });
    if (state.course + 1 < def.courses.length) {
      state.phase = 'between';
    } else {
      state.phase = 'done';
      events.push({ type: 'done' });
    }
  };

  /** After every gift: when the basket cannot give everyone one more, the course is over. */
  const settle = (events: TableEvent[]): void => {
    const course = courseOf(state);
    if (course.kind === 'cut') return;
    const equal = state.plates.every((count) => count === state.plates[0]);
    if (equal && state.basket < state.seated.length) finish(events, course.treat, course.count);
  };

  enter();

  return {
    state,

    tap(plate) {
      const course = courseOf(state);
      if (state.phase !== 'sharing' || course.kind !== 'share' || course.mode !== 'tap') return [];
      if (plate < 0 || plate >= state.plates.length) return [];
      // Everyone gets one before anyone gets two.
      if (state.plates[plate]! > Math.min(...state.plates)) return [{ type: 'refused', plate }];
      state.plates[plate]! += 1;
      state.basket -= 1;
      const events: TableEvent[] = [{ type: 'gave', plate }];
      settle(events);
      return events;
    },

    turnDial(step) {
      const course = courseOf(state);
      if (state.phase === 'chairs' && course.kind === 'chairs') {
        const at = course.choices.indexOf(state.dial);
        state.dial = course.choices[Math.max(0, Math.min(course.choices.length - 1, at + step))]!;
        return [];
      }
      if (state.phase !== 'sharing') return [];
      state.dial = Math.max(1, Math.min(DIAL_MAX, state.dial + step));
      return [];
    },

    share() {
      const course = courseOf(state);
      if (state.phase === 'chairs' && course.kind === 'chairs') {
        const chairs = state.dial;
        const leftover = course.count % chairs;
        // Only a number of chairs that shares with nothing over seats anyone.
        if (leftover !== 0) return [{ type: 'unseated', chairs, leftover }];
        state.seated = def.friends.slice(0, chairs);
        state.plates = state.seated.map(() => 0);
        state.phase = 'sharing';
        state.dial = 1;
        return [{ type: 'seated', chairs }];
      }
      if (state.phase !== 'sharing' || (course.kind === 'share' && course.mode === 'tap')) return [];
      const need = state.dial * state.seated.length;
      if (need > state.basket) return [{ type: 'short', need, have: state.basket }];
      state.plates = state.plates.map((count) => count + state.dial);
      state.basket -= need;
      state.shares += 1;
      const events: TableEvent[] = [{ type: 'shared', each: state.dial }];
      settle(events);
      return events;
    },

    cut(from, to) {
      const course = courseOf(state);
      if (state.phase !== 'cutting' || course.kind !== 'cut') return [];
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const length = Math.hypot(dx, dy);
      if (length < CUTTING.shortest) return [];
      // How near the swipe itself, as drawn, comes to the middle: a swipe
      // heading away from the food never reaches it, wherever its line would go.
      const along = Math.max(0, Math.min(1, -(from.x * dx + from.y * dy) / (length * length)));
      const miss = Math.hypot(from.x + dx * along, from.y + dy * along);
      const angle = ((Math.atan2(dy, dx) % Math.PI) + Math.PI) % Math.PI;
      const square = state.cuts.every((cut) => Math.abs(Math.abs(cut.angle - angle) - Math.PI / 2) <= CUTTING.square);
      if (miss > CUTTING.centre) return [{ type: 'cut', ok: false, why: 'middle' }];
      if (!square) return [{ type: 'cut', ok: false, why: 'cross' }];
      state.cuts.push({ angle });
      const events: TableEvent[] = [{ type: 'cut', ok: true }];
      if (state.cuts.length * 2 >= course.pieces) {
        state.plates = state.seated.map(() => 1);
        events.push({ type: 'served' });
        finish(events, course.food, 1);
      }
      return events;
    },

    nextCourse() {
      if (state.phase !== 'between') return [];
      state.course += 1;
      enter();
      return [{ type: 'next', course: state.course }];
    },
  };
}
