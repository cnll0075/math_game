import { createRng } from '@bundle/core';
import type { Intent } from './intent.js';
import { BOARDS, pairsOf, type BoardDef } from './logic/boards.data.js';
import { dealBoard } from './logic/deal.js';
import { createGame, type Game, type GameEvent, type GameState } from './logic/game.js';
import { isOpen, MAX_STARS, startIndex, totalStars } from './logic/progress.js';
import { recordStars, starsFor, type StarBook } from './logic/stars.js';
import { TIMING } from './view/timing.js';

export type Phase = 'playing' | 'cleared' | 'picking';

export type DriverEvent =
  | GameEvent
  | { type: 'board'; board: BoardDef }
  | { type: 'scored'; stars: number; book: StarBook }
  | { type: 'picker' };

/** Everything the scene draws from. */
export interface SceneModel {
  board: BoardDef;
  game: GameState;
  phase: Phase;
  earned: number | null;
  totalStars: number;
  maxStars: number;
  book: StarBook;
  /** Which boards the picker may open. */
  open: boolean[];
  index: number;
}

export interface DriverOptions {
  book: StarBook;
  /** A board id from the URL. Anything unrecognised opens where the player left off. */
  startLevel?: string;
  seed?: number;
}

/**
 * Strings boards together. Scene, sound, input and the frame loop all talk to
 * the board through this, so none of them need to know how long a missed pair
 * is held, or which board comes next.
 */
export interface Driver {
  readonly phase: Phase;
  readonly index: number;
  readonly game: Game;
  readonly book: StarBook;
  readonly earned: number | null;
  /** A missed pair is up and waiting to be put back. */
  readonly holding: boolean;
  /** Not until the stars have been shown: a quick tap must not skip them. */
  readonly readyForNext: boolean;
  step(dt: number): DriverEvent[];
  act(intent: Intent): DriverEvent[];
  model(): SceneModel;
}

export function createDriver(options: DriverOptions): Driver {
  const rng = createRng(options.seed ?? Math.floor(Date.now() % 1_000_000));
  const boardAt = (index: number): BoardDef => {
    const board = BOARDS[index];
    if (!board) throw new Error(`no board at ${index}`);
    return board;
  };
  const deal = (index: number): Game => createGame(boardAt(index), dealBoard(boardAt(index), rng));

  let book = options.book;
  let index = startIndex(book, options.startLevel);
  let game = deal(index);
  let phase: Phase = 'playing';
  let resume: 'playing' | 'cleared' = 'playing';
  let hold = 0;
  let since = 0;
  let earned: number | null = null;
  let pending: DriverEvent[] = [{ type: 'board', board: boardAt(index) }];

  const open = (next: number): DriverEvent[] => {
    index = next;
    game = deal(index);
    phase = 'playing';
    hold = 0;
    since = 0;
    earned = null;
    return [{ type: 'board', board: boardAt(index) }];
  };

  /** What the game's own events mean for the driver: a hold to start, a board to score. */
  const after = (events: GameEvent[]): DriverEvent[] => {
    const out: DriverEvent[] = [...events];
    for (const event of events) {
      if (event.type === 'hidden') hold = 0;
      if (event.type === 'missed') hold = TIMING.missHold;
      if (event.type === 'cleared') {
        earned = starsFor(event.misses, pairsOf(boardAt(index)));
        book = recordStars(book, boardAt(index).id, earned);
        phase = 'cleared';
        since = 0;
        out.push({ type: 'scored', stars: earned, book });
      }
    }
    return out;
  };

  const readyForNext = (): boolean =>
    phase === 'cleared' && since >= TIMING.starsDelaySeconds + (earned ?? 0) * TIMING.starSeconds;

  return {
    get phase() {
      return phase;
    },
    get index() {
      return index;
    },
    get game() {
      return game;
    },
    get book() {
      return book;
    },
    get earned() {
      return earned;
    },
    get holding() {
      return hold > 0;
    },
    get readyForNext() {
      return readyForNext();
    },

    act(intent) {
      switch (intent.kind) {
        case 'picker':
          if (phase === 'picking') return [];
          resume = phase;
          phase = 'picking';
          return [{ type: 'picker' }];
        case 'close':
          if (phase !== 'picking') return [];
          phase = resume;
          return [];
        case 'pick':
          if (phase !== 'picking' || !isOpen(book, intent.index) || !BOARDS[intent.index]) return [];
          return open(intent.index);
        case 'flip':
          if (phase !== 'playing') return [];
          return after(game.flip(intent.index));
        case 'next':
          if (!readyForNext()) return [];
          return open(Math.min(index + 1, BOARDS.length - 1));
      }
    },

    step(dt) {
      const events = pending;
      pending = [];
      if (phase === 'cleared') since += dt;
      if (hold > 0 && phase === 'playing') {
        hold -= dt;
        if (hold <= 0) events.push(...after(game.hide()));
      }
      return events;
    },

    model: () => ({
      board: boardAt(index),
      game: game.state,
      phase,
      earned,
      totalStars: totalStars(book),
      maxStars: MAX_STARS,
      book,
      open: BOARDS.map((_, each) => isOpen(book, each)),
      index,
    }),
  };
}
