import { createGame } from './game.js';
import { objectiveFor, roundAt, roundCount, type LevelDef } from './level.js';
import type { Side } from './seesaw-state.js';

/**
 * Fifteen levels, one mechanic: put animals on the seesaw until it does what
 * was asked. The depth is in the problems, not in the verbs.
 *
 * Every level is several rounds of the same idea with different numbers,
 * because a child who has met "3 and 2 make 5" once has not met it. The tray is
 * the real level design: what is missing from it is what makes a round
 * interesting.
 */
export const LEVELS: readonly LevelDef[] = [
  {
    id: 'level-1',
    title: 'Same',
    objective: { kind: 'balance' },
    hint: 'Make both sides the same',
    rounds: [
      { initial: { left: ['chicken'], right: [] }, tray: ['chicken'] },
      { initial: { left: ['cat'], right: [] }, tray: ['cat'] },
      { initial: { left: ['dog'], right: [] }, tray: ['dog'] },
    ],
  },
  {
    id: 'level-2',
    title: 'Count Them',
    objective: { kind: 'balance' },
    hint: 'Count what is there',
    rounds: [
      { initial: { left: ['chicken', 'chicken'], right: [] }, tray: ['chicken', 'chicken'] },
      { initial: { left: ['chicken', 'chicken', 'chicken'], right: [] }, tray: ['chicken', 'chicken', 'chicken'] },
      { initial: { left: ['chicken', 'chicken'], right: ['chicken'] }, tray: ['chicken', 'chicken'] },
      {
        initial: { left: ['chicken', 'chicken', 'chicken'], right: ['chicken'] },
        tray: ['chicken', 'chicken', 'chicken'],
      },
    ],
  },
  {
    id: 'level-3',
    title: 'Two Little Ones',
    objective: { kind: 'balance' },
    hint: 'Two chickens weigh the same as one cat',
    rounds: [
      // Only chickens in the tray, so the cat has to be made out of them.
      { initial: { left: ['cat'], right: [] }, tray: ['chicken', 'chicken', 'chicken'] },
      { initial: { left: ['cat'], right: ['chicken'] }, tray: ['chicken', 'chicken'] },
      { initial: { left: ['cat', 'cat'], right: [] }, tray: ['chicken', 'chicken', 'chicken', 'chicken'] },
    ],
  },
  {
    id: 'level-4',
    title: 'The Dog',
    objective: { kind: 'balance' },
    hint: 'Three is a dog, or a cat and a chicken',
    rounds: [
      { initial: { left: ['dog'], right: [] }, tray: ['chicken', 'chicken', 'chicken'] },
      { initial: { left: ['dog'], right: [] }, tray: ['cat', 'chicken', 'chicken'] },
      { initial: { left: ['dog'], right: ['chicken'] }, tray: ['cat', 'chicken'] },
      { initial: { left: ['dog', 'chicken'], right: [] }, tray: ['cat', 'cat', 'chicken'] },
    ],
  },
  {
    id: 'level-5',
    title: 'Make Three',
    objective: { kind: 'balance' },
    hint: 'How much more is needed?',
    rounds: [
      { initial: { left: ['dog'], right: ['cat'] }, tray: ['chicken', 'cat'] },
      { initial: { left: ['dog'], right: ['chicken'] }, tray: ['cat', 'chicken'] },
      { initial: { left: ['cat', 'chicken'], right: ['chicken'] }, tray: ['cat', 'chicken'] },
      { initial: { left: ['dog'], right: ['chicken', 'chicken'] }, tray: ['chicken', 'cat'] },
    ],
  },
  {
    id: 'level-6',
    title: 'Make Five',
    objective: { kind: 'balance' },
    hint: 'Bigger numbers now',
    rounds: [
      { initial: { left: ['bear'], right: ['dog'] }, tray: ['cat', 'chicken'] },
      { initial: { left: ['bear'], right: ['cat'] }, tray: ['dog', 'chicken'] },
      { initial: { left: ['bear'], right: ['cat', 'chicken'] }, tray: ['cat', 'chicken'] },
      { initial: { left: ['bear'], right: [] }, tray: ['dog', 'cat', 'chicken'] },
    ],
  },
  {
    id: 'level-7',
    title: 'No Four',
    objective: { kind: 'balance' },
    // There is no animal that weighs four, so four has to be built.
    hint: 'Nothing weighs four',
    rounds: [
      // Every gap here is four, and nothing in the tray weighs four.
      { initial: { left: ['dog', 'chicken'], right: [] }, tray: ['dog', 'chicken', 'cat'] },
      { initial: { left: ['cat', 'cat'], right: [] }, tray: ['cat', 'cat', 'dog'] },
      { initial: { left: ['bear', 'dog'], right: ['dog', 'chicken'] }, tray: ['cat', 'cat', 'dog', 'chicken'] },
      { initial: { left: ['dog', 'cat'], right: ['chicken'] }, tray: ['dog', 'cat', 'chicken'] },
    ],
  },
  {
    id: 'level-8',
    title: 'All the Same',
    objective: { kind: 'balance' },
    // One species in the tray, so the answer is "how many of these?" — counting
    // in twos and threes, which is where multiplying starts.
    hint: 'How many of them?',
    rounds: [
      { initial: { left: ['dog', 'dog'], right: [] }, tray: ['cat', 'cat', 'cat', 'cat'] },
      { initial: { left: ['bear', 'dog'], right: [] }, tray: ['cat', 'cat', 'cat', 'cat', 'cat'] },
      { initial: { left: ['dog', 'dog', 'dog'], right: [] }, tray: ['dog', 'dog', 'dog', 'dog'] },
      { initial: { left: ['bear', 'bear'], right: [] }, tray: ['cat', 'cat', 'cat', 'cat', 'cat', 'cat'] },
    ],
  },
  {
    id: 'level-9',
    title: 'No Little Ones',
    objective: { kind: 'balance' },
    // The gap is one, and there is no chicken to close it with. The way through
    // is to add to BOTH sides: a dog here, a cat there, and the difference is
    // one. This is the level the whole game was built to arrive at.
    hint: 'You can add to both sides',
    rounds: [
      { initial: { left: ['dog'], right: ['cat'] }, tray: ['cat', 'dog'] },
      { initial: { left: ['cat'], right: ['chicken'] }, tray: ['cat', 'dog'] },
      { initial: { left: ['bear'], right: ['dog', 'chicken'] }, tray: ['cat', 'dog'] },
      { initial: { left: ['dog', 'dog'], right: ['bear'] }, tray: ['cat', 'dog'] },
    ],
  },
  {
    id: 'level-10',
    title: 'Make Ten',
    objective: { kind: 'balance' },
    hint: 'The biggest sums yet',
    rounds: [
      { initial: { left: ['bear', 'dog'], right: ['bear'] }, tray: ['dog', 'cat', 'chicken'] },
      { initial: { left: ['bear', 'bear'], right: ['bear', 'cat'] }, tray: ['dog', 'cat', 'chicken'] },
      { initial: { left: ['bear', 'dog', 'cat'], right: ['bear', 'dog'] }, tray: ['cat', 'chicken', 'chicken'] },
      { initial: { left: ['bear', 'bear'], right: ['dog', 'dog'] }, tray: ['cat', 'cat', 'chicken', 'dog'] },
    ],
  },
  {
    id: 'level-11',
    title: 'Take One Off',
    objective: { kind: 'balance' },
    // Lifting an animal off is subtraction, and here it is the only way through:
    // the tray cannot close these gaps.
    allowRemoval: true,
    hint: 'You can take animals off too',
    rounds: [
      { initial: { left: ['bear', 'cat'], right: ['bear'] }, tray: [] },
      { initial: { left: ['dog', 'dog'], right: ['dog'] }, tray: [] },
      { initial: { left: ['bear', 'dog', 'chicken'], right: ['bear', 'dog'] }, tray: [] },
      { initial: { left: ['bear', 'cat', 'cat'], right: ['bear', 'cat'] }, tray: ['chicken'] },
    ],
  },
  {
    id: 'level-12',
    title: 'Two Ways',
    objective: { kind: 'balance' },
    // Every round here has more than one right answer, and the game accepts all
    // of them.
    hint: 'There is more than one way',
    rounds: [
      { initial: { left: ['bear', 'chicken'], right: [] }, tray: ['dog', 'dog', 'cat', 'cat', 'chicken'] },
      { initial: { left: ['bear', 'cat'], right: [] }, tray: ['dog', 'dog', 'cat', 'cat', 'chicken', 'chicken'] },
      { initial: { left: ['bear', 'dog'], right: [] }, tray: ['bear', 'dog', 'cat', 'cat', 'chicken', 'chicken'] },
    ],
  },
  {
    id: 'level-13',
    title: 'Fair Shares',
    objective: { kind: 'balance' },
    requireEmptyTray: true,
    // Everything in the tray has to go on, split evenly: sharing a pile in two,
    // which is where dividing starts.
    hint: 'Give both sides the same',
    rounds: [
      { initial: { left: [], right: [] }, tray: ['cat', 'cat', 'chicken', 'chicken'] },
      { initial: { left: [], right: [] }, tray: ['dog', 'dog', 'cat', 'cat'] },
      { initial: { left: [], right: [] }, tray: ['bear', 'dog', 'cat', 'chicken', 'dog'] },
      { initial: { left: [], right: [] }, tray: ['bear', 'bear', 'dog', 'cat', 'chicken'] },
    ],
  },
  {
    id: 'level-14',
    title: 'Big Ones, Small Ones',
    objective: { kind: 'balance' },
    // The same bear, answered three different ways across the rounds.
    hint: 'One bear, lots of ways',
    rounds: [
      { initial: { left: ['bear'], right: [] }, tray: ['dog', 'cat', 'chicken'] },
      { initial: { left: ['bear'], right: [] }, tray: ['cat', 'cat', 'chicken', 'chicken'] },
      { initial: { left: ['bear'], right: [] }, tray: ['chicken', 'chicken', 'chicken', 'chicken', 'chicken'] },
      { initial: { left: ['bear', 'bear'], right: [] }, tray: ['dog', 'dog', 'cat', 'cat', 'chicken', 'chicken'] },
    ],
  },
  {
    id: 'level-15',
    title: 'Animal Park',
    objective: { kind: 'balance' },
    allowRemoval: true,
    hint: 'Everything you know',
    rounds: [
      // One of each idea, hardest first met last.
      { initial: { left: ['bear', 'dog'], right: [] }, tray: ['cat', 'cat', 'cat', 'cat'] },
      { initial: { left: ['bear'], right: ['dog', 'chicken'] }, tray: ['cat', 'dog'] },
      { initial: { left: ['bear', 'dog', 'cat'], right: ['bear', 'dog'] }, tray: [] },
      { initial: { left: [], right: [] }, tray: ['bear', 'dog', 'cat', 'chicken', 'dog', 'chicken'] },
      { initial: { left: ['bear', 'bear'], right: ['dog'] }, tray: ['dog', 'dog', 'cat', 'chicken', 'chicken'] },
    ],
  },
];

