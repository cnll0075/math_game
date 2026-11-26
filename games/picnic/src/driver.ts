import type { Intent } from './intent.js';
import { LEVELS, type LevelDef } from './logic/levels.data.js';
import { MAX_STARS, startIndex, totalStars } from './logic/progress.js';
import { recordStars, starsFor, type StarBook } from './logic/stars.js';
import { createTable, type Table, type TableEvent, type TableState } from './logic/table.js';
import { TIMING } from './view/timing.js';

/**
 * `intro` — the round's title arrives; any tap starts.
 * `playing` — sharing.
 * `done` — everyone eats together, the card and the stars; a tap moves on.
 * `finished` — every round done.
 */
export type Phase = 'intro' | 'playing' | 'done' | 'finished';

export type DriverEvent =
  | TableEvent
  | { type: 'level'; level: LevelDef }
  | { type: 'won'; id: string; stars: number; book: StarBook }
  | { type: 'finished' };

/** Everything the scene draws from. */
export interface SceneModel {
  table: TableState;
  level: LevelDef;
  number: number;
  count: number;
  phase: Phase;
  /** Seconds in this phase. */
  since: number;
  earned: number | null;
  totalStars: number;
  maxStars: number;
}

export interface DriverOptions {
  book: StarBook;
  /** A round id from the URL. Anything unrecognised opens where the player left off. */
  startLevel?: string;
}

export interface Driver {
  readonly phase: Phase;
  readonly table: Table;
  readonly book: StarBook;
  readonly readyForNext: boolean;
  step(dt: number): DriverEvent[];
  act(intent: Intent): DriverEvent[];
  model(): SceneModel;
}

export function createDriver(options: DriverOptions): Driver {
  let book = options.book;
  let index = startIndex(book, options.startLevel);
  let table = createTable(LEVELS[index]!);
  let phase: Phase = 'intro';
  let since = 0;
  /** Seconds a finished course has been on show. */
  let between = 0;
  let earned: number | null = null;
  let pending: DriverEvent[] = [{ type: 'level', level: table.state.def }];

  const open = (next: number): DriverEvent[] => {
    index = next;
    table = createTable(LEVELS[index]!);
    phase = 'intro';
    since = 0;
    between = 0;
    earned = null;
    return [{ type: 'level', level: table.state.def }];
  };

  /** The round is over when the table says so: stars, kept. */
  const settle = (events: DriverEvent[]): DriverEvent[] => {
    if (phase !== 'playing' || table.state.phase !== 'done') return events;
    const id = table.state.def.id;
    earned = starsFor(table.state.def, table.state.shares);
    book = recordStars(book, id, earned);
    phase = 'done';
    since = 0;
    return [...events, { type: 'won', id, stars: earned, book }];
  };

  const readyForNext = (): boolean => phase === 'finished' || (phase === 'done' && since >= TIMING.doneHoldSeconds);

  return {
    get phase() {
      return phase;
    },
    get table() {
      return table;
    },
    get book() {
      return book;
    },
    get readyForNext() {
      return readyForNext();
    },

    step(dt) {
      const events: DriverEvent[] = pending;
      pending = [];
      since += dt;
      if (phase === 'intro' && since >= TIMING.introSeconds) {
        phase = 'playing';
        since = 0;
      }
      if (phase === 'playing' && table.state.phase === 'between') {
        between += dt;
        if (between >= TIMING.courseSeconds) {
          between = 0;
          events.push(...table.nextCourse());
        }
      }
      return settle(events);
    },

    act(intent) {
      if (phase === 'done' || phase === 'finished') {
        if (intent.kind !== 'next' || !readyForNext()) return [];
        if (phase === 'finished') return open(0);
        if (index + 1 >= LEVELS.length) {
          phase = 'finished';
          since = 0;
          return [{ type: 'finished' }];
        }
        return open(index + 1);
      }
      if (intent.kind === 'next') return [];
      // A child who acts during the title has started: the title can go.
      if (phase === 'intro') {
        phase = 'playing';
        since = 0;
      }
      switch (intent.kind) {
        case 'tap':
          return settle(table.tap(intent.plate));
        case 'dial':
          return settle(table.turnDial(intent.step));
        case 'share':
          return settle(table.share());
        case 'cut':
          return settle(table.cut(intent.from, intent.to));
      }
    },

    model: () => ({
      table: table.state,
      level: table.state.def,
      number: index + 1,
      count: LEVELS.length,
      phase,
      since,
      earned,
      totalStars: totalStars(book),
      maxStars: MAX_STARS,
    }),
  };
}
