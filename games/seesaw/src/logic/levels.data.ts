import { createGame } from './game.js';
import { isPuzzle, type ArcadeLevelDef, type LevelDef, type PuzzleLevelDef } from './level.js';
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

  // Levels 6-8: the arcade half. Animals arrive on their own and wander off on
  // their own, so the seesaw drifts whether or not the player acts. Difficulty
  // comes from pace and from how little room the danger meter allows, not from
  // harder sums.
  {
    id: 'level-6',
    mode: 'arcade',
    title: 'Keep It Safe',
    objective: { kind: 'survive', seconds: 30 },
    initial: { left: ['cat'], right: ['cat'] },
    arcade: {
      seed: 1206,
      pool: ['rabbit', 'cat', 'dog'],
      arrivalSeconds: 3,
      queueLength: 3,
      staySeconds: [10, 14],
      patienceSeconds: 3.5,
      dangerFillSeconds: 4,
      dangerDrainSeconds: 2,
      maxHeavyRun: 1,
    },
    hint: 'Keep everyone safe',
  },
  {
    id: 'level-7',
    mode: 'arcade',
    title: 'Faster',
    objective: { kind: 'survive', seconds: 40 },
    initial: { left: ['cat'], right: ['rabbit', 'rabbit'] },
    arcade: {
      seed: 1207,
      pool: ['rabbit', 'cat', 'dog', 'bear'],
      arrivalSeconds: 2,
      queueLength: 3,
      staySeconds: [9, 12],
      patienceSeconds: 2.6,
      dangerFillSeconds: 3.5,
      dangerDrainSeconds: 2,
      maxHeavyRun: 2,
    },
    hint: 'They come faster now',
  },
  {
    id: 'level-8',
    mode: 'arcade',
    title: 'Danger',
    objective: { kind: 'survive', seconds: 45 },
    initial: { left: ['dog'], right: ['cat', 'rabbit'] },
    arcade: {
      seed: 1208,
      pool: ['rabbit', 'cat', 'dog', 'bear'],
      arrivalSeconds: 1.7,
      finalArrivalSeconds: 1.3,
      queueLength: 3,
      staySeconds: [8, 11],
      patienceSeconds: 2,
      dangerFillSeconds: 2.5,
      dangerDrainSeconds: 1.5,
      maxHeavyRun: 2,
    },
    hint: 'Stay out of the red',
  },
  {
    id: 'level-9',
    mode: 'arcade',
    title: 'Windy Day',
    objective: { kind: 'survive', seconds: 45 },
    initial: { left: ['cat'], right: ['cat'] },
    arcade: {
      seed: 1209,
      pool: ['rabbit', 'cat', 'dog', 'bear'],
      arrivalSeconds: 2,
      queueLength: 3,
      staySeconds: [9, 12],
      patienceSeconds: 2.4,
      dangerFillSeconds: 3.5,
      dangerDrainSeconds: 1.8,
      maxHeavyRun: 2,
      // One event type only, as the design document insists. Balloons and
      // butterflies would be further entries here, not further plumbing.
      wind: {
        calmSeconds: [6, 9],
        warningSeconds: 1.5,
        gustSeconds: [3, 5],
        strength: [1, 2],
      },
    },
    hint: 'Lean into the wind',
  },
  {
    id: 'level-10',
    mode: 'arcade',
    title: 'Animal Park',
    objective: { kind: 'endless' },
    initial: { left: ['cat'], right: ['cat'] },
    arcade: {
      seed: 1210,
      pool: ['rabbit', 'cat', 'dog', 'bear'],
      arrivalSeconds: 2.6,
      queueLength: 3,
      staySeconds: [9, 13],
      patienceSeconds: 2.6,
      dangerFillSeconds: 3.5,
      dangerDrainSeconds: 1.8,
      maxHeavyRun: 2,
      wind: {
        calmSeconds: [7, 11],
        warningSeconds: 1.6,
        gustSeconds: [3, 5],
        strength: [1, 2],
      },
      // Every run ends eventually: the pace keeps tightening. How long it takes
      // to get there is the score.
      ramp: { arrivalFloorSeconds: 0.9, overSeconds: 150 },
    },
    hint: 'How long can you keep going?',
  },
];

export const PUZZLE_LEVELS: readonly PuzzleLevelDef[] = LEVELS.filter(isPuzzle);
export const ARCADE_LEVELS: readonly ArcadeLevelDef[] = LEVELS.filter(
  (level): level is ArcadeLevelDef => level.mode === 'arcade',
);

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
export function solutionsFor(level: PuzzleLevelDef): TraySelection[] {
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