export const getLevel = (id: string): LevelDef | undefined => LEVELS.find((level) => level.id === id);

export type SolutionMove =
  | { kind: 'place'; trayIndex: number; side: Side }
  | { kind: 'remove'; uid: string };

export type TraySelection = readonly SolutionMove[];

const SIDES: readonly Side[] = ['left', 'right'];

/** The level as it would be if it were only this one round. */
const singleRound = (level: LevelDef, round: number): LevelDef => ({
  ...level,
  rounds: [roundAt(level, round)],
});

const apply = (game: ReturnType<typeof createGame>, move: SolutionMove): void => {
  if (move.kind === 'place') game.place(move.trayIndex, move.side);
  else game.takeBack(move.uid);
};

/**
 * Every way to clear one round, found by replaying real games rather than by
 * reasoning about weights: breadth-first over the moves the player could make,
 * so a round the reducer would refuse to clear is reported as unsolvable. It
 * searches removals too, since on some levels taking an animal off is the only
 * way through. Rounds stay small, so the search stays cheap.
 */
export function solutionsFor(level: LevelDef, round = 0): TraySelection[] {
  const only = singleRound(level, round);
  const solutions: TraySelection[] = [];
  const seen = new Set<string>();
  const queue: TraySelection[] = [[]];

  const replay = (moves: TraySelection) => {
    const game = createGame(only);
    for (const move of moves) apply(game, move);
    return game;
  };

  while (queue.length > 0 && solutions.length < 64) {
    const moves = queue.shift()!;
    const game = replay(moves);
    if (game.state.status === 'won') {
      solutions.push(moves);
      continue;
    }
    if (moves.length >= 6) continue;

    const next: SolutionMove[] = [];
    for (const [index, item] of game.state.tray.entries()) {
      if (item.used) continue;
      for (const side of SIDES) next.push({ kind: 'place', trayIndex: index, side });
    }
    if (level.allowRemoval) {
      for (const animal of game.state.placed) next.push({ kind: 'remove', uid: animal.uid });
    }

    for (const move of next) {
      const line = [...moves, move];
      const key = JSON.stringify([...line].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))));
      if (seen.has(key)) continue;
      seen.add(key);
      queue.push(line);
    }
  }

  return solutions;
}

/** Rounds that no sequence of placements can clear, if any. */
export function unsolvableRounds(level: LevelDef): number[] {
  const broken: number[] = [];
  for (let round = 0; round < roundCount(level); round++) {
    if (objectiveFor(level, round).kind !== 'balance') continue;
    if (solutionsFor(level, round).length === 0) broken.push(round);
  }
  return broken;
}
