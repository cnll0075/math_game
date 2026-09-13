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
  // Levels 6-10: Balance Rush. A gap is on the plank; the player picks the
  // animal from the queue that closes it exactly. Ringing the bell is the
  // point, not merely a bonus: it scores, clears the plank, and sets a fresh
  // gap. Comparison alone will not get you there.
  {
    id: 'level-6',
    mode: 'arcade',
    title: 'Ring the Bell',
    objective: { kind: 'bells', count: 4, seconds: 60 },
    initial: { left: ['cat'], right: [] },
    arcade: {
      seed: 1206,
      pool: ['rabbit', 'cat', 'dog'],
      arrivalSeconds: 2.6,
      queueLength: 3,
      staySeconds: [30, 40],
      patienceSeconds: 6,
      dangerFillSeconds: 6,
      dangerDrainSeconds: 1.5,
      maxHeavyRun: 1,
      seedGap: [1, 3],
      celebrateSeconds: 1.1,
    },
    hint: 'Make both sides the same',
  },
  {
    id: 'level-7',
    mode: 'arcade',
    title: 'Faster',
    objective: { kind: 'bells', count: 5, seconds: 44 },
    initial: { left: ['dog'], right: [] },
    // Room for the gaps this level seeds: a gap of seven should read as
    // tilted rather than doomed, and the generator's fairness rule keys off
    // these same numbers, so widening them is what keeps the queue varied
    // enough for the choice of animal to matter.
    balance: { green: 1, yellow: 8, maxTiltDifference: 10 },
    arcade: {
      seed: 1207,
      pool: ['rabbit', 'cat', 'dog', 'bear'],
      // Faster than a child can place, so a hand of animals builds up and
      // choosing between them is a real decision.
      arrivalSeconds: 1.3,
      queueLength: 3,
      staySeconds: [26, 34],
      patienceSeconds: 4.5,
      dangerFillSeconds: 5,
      dangerDrainSeconds: 1.5,
      maxHeavyRun: 2,
      // Gaps wider than any single animal, so closing one means combining:
      // 7 is 5 and 2, or 3 and 3 and 1. Reaching for the nearest animal is no
      // longer enough.
      seedGap: [4, 7],
      celebrateSeconds: 1,
    },
    hint: 'Bigger gaps to close',
  },
  {
    id: 'level-8',
    mode: 'arcade',
    title: 'Families',
    // Families take longer to seat, so the clock allows for them.
    objective: { kind: 'bells', count: 5, seconds: 48 },
    initial: { left: ['bear'], right: [] },
    // Room for the gaps this level seeds: a gap of seven should read as
    // tilted rather than doomed, and the generator's fairness rule keys off
    // these same numbers, so widening them is what keeps the queue varied
    // enough for the choice of animal to matter.
    balance: { green: 1, yellow: 8, maxTiltDifference: 10 },
    arcade: {
      seed: 1208,
      pool: ['rabbit', 'cat', 'dog', 'bear'],
      // Faster than a child can place, so a hand of animals builds up and
      // choosing between them is a real decision.
      arrivalSeconds: 1.3,
      queueLength: 5,
      staySeconds: [26, 34],
      patienceSeconds: 4.5,
      dangerFillSeconds: 4.5,
      dangerDrainSeconds: 1.5,
      maxHeavyRun: 2,
      seedGap: [4, 8],
      celebrateSeconds: 1,
      // Families arrive together and all must be seated, so they have to be
      // split between the sides: 3 on one, 1 and 2 on the other.
      groupSize: [2, 3],
      groupChance: 0.55,
    },
    hint: 'Everyone in a family must sit down',
  },
  {
    id: 'level-9',
    mode: 'arcade',
    title: 'Windy Day',
    objective: { kind: 'bells', count: 5, seconds: 46 },
    initial: { left: ['dog'], right: [] },
    // Room for the gaps this level seeds: a gap of seven should read as
    // tilted rather than doomed, and the generator's fairness rule keys off
    // these same numbers, so widening them is what keeps the queue varied
    // enough for the choice of animal to matter.
    balance: { green: 1, yellow: 8, maxTiltDifference: 10 },
    arcade: {
      seed: 1209,
      pool: ['rabbit', 'cat', 'dog', 'bear'],
      // Faster than a child can place, so a hand of animals builds up and
      // choosing between them is a real decision.
      arrivalSeconds: 1.4,
      queueLength: 4,
      staySeconds: [26, 34],
      patienceSeconds: 4.5,
      dangerFillSeconds: 4.5,
      dangerDrainSeconds: 1.6,
      maxHeavyRun: 2,
      seedGap: [4, 7],
      celebrateSeconds: 1,
      groupSize: [2, 2],
      groupChance: 0.3,
      // One event type only, as the design document insists.
      wind: {
        calmSeconds: [7, 10],
        warningSeconds: 1.6,
        gustSeconds: [3, 5],
        strength: [1, 2],
      },
    },
    hint: 'The wind leans on the plank too',
  },
  {
    id: 'level-10',
    mode: 'arcade',
    title: 'Animal Park',
    objective: { kind: 'endless' },
    initial: { left: ['cat'], right: [] },
    // Room for the gaps this level seeds: a gap of seven should read as
    // tilted rather than doomed, and the generator's fairness rule keys off
    // these same numbers, so widening them is what keeps the queue varied
    // enough for the choice of animal to matter.
    balance: { green: 1, yellow: 8, maxTiltDifference: 10 },
    arcade: {
      seed: 1210,
      pool: ['rabbit', 'cat', 'dog', 'bear'],
      // Faster than a child can place, so a hand of animals builds up and
      // choosing between them is a real decision.
      arrivalSeconds: 1.6,
      queueLength: 5,
      staySeconds: [26, 34],
      patienceSeconds: 4.5,
      dangerFillSeconds: 4.5,
      dangerDrainSeconds: 1.6,
      maxHeavyRun: 2,
      seedGap: [4, 8],
      celebrateSeconds: 0.9,
      groupSize: [2, 3],
      groupChance: 0.4,
      wind: {
        calmSeconds: [8, 12],
        warningSeconds: 1.6,
        gustSeconds: [3, 5],
        strength: [1, 2],
      },
      ramp: { arrivalFloorSeconds: 1, overSeconds: 150 },
    },
    hint: 'How many bells can you ring?',
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
