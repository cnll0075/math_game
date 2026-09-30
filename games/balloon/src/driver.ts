import type { Intent } from './intent.js';
import { RESCUES, chapterOf, numberInChapter } from './logic/levels.data.js';
import type { Outcome } from './logic/outcome.js';
import { MAX_STARS, startIndex, totalStars } from './logic/progress.js';
import { createRescue, liftedValues, type Rescue, type RescueEvent, type RescueState } from './logic/rescue.js';
import type { ChapterDef } from './logic/rescue-def.js';
import { recordStars, starsFor, type StarBook } from './logic/stars.js';
import { countSeconds, flySeconds } from './view/timing.js';

export type Phase = 'building' | 'flying' | 'rescued' | 'finished';

/** One "Let go!": the count, then the flight. `t` runs across both. */
export interface Flight {
  outcome: Outcome;
  t: number;
  count: number;
  fly: number;
  lifted: readonly number[];
}

export type DriverEvent =
  | RescueEvent
  | { type: 'chapter'; chapter: ChapterDef }
  | { type: 'landed'; outcome: Outcome }
  | { type: 'rescued'; id: string; stars: number; book: StarBook }
  | { type: 'finished' };

/** Everything the scene draws from. */
export interface SceneModel {
  rescue: RescueState;
  chapter: ChapterDef;
  number: number;
  phase: Phase;
  flight: Flight | null;
  feedback: Outcome | null;
  earned: number | null;
  totalStars: number;
  maxStars: number;
}

export interface DriverOptions {
  book: StarBook;
  /** A rescue or chapter id from the URL. Anything unrecognised opens where the player left off. */
  startLevel?: string;
}

/**
 * Strings rescues together. Scene, sound, input and the frame loop all talk to
 * the rescue through this, so none of them need to know when a flight ends or
 * which rescue comes next.
 */
export interface Driver {
  readonly phase: Phase;
  readonly rescue: Rescue;
  readonly flight: Flight | null;
  /** The last wrong try, until the bunch changes. */
  readonly feedback: Outcome | null;
  /** Stars for the rescue just finished. */
  readonly earned: number | null;
  readonly book: StarBook;
  step(dt: number): DriverEvent[];
  act(intent: Intent): DriverEvent[];
  model(): SceneModel;
}

const rescueAt = (index: number): Rescue => {
  const def = RESCUES[index];
  if (!def) throw new Error(`no rescue at ${index}`);
  return createRescue(def);
};

export function createDriver(options: DriverOptions): Driver {
  let book = options.book;
  let index = startIndex(book, options.startLevel);
  let rescue = rescueAt(index);
  let phase: Phase = 'building';
  let flight: Flight | null = null;
  let feedback: Outcome | null = null;
  let earned: number | null = null;
  let pending: DriverEvent[] = [{ type: 'chapter', chapter: chapterOf(rescue.state.def) }];

  const open = (next: number): DriverEvent[] => {
    const before = chapterOf(rescue.state.def);
    index = next;
    rescue = rescueAt(index);
    phase = 'building';
    flight = null;
    feedback = null;
    earned = null;
    const chapter = chapterOf(rescue.state.def);
    return chapter === before ? [] : [{ type: 'chapter', chapter }];
  };

  const build = (intent: Intent): RescueEvent[] => {
    switch (intent.kind) {
      case 'tray':
        return rescue.clip(intent.index);
      case 'clipped':
        return rescue.unclip(intent.slot);
      case 'tied':
        return rescue.togglePop(intent.index);
      case 'puff':
        return rescue.puff(intent.index);
      case 'puffSlot':
        return rescue.unpuff(intent.slot);
      case 'letGo':
        return rescue.letGo();
      case 'next':
        return [];
    }
  };

  return {
    get phase() {
      return phase;
    },
    get rescue() {
      return rescue;
    },
    get flight() {
      return flight;
    },
    get feedback() {
      return feedback;
    },
    get earned() {
      return earned;
    },
    get book() {
      return book;
    },

    act(intent) {
      if (phase === 'rescued' || phase === 'finished') {
        if (intent.kind !== 'next') return [];
        if (phase === 'finished') return open(0);
        if (index + 1 >= RESCUES.length) {
          phase = 'finished';
          return [{ type: 'finished' }];
        }
        return open(index + 1);
      }
      if (phase !== 'building') return [];

      const events = build(intent);
      if (events.length > 0) feedback = null;
      for (const event of events) {
        if (event.type !== 'released') continue;
        const lifted = liftedValues(rescue.state);
        flight = {
          outcome: event.outcome,
          t: 0,
          count: countSeconds(lifted.length),
          fly: flySeconds(event.outcome),
          lifted,
        };
        phase = 'flying';
      }
      return events;
    },

    step(dt) {
      const events = pending;
      pending = [];
      if (phase !== 'flying' || !flight) return events;

      flight.t += dt;
      if (flight.t < flight.count + flight.fly) return events;

      const outcome = flight.outcome;
      flight = null;
      events.push({ type: 'landed', outcome });
      if (outcome.verdict === 'exact') {
        const id = rescue.state.def.id;
        earned = starsFor(rescue.state.tries);
        book = recordStars(book, id, earned);
        phase = 'rescued';
        events.push({ type: 'rescued', id, stars: earned, book });
      } else {
        phase = 'building';
        feedback = outcome;
      }
      return events;
    },

    model: () => ({
      rescue: rescue.state,
      chapter: chapterOf(rescue.state.def),
      number: numberInChapter(rescue.state.def),
      phase,
      flight,
      feedback,
      earned,
      totalStars: totalStars(book),
      maxStars: MAX_STARS,
    }),
  };
}
