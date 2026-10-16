import type { Intent } from './intent.js';
import { LEVELS, type LevelDef } from './logic/levels.data.js';
import { MAX_STARS, startIndex, totalStars } from './logic/progress.js';
import { recordStars, starsFor, type StarBook } from './logic/stars.js';
import { createWorld, hookTarget, type Outcome, type World, type WorldEvent, type WorldState } from './logic/world.js';
import { TIMING } from './view/timing.js';

/**
 * `intro` — the title arrives, the fish swim, the clock waits.
 * `fishing` — the clock runs.
 * `won` — the bucket is exactly full; stars, then a tap moves on.
 * `lost` — over, out of time or stuck; a tap (or a wait) starts the level again.
 * `finished` — every level done.
 */
export type Phase = 'intro' | 'fishing' | 'won' | 'lost' | 'finished';

export type DriverEvent =
  | WorldEvent
  | { type: 'level'; level: LevelDef; retry: boolean }
  | { type: 'won'; id: string; stars: number; book: StarBook }
  | { type: 'finished' };

/** Everything the scene draws from. */
export interface SceneModel {
  world: WorldState;
  level: LevelDef;
  number: number;
  count: number;
  phase: Phase;
  /** Seconds in this phase. */
  since: number;
  /** How the last attempt ended, while it is on screen. */
  outcome: Outcome | null;
  earned: number | null;
  totalStars: number;
  maxStars: number;
  /** Whether this is another go at the same level, for the banner. */
  retry: boolean;
}

export interface DriverOptions {
  book: StarBook;
  /** A level id from the URL. Anything unrecognised opens where the player left off. */
  startLevel?: string;
  /** Seeds each pond in turn, so tests can replay one. Random when absent. */
  seed?: () => number;
}

/** How far one press of an arrow key sails. */
export const NUDGE = 130;

export interface Driver {
  readonly phase: Phase;
  readonly world: World;
  readonly book: StarBook;
  readonly earned: number | null;
  /** Whether a tap may move on: not until the sum and the stars have been shown. */
  readonly readyForNext: boolean;
  step(dt: number): DriverEvent[];
  act(intent: Intent): DriverEvent[];
  model(): SceneModel;
}

export function createDriver(options: DriverOptions): Driver {
  const seed = options.seed ?? (() => Math.floor(Math.random() * 2 ** 31));
  let book = options.book;
  let index = startIndex(book, options.startLevel);
  let world = createWorld(LEVELS[index]!, { seed: seed() });
  let phase: Phase = 'intro';
  let since = 0;
  let earned: number | null = null;
  let retry = false;
  let pending: DriverEvent[] = [{ type: 'level', level: world.state.def, retry }];

  const open = (next: number, again: boolean): DriverEvent[] => {
    index = next;
    world = createWorld(LEVELS[index]!, { seed: seed() });
    phase = 'intro';
    since = 0;
    earned = null;
    retry = again;
    return [{ type: 'level', level: world.state.def, retry }];
  };

  const begin = (): void => {
    phase = 'fishing';
    since = 0;
    world.start();
  };

  const readyForNext = (): boolean => {
    if (phase === 'finished') return true;
    if (phase === 'won') return since >= TIMING.starsDelaySeconds + (earned ?? 0) * TIMING.starSeconds;
    if (phase === 'lost') return since >= TIMING.lostHoldSeconds;
    return false;
  };

  const moveOn = (): DriverEvent[] => {
    if (phase === 'finished') return open(0, false);
    if (phase === 'lost') return open(index, true);
    if (index + 1 >= LEVELS.length) {
      phase = 'finished';
      since = 0;
      return [{ type: 'finished' }];
    }
    return open(index + 1, false);
  };

  const settle = (events: WorldEvent[]): DriverEvent[] => {
    const outcome = world.state.outcome;
    if (!outcome || phase !== 'fishing') return events;
    since = 0;
    if (outcome !== 'full') {
      phase = 'lost';
      return events;
    }
    const id = world.state.def.id;
    earned = starsFor(world.state.timeLeft, world.state.def.seconds);
    book = recordStars(book, id, earned);
    phase = 'won';
    return [...events, { type: 'won', id, stars: earned, book }];
  };

  return {
    get phase() {
      return phase;
    },
    get world() {
      return world;
    },
    get book() {
      return book;
    },
    get earned() {
      return earned;
    },
    get readyForNext() {
      return readyForNext();
    },

    act(intent) {
      if (phase === 'won' || phase === 'lost' || phase === 'finished') {
        return intent.kind === 'next' && readyForNext() ? moveOn() : [];
      }
      if (intent.kind === 'next') return [];
      // A child who taps during the title has started: the title can go.
      if (phase === 'intro') begin();
      const state = world.state;
      switch (intent.kind) {
        case 'sail':
          return world.sail(intent.x);
        case 'nudge':
          return world.sail(hookTarget(state) + intent.dir * NUDGE);
        case 'cast':
          return settle(world.cast());
      }
    },

    step(dt) {
      const events: DriverEvent[] = pending;
      pending = [];
      since += dt;
      if (phase === 'intro' && since >= TIMING.introSeconds) begin();
      if (phase === 'lost' && since >= TIMING.lostAutoSeconds) return [...events, ...moveOn()];
      return [...events, ...settle(world.step(dt))];
    },

    model: () => ({
      world: world.state,
      level: world.state.def,
      number: index + 1,
      count: LEVELS.length,
      phase,
      since,
      outcome: world.state.outcome,
      earned,
      totalStars: totalStars(book),
      maxStars: MAX_STARS,
      retry,
    }),
  };
}
