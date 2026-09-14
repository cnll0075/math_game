import { createGame } from './game.js';
import { SECTION_TITLES, type LevelDef, type SectionId } from './level.js';
import type { Side } from './seesaw-state.js';

/**
 * One level is one question. The game is thirty of them, grouped into sections
 * that each introduce one idea and then practise it a few times with different
 * numbers.
 *
 * The tray is the level design: what is *missing* from it is what makes a
 * question interesting. There is deliberately no animal weighing four, so four
 * is always built out of smaller ones.
 */
export const LEVELS: readonly LevelDef[] = [
  // --- Same and Same: what "level" means, and that two small ones can equal
  // one bigger one.
  { id: 'l1', section: 'same', objective: { kind: 'balance' }, hint: 'Make both sides the same',
    initial: { left: ['chicken'], right: [] }, tray: ['chicken'] },
  { id: 'l2', section: 'same', objective: { kind: 'balance' }, hint: 'Two of them now',
    initial: { left: ['chicken', 'chicken'], right: [] }, tray: ['chicken', 'chicken'] },
  { id: 'l3', section: 'same', objective: { kind: 'balance' }, hint: 'One cat, or two chickens',
    initial: { left: ['cat'], right: [] }, tray: ['chicken', 'chicken', 'chicken'] },
  { id: 'l4', section: 'same', objective: { kind: 'balance' }, hint: 'How many chickens is a dog?',
    initial: { left: ['dog'], right: [] }, tray: ['chicken', 'chicken', 'chicken', 'chicken'] },
  { id: 'l5', section: 'same', objective: { kind: 'balance' }, hint: 'A cat and a chicken',
    initial: { left: ['dog'], right: [] }, tray: ['cat', 'chicken', 'chicken'] },

  // --- Make the Number: something is already there, work out the rest.
  { id: 'l6', section: 'make', objective: { kind: 'balance' }, hint: 'How much more is needed?',
    initial: { left: ['dog'], right: ['cat'] }, tray: ['chicken', 'cat'] },
  { id: 'l7', section: 'make', objective: { kind: 'balance' }, hint: 'How much more?',
    initial: { left: ['bear'], right: ['dog'] }, tray: ['cat', 'chicken'] },
  { id: 'l8', section: 'make', objective: { kind: 'balance' }, hint: 'How much more?',
    initial: { left: ['bear'], right: ['cat'] }, tray: ['dog', 'chicken'] },
  { id: 'l9', section: 'make', objective: { kind: 'balance' }, hint: 'Only one is missing',
    initial: { left: ['bear', 'cat'], right: ['bear'] }, tray: ['cat', 'chicken'] },
  { id: 'l10', section: 'make', objective: { kind: 'balance' }, hint: 'Nearly there already',
    initial: { left: ['bear', 'dog'], right: ['bear', 'cat'] }, tray: ['chicken', 'cat'] },

  // --- Build It: the numbers nothing weighs, and the gaps that need both sides.
  { id: 'l11', section: 'build', objective: { kind: 'balance' }, hint: 'Nothing weighs four',
    initial: { left: ['dog', 'chicken'], right: [] }, tray: ['dog', 'chicken', 'cat'] },
  { id: 'l12', section: 'build', objective: { kind: 'balance' }, hint: 'Two and two',
    initial: { left: ['cat', 'cat'], right: [] }, tray: ['cat', 'cat', 'dog'] },
  { id: 'l13', section: 'build', objective: { kind: 'balance' }, hint: 'Four again, a different way',
    initial: { left: ['bear', 'dog'], right: ['dog', 'chicken'] }, tray: ['cat', 'cat', 'dog'] },
  // The gap is one and there is no chicken: the only way through is adding to
  // BOTH sides, which is the first time subtracting shows up as an idea.
  { id: 'l14', section: 'build', objective: { kind: 'balance' }, hint: 'You can add to both sides',
    initial: { left: ['dog'], right: ['cat'] }, tray: ['cat', 'dog'] },
  { id: 'l15', section: 'build', objective: { kind: 'balance' }, hint: 'Both sides again',
    initial: { left: ['bear'], right: ['dog', 'chicken'] }, tray: ['cat', 'dog'] },

  // --- Groups: the tray offers ready-made bundles, so the question is how many
  // of them rather than how many drags.
  { id: 'l16', section: 'groups', objective: { kind: 'balance' }, hint: 'Which group fits?',
    initial: { left: ['dog', 'dog'], right: [] },
    tray: [{ of: 'cat', count: 2 }, { of: 'cat', count: 3 }, { of: 'cat', count: 4 }] },
  { id: 'l17', section: 'groups', objective: { kind: 'balance' }, hint: 'Count them in twos',
    initial: { left: ['bear', 'dog'], right: [] },
    tray: [{ of: 'cat', count: 3 }, { of: 'cat', count: 4 }, { of: 'cat', count: 5 }] },
  { id: 'l18', section: 'groups', objective: { kind: 'balance' }, hint: 'Count them in threes',
    initial: { left: ['dog', 'dog', 'dog'], right: [] },
    tray: [{ of: 'dog', count: 2 }, { of: 'dog', count: 3 }, { of: 'dog', count: 4 }] },
  { id: 'l19', section: 'groups', objective: { kind: 'balance' }, hint: 'Chickens this time',
    initial: { left: ['bear', 'cat'], right: [] },
    tray: [{ of: 'chicken', count: 5 }, { of: 'chicken', count: 7 }, { of: 'chicken', count: 9 }] },
  { id: 'l20', section: 'groups', objective: { kind: 'balance' }, hint: 'A group and one more',
    initial: { left: ['bear', 'bear'], right: [] },
    tray: [{ of: 'cat', count: 4 }, { of: 'cat', count: 5 }, 'chicken'] },

  // --- Take One Off: taught before it is needed. The first question can be
  // solved by lifting the extra animal, with nothing in the tray to confuse it.
  { id: 'l21', section: 'takeoff', objective: { kind: 'balance' }, allowRemoval: true,
    hint: 'Tap an animal to take it off',
    initial: { left: ['chicken', 'chicken'], right: ['chicken'] }, tray: [] },
  { id: 'l22', section: 'takeoff', objective: { kind: 'balance' }, allowRemoval: true,
    hint: 'Which one should go?',
    initial: { left: ['bear', 'cat'], right: ['bear'] }, tray: [] },
  { id: 'l23', section: 'takeoff', objective: { kind: 'balance' }, allowRemoval: true,
    hint: 'Take one away',
    initial: { left: ['dog', 'dog'], right: ['dog'] }, tray: [] },
  { id: 'l24', section: 'takeoff', objective: { kind: 'balance' }, allowRemoval: true,
    hint: 'Only one of them is right',
    initial: { left: ['bear', 'dog', 'chicken'], right: ['bear', 'dog'] }, tray: [] },
  { id: 'l25', section: 'takeoff', objective: { kind: 'balance' }, allowRemoval: true,
    hint: 'Take one off, put one on',
    initial: { left: ['bear', 'dog'], right: ['bear'] }, tray: ['chicken'] },

  // --- Fair Shares: the whole pile has to go on, split evenly.
  { id: 'l26', section: 'share', objective: { kind: 'balance' }, requireEmptyTray: true,
    hint: 'Everyone sits down, evenly',
    initial: { left: [], right: [] }, tray: ['cat', 'cat', 'chicken', 'chicken'] },
  { id: 'l27', section: 'share', objective: { kind: 'balance' }, requireEmptyTray: true,
    hint: 'Share them out',
    initial: { left: [], right: [] }, tray: ['dog', 'dog', 'cat', 'cat'] },
  { id: 'l28', section: 'share', objective: { kind: 'balance' }, requireEmptyTray: true,
    hint: 'Everyone, evenly',
    initial: { left: [], right: [] }, tray: ['bear', 'dog', 'cat', 'chicken', 'dog'] },

  // --- Animal Park: one of each idea, met again.
  { id: 'l29', section: 'mixed', objective: { kind: 'balance' }, hint: 'Which group fits?',
    initial: { left: ['bear', 'dog'], right: [] },
    tray: [{ of: 'cat', count: 3 }, { of: 'cat', count: 4 }, { of: 'chicken', count: 6 }] },
  { id: 'l30', section: 'mixed', objective: { kind: 'balance' }, allowRemoval: true,
    hint: 'Take one off',
    initial: { left: ['bear', 'dog', 'chicken'], right: ['bear', 'dog'] }, tray: [] },
  { id: 'l31', section: 'mixed', objective: { kind: 'balance' }, requireEmptyTray: true,
    hint: 'Everyone, evenly',
    initial: { left: [], right: [] }, tray: ['bear', 'dog', 'cat', 'chicken', 'dog'] },
  { id: 'l32', section: 'mixed', objective: { kind: 'balance' },
    hint: 'Both sides, one last time',
    initial: { left: ['bear', 'dog'], right: ['bear', 'cat'] }, tray: ['cat', 'dog'] },
];

