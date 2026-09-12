import { createGame } from './game.js';
import type { LevelDef } from './level.js';
import type { Side } from './seesaw-state.js';

/**
 * Levels 1-5, the puzzle half. Progression is Balance -> Compare -> Add ->
 * Target -> Plan: the arithmetic barely grows, the kind of thinking does.
 */
export const LEVELS: readonly LevelDef[] = [
  {
    id: 'level-1',
    mode: 'puzzle',
    title: 'Balance',
    objective: { kind: 'balance' },
    initial: { left: ['rabbit', 'rabbit', 'rabbit'], right: ['rabbit'] },
    tray: ['rabbit', 'rabbit'],
    hint: 'Make it level',
  },
  {
    id: 'level-2',
    mode: 'puzzle',
    title: 'Same Weight',
    objective: { kind: 'balance' },
    // Rabbits only in the tray: the child cannot match cat with cat, so the
    // only way through is discovering that two rabbits weigh the same as one.
    initial: { left: ['cat'], right: [] },
    tray: ['rabbit', 'rabbit', 'rabbit'],
    hint: 'Make it level',
  },
  {
    id: 'level-3',
    mode: 'puzzle',
    title: 'Go Down',
    objective: { kind: 'sideDown', side: 'right' },
    initial: { left: ['dog'], right: ['rabbit'] },
    tray: ['cat', 'rabbit', 'dog'],
    hint: 'Make the right side go down',
  },
  {
    id: 'level-4',
    mode: 'puzzle',
    title: 'Reach the Star',
    // The star sits one unit below level on the right, so the player must add
    // exactly four more units to the right than to the left: dog+rabbit,
    // cat+cat, or cat+rabbit+rabbit all work.
    objective: { kind: 'tilt', target: -1 },
    initial: { left: ['bear'], right: ['cat'] },
    tray: ['dog', 'cat', 'rabbit', 'rabbit', 'cat'],
    hint: 'Reach the star',
  },
  {
    id: 'level-5',
    mode: 'puzzle',
    title: 'Three Challenges',
    objective: {
      kind: 'sequence',
      challenges: [{ kind: 'balance' }, { kind: 'sideDown', side: 'right' }, { kind: 'tilt', target: -2 }],
    },
    initial: { left: ['cat'], right: ['rabbit'] },
    tray: ['rabbit', 'rabbit', 'dog', 'cat', 'rabbit', 'bear'],
    hint: 'Three challenges in a row',
  },
];

export const getLevel = (id: string): LevelDef | undefined => LEVELS.find((level) => level.id === id);

export interface SolutionMove {
  trayIndex: number;
  side: Side;
}

export type TraySelection = readonly SolutionMove[];

const SIDES: readonly Side[] = ['left', 'right'];

/**
 * Every way to win a level, found by replaying real games rather than by
 * reasoning about weights: breadth-first over the moves the player could make,
 * so a level that the reducer would refuse to clear is reported as unsolvable.
 * Trays stay small, so the search stays cheap.
 */
export function solutionsFor(level: LevelDef): TraySelection[] {
  const solutions: TraySelection[] = [];
  const seen = new Set<string>();
  const queue: TraySelection[] = [[]];

  const replay = (moves: TraySelection) => {
    const game = createGame(level);
    for (const move of moves) game.place(move.trayIndex, move.side);
    return game;
  };

  while (queue.length > 0) {
    const moves = queue.shift()!;
    const game = replay(moves);
    if (game.state.status === 'won') {
      solutions.push(moves);
      continue; // A won level takes no further moves.
    }

    for (const [index, item] of game.state.tray.entries()) {
      if (item.used) continue;
      for (const side of SIDES) {
        const next = [...moves, { trayIndex: index, side }];
        // Order of placement never changes the outcome, so canonicalise on the
        // set of (index, side) pairs to keep the search from exploding.
        const key = JSON.stringify([...next].sort((a, b) => a.trayIndex - b.trayIndex));
        if (seen.has(key)) continue;
        seen.add(key);
        queue.push(next);
      }
    }
  }

  return solutions;
}
