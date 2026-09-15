import { createGame } from './game.js';
import { SECTION_TITLES, specOf, type LevelDef, type SectionId } from './level.js';
import { weightOf, type AnimalId } from './animals.js';
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
  { id: 'l1', section: 'same', objective: { kind: 'balance' }, hint: 'The chicken wants a friend',
    initial: { left: ['chicken'], right: [] }, tray: ['chicken'] },
  { id: 'l2', section: 'same', objective: { kind: 'balance' }, hint: 'Two chickens want two friends',
    initial: { left: [], right: ['chicken', 'chicken'] }, tray: ['chicken', 'chicken'] },
  { id: 'l3', section: 'same', objective: { kind: 'balance' }, hint: 'How many chickens match the cat?',
    initial: { left: ['cat'], right: [] }, tray: ['chicken', 'chicken', 'chicken'] },
  { id: 'l4', section: 'same', objective: { kind: 'balance' }, hint: 'How many chickens match the dog?',
    initial: { left: [], right: ['dog'] }, tray: ['chicken', 'chicken', 'chicken', 'chicken'] },
  { id: 'l5', section: 'same', objective: { kind: 'balance' }, hint: 'A cat and a chicken can match it',
    initial: { left: ['dog'], right: [] }, tray: ['cat', 'chicken', 'chicken'] },

  // --- Make the Number: something is already there, work out the rest.
  { id: 'l6', section: 'make', objective: { kind: 'balance' }, hint: 'The cat needs one more friend',
    initial: { left: ['dog'], right: ['cat'] }, tray: ['chicken', 'cat'] },
  { id: 'l7', section: 'make', objective: { kind: 'balance' }, hint: 'Who else can sit with the dog?',
    initial: { left: ['dog'], right: ['bear'] }, tray: ['cat', 'chicken'] },
  { id: 'l8', section: 'make', objective: { kind: 'balance' }, hint: 'The cat needs more friends',
    initial: { left: ['bear'], right: ['cat'] }, tray: ['dog', 'chicken'] },
  { id: 'l9', section: 'make', objective: { kind: 'balance' }, hint: 'One more friend will do it',
    initial: { left: ['dog', 'dog'], right: ['bear', 'cat'] }, tray: ['chicken', 'cat'] },
  { id: 'l10', section: 'make', objective: { kind: 'balance' }, hint: 'So close. What is missing?',
    initial: { left: ['bear', 'dog'], right: ['cat', 'cat', 'cat'] }, tray: ['cat', 'chicken'] },

  // --- Build It: the numbers nothing weighs, and the gaps that need both sides.
  { id: 'l11', section: 'build', objective: { kind: 'balance' }, hint: 'Nobody weighs four!',
    initial: { left: ['dog', 'chicken'], right: [] }, tray: ['dog', 'chicken', 'cat'] },
  { id: 'l12', section: 'build', objective: { kind: 'balance' }, hint: 'The dog is too big this time',
    initial: { left: [], right: ['cat', 'cat'] }, tray: ['cat', 'cat', 'dog'] },
  { id: 'l13', section: 'build', objective: { kind: 'balance' }, hint: 'Four more to go',
    initial: { left: ['bear', 'dog'], right: ['cat', 'cat'] }, tray: ['cat', 'cat', 'dog'] },
  // The gap is one and there is no chicken: the only way through is adding to
  // BOTH sides, which is the first time subtracting shows up as an idea.
  { id: 'l14', section: 'build', objective: { kind: 'balance' }, hint: 'Hmm... how would you do this?',
    initial: { left: ['dog'], right: ['cat'] }, tray: ['cat', 'dog'] },
  { id: 'l15', section: 'build', objective: { kind: 'balance' }, hint: 'Tricky! Where do they go?',
    initial: { left: ['bear'], right: ['cat', 'cat'] }, tray: ['chicken', 'dog', 'cat'] },

  // --- Groups: the tray offers ready-made bundles, so the question is how many
  // of them rather than how many drags.
  { id: 'l16', section: 'groups', objective: { kind: 'balance' }, hint: 'Which group matches the dogs?',
    initial: { left: ['dog', 'dog'], right: [] },
    tray: [{ of: 'cat', count: 2 }, { of: 'cat', count: 3 }, { of: 'cat', count: 4 }] },
  { id: 'l17', section: 'groups', objective: { kind: 'balance' }, hint: 'Which group of cats matches?',
    initial: { left: [], right: ['bear', 'dog'] },
    tray: [{ of: 'cat', count: 2 }, { of: 'cat', count: 3 }, { of: 'cat', count: 4 }] },
  { id: 'l18', section: 'groups', objective: { kind: 'balance' }, hint: 'Which group of dogs matches?',
    initial: { left: ['dog', 'dog', 'dog'], right: [] },
    tray: [{ of: 'dog', count: 2 }, { of: 'dog', count: 3 }, { of: 'dog', count: 4 }] },
  { id: 'l19', section: 'groups', objective: { kind: 'balance' }, hint: 'Which group of chickens matches?',
    initial: { left: [], right: ['cat', 'cat'] },
    tray: [{ of: 'chicken', count: 2 }, { of: 'chicken', count: 3 }, { of: 'chicken', count: 4 }] },
  { id: 'l20', section: 'groups', objective: { kind: 'balance' }, hint: 'A group, and one more',
    initial: { left: ['bear', 'cat'], right: [] },
    tray: [{ of: 'cat', count: 3 }, { of: 'cat', count: 2 }, 'chicken'] },

  // --- Take One Off: taught before it is needed. The first question can be
  // solved by lifting the extra animal, with nothing in the tray to confuse it.
  // The extra animal is never matched by a twin opposite it, so the child works
  // out which one to send home rather than spotting the odd one out.
  { id: 'l21', section: 'takeoff', objective: { kind: 'balance' }, allowRemoval: true,
    hint: 'One of them wants to go home',
    initial: { left: ['bear', 'chicken'], right: ['dog', 'cat'] }, tray: [] },
  { id: 'l22', section: 'takeoff', objective: { kind: 'balance' }, allowRemoval: true,
    hint: 'Somebody is ready for bed',
    initial: { left: ['bear', 'cat', 'chicken'], right: ['dog', 'dog'] }, tray: [] },
  { id: 'l23', section: 'takeoff', objective: { kind: 'balance' }, allowRemoval: true,
    hint: 'One dog wants to go home',
    initial: { left: ['bear'], right: ['dog', 'dog', 'cat'] }, tray: [] },
  { id: 'l24', section: 'takeoff', objective: { kind: 'balance' }, allowRemoval: true,
    hint: 'Who should go home?',
    initial: { left: ['dog', 'chicken', 'chicken'], right: ['cat', 'cat'] }, tray: [] },
  { id: 'l25', section: 'takeoff', objective: { kind: 'balance' }, allowRemoval: true,
    hint: 'One goes home, one arrives',
    initial: { left: ['bear', 'dog'], right: ['cat'] }, tray: ['dog'] },

  // --- Fair Shares: the whole pile has to go on, split evenly.
  { id: 'l26', section: 'share', objective: { kind: 'balance' }, requireEmptyTray: true,
    hint: 'Everybody wants a turn',
    initial: { left: [], right: [] }, tray: ['cat', 'cat', 'chicken', 'chicken'] },
  { id: 'l27', section: 'share', objective: { kind: 'balance' }, requireEmptyTray: true,
    hint: 'Share them out fairly',
    initial: { left: [], right: [] }, tray: ['dog', 'dog', 'cat', 'cat'] },
  { id: 'l28', section: 'share', objective: { kind: 'balance' }, requireEmptyTray: true,
    hint: 'Nobody gets left out',
    initial: { left: [], right: [] }, tray: ['bear', 'dog', 'cat', 'chicken', 'dog'] },

  // --- Animal Park: one of each idea, met again.
  // Each of these needs two ideas at once, so the last chapter is not the
  // earlier ones played again.
  { id: 'l29', section: 'mixed', objective: { kind: 'balance' }, hint: 'Two groups this time',
    initial: { left: ['bear', 'bear'], right: [] },
    tray: [{ of: 'cat', count: 3 }, { of: 'cat', count: 2 }, { of: 'dog', count: 2 }] },
  { id: 'l30', section: 'mixed', objective: { kind: 'balance' }, allowRemoval: true,
    hint: 'One leaves, and a group arrives',
    initial: { left: ['bear', 'dog', 'chicken'], right: ['cat'] },
    tray: [{ of: 'cat', count: 3 }] },
  { id: 'l31', section: 'mixed', objective: { kind: 'balance' }, requireEmptyTray: true,
    hint: 'Everybody on, evenly',
    initial: { left: [], right: [] },
    tray: [{ of: 'dog', count: 2 }, 'cat', 'cat', 'chicken', 'chicken'] },
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