export const getLevel = (id: string): LevelDef | undefined => LEVELS.find((level) => level.id === id);

export const sectionOf = (level: LevelDef): string => SECTION_TITLES[level.section];

/** Every level of a section, in order, for showing progress through it. */
export const levelsInSection = (section: SectionId): readonly LevelDef[] =>
  LEVELS.filter((level) => level.section === section);

export type SolutionMove =
  | { kind: 'place'; trayIndex: number; side: Side }
  | { kind: 'remove'; uid: string };

export type TraySelection = readonly SolutionMove[];

const SIDES: readonly Side[] = ['left', 'right'];

const apply = (game: ReturnType<typeof createGame>, move: SolutionMove): void => {
  if (move.kind === 'place') game.place(move.trayIndex, move.side);
  else game.takeBack(move.uid);
};

/**
 * Every way to answer a level, found by replaying real games rather than by
 * reasoning about weights: breadth-first over the moves the player could make,
 * so a level the reducer would refuse to clear is reported as unsolvable. It
 * searches removals too, since on some levels taking an animal off is the only
 * way through.
 */
export function solutionsFor(level: LevelDef): TraySelection[] {
  const solutions: TraySelection[] = [];
  const seen = new Set<string>();
  const queue: TraySelection[] = [[]];

  while (queue.length > 0 && solutions.length < 64) {
    const moves = queue.shift()!;
    const game = createGame(level);
    for (const move of moves) apply(game, move);

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
