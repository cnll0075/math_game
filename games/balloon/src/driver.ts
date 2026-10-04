import type { Intent } from './intent.js';
import { RESCUES, chapterOf, numberInChapter } from './logic/levels.data.js';
import type { Outcome } from './logic/outcome.js';
import { MAX_STARS, startIndex, totalStars } from './logic/progress.js';
import { createRescue, liftedValues, type Rescue, type RescueEvent, type RescueState } from './logic/rescue.js';
import { kitsOf, weightsOf, type ChapterDef } from './logic/rescue-def.js';
import { recordStars, starsFor, type StarBook } from './logic/stars.js';
import { countSeconds, flySeconds, TIMING } from './view/timing.js';

export type Phase = 'building' | 'flying' | 'rescued' | 'finished';

/** One "Let go!": the count, then the flight. `t` runs across both. One entry per kit. */
export interface Flight {
  outcomes: readonly Outcome[];
  t: number;
  count: number;
  fly: number;
  lifted: readonly (readonly number[])[];
}

export type DriverEvent =
  | RescueEvent
  | { type: 'selected'; kit: number }
  | { type: 'chapter'; chapter: ChapterDef }
  | { type: 'landed'; outcomes: readonly Outcome[] }
  | { type: 'rescued'; id: string; stars: number; book: StarBook }
  | { type: 'finished' };

/** Everything the scene draws from. */
export interface SceneModel {
  rescue: RescueState;
  chapter: ChapterDef;
  number: number;
  phase: Phase;
  flight: Flight | null;
  /** The last wrong try, one outcome per kit, until the bunch changes. */
  feedback: readonly Outcome[] | null;
  earned: number | null;
  totalStars: number;
  maxStars: number;
  /** The kit a tapped balloon goes to. */
  selected: number;
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
  readonly feedback: readonly Outcome[] | null;
  readonly earned: number | null;
  readonly book: StarBook;
  readonly selected: number;
  /**
   * Whether a tap may move on. Not until the sum and every star have been
   * shown: a child still tapping as the kit lands would otherwise skip the
   * teaching beat without ever seeing it.
   */
  readonly readyForNext: boolean;
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
  let feedback: readonly Outcome[] | null = null;
  let earned: number | null = null;
  let selected = 0;
  /** Seconds since the rescue landed. */
  let since = 0;
  let pending: DriverEvent[] = [{ type: 'chapter', chapter: chapterOf(rescue.state.def) }];

  const open = (next: number): DriverEvent[] => {
    const before = chapterOf(rescue.state.def);
    index = next;
    rescue = rescueAt(index);
    phase = 'building';
    flight = null;
    feedback = null;
    earned = null;
    selected = 0;
    since = 0;
    const chapter = chapterOf(rescue.state.def);
    return chapter === before ? [] : [{ type: 'chapter', chapter }];
  };

  const build = (intent: Intent): DriverEvent[] => {
    switch (intent.kind) {
      case 'tray':
        return rescue.clip(intent.index, intent.kit ?? selected);
      case 'clipped':
        return rescue.unclip(intent.kit, intent.slot);
      case 'tied':
        return rescue.togglePop(intent.index);
      case 'select':
        if (intent.kit < 0 || intent.kit >= kitsOf(rescue.state.def) || intent.kit === selected) return [];
        selected = intent.kit;
        return [{ type: 'selected', kit: selected }];
      case 'reset':
        return rescue.startOver();
      case 'letGo':
        return rescue.letGo();
      case 'next':
        return [];
    }
  };

  const readyForNext = (): boolean =>
    phase === 'finished' ||
    (phase === 'rescued' && since >= TIMING.starsDelaySeconds + (earned ?? 0) * TIMING.starSeconds);

  return {
    get readyForNext() {
      return readyForNext();
    },
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
    get selected() {
      return selected;
    },

    act(intent) {
      if (phase === 'rescued' || phase === 'finished') {
        if (intent.kind !== 'next' || !readyForNext()) return [];
        if (phase === 'finished') return open(0);
        if (index + 1 >= RESCUES.length) {
          phase = 'finished';
          return [{ type: 'finished' }];
        }
        return open(index + 1);
      }
      if (phase !== 'building') return [];

      const events = build(intent);
      if (events.some((event) => event.type !== 'selected')) feedback = null;
      for (const event of events) {
        if (event.type !== 'released') continue;
        const lifted = weightsOf(rescue.state.def).map((_, kit) => liftedValues(rescue.state, kit));
        flight = {
          outcomes: event.outcomes,
          t: 0,
          count: countSeconds(lifted.flat().length),
          fly: flySeconds(event.outcomes),
          lifted,
        };
        phase = 'flying';
      }
      return events;
    },

    step(dt) {
      const events = pending;
      pending = [];
      if (phase === 'rescued') since += dt;
      if (phase !== 'flying' || !flight) return events;

      flight.t += dt;
      if (flight.t < flight.count + flight.fly) return events;

      const outcomes = flight.outcomes;
      flight = null;
      events.push({ type: 'landed', outcomes });
      if (outcomes.every((outcome) => outcome.verdict === 'exact')) {
        const id = rescue.state.def.id;
        earned = starsFor(rescue.state.tries);
        book = recordStars(book, id, earned);
        phase = 'rescued';
        since = 0;
        events.push({ type: 'rescued', id, stars: earned, book });
      } else {
        phase = 'building';
        feedback = outcomes;
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
      selected,
    }),
  };
}
