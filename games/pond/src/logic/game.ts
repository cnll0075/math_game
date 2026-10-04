import { pairsOf, type BoardDef } from './boards.data.js';
import type { Card } from './deal.js';

export interface Pad {
  card: Card;
  up: boolean;
  matched: boolean;
}

export interface GameState {
  readonly board: BoardDef;
  pads: Pad[];
  /** The pad turned over first in this turn, waiting for its partner. */
  first: number | null;
  /** A missed pair, still up until it is put back. */
  pending: [number, number] | null;
  misses: number;
  matches: number;
  cleared: boolean;
}

export type GameEvent =
  | { type: 'flipped'; index: number }
  | { type: 'matched'; a: number; b: number; value: number }
  | { type: 'missed'; a: number; b: number }
  | { type: 'hidden'; a: number; b: number }
  | { type: 'cleared'; misses: number };

export interface Game {
  readonly state: GameState;
  flip(index: number): GameEvent[];
  /** Puts a missed pair back face down. */
  hide(): GameEvent[];
}

export const valueAt = (state: GameState, index: number): number | null => state.pads[index]?.card.sum?.value ?? null;

export function createGame(board: BoardDef, cards: Card[]): Game {
  const state: GameState = {
    board,
    pads: cards.map((card) => ({ card, up: card.sum === null, matched: false })),
    first: null,
    pending: null,
    misses: 0,
    matches: 0,
    cleared: false,
  };

  const hide = (): GameEvent[] => {
    if (!state.pending) return [];
    const [a, b] = state.pending;
    state.pads[a]!.up = false;
    state.pads[b]!.up = false;
    state.pending = null;
    return [{ type: 'hidden', a, b }];
  };

  return {
    state,
    hide,

    flip(index) {
      const pad = state.pads[index];
      if (state.cleared || !pad) return [];
      // Any tap on a pad during the hold — the ★ included — puts the missed
      // pair back first, so a quick child is never made to wait.
      const events = hide();
      if (pad.up || pad.card.sum === null) return events;

      pad.up = true;
      events.push({ type: 'flipped', index });
      if (state.first === null) {
        state.first = index;
        return events;
      }

      const first = state.first;
      state.first = null;
      const value = valueAt(state, first);
      if (value !== null && value === valueAt(state, index)) {
        state.pads[first]!.matched = true;
        pad.matched = true;
        state.matches += 1;
        events.push({ type: 'matched', a: first, b: index, value });
        if (state.matches === pairsOf(board)) {
          state.cleared = true;
          events.push({ type: 'cleared', misses: state.misses });
        }
      } else {
        state.misses += 1;
        state.pending = [first, index];
        events.push({ type: 'missed', a: first, b: index });
      }
      return events;
    },
  };
}
