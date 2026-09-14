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
  { id: 'l1', section: 'same', objective: { kind: 'balance' }, hint: 'Pip wants a friend', star: 'chicken',
    initial: { left: ['chicken'], right: [] }, tray: ['chicken'] },
  { id: 'l2', section: 'same', objective: { kind: 'balance' }, hint: 'Two friends, please', star: 'chicken',
    initial: { left: ['chicken', 'chicken'], right: [] }, tray: ['chicken', 'chicken'] },
  { id: 'l3', section: 'same', objective: { kind: 'balance' }, hint: 'How many chickens is Mango?', star: 'cat',
    initial: { left: ['cat'], right: [] }, tray: ['chicken', 'chicken', 'chicken'] },
  { id: 'l4', section: 'same', objective: { kind: 'balance' }, hint: 'Scout is heavier than he looks', star: 'dog',
    initial: { left: ['dog'], right: [] }, tray: ['chicken', 'chicken', 'chicken', 'chicken'] },
  { id: 'l5', section: 'same', objective: { kind: 'balance' }, hint: 'A cat and a chicken can do it', star: 'dog',
    initial: { left: ['dog'], right: [] }, tray: ['cat', 'chicken', 'chicken'] },

  // --- Make the Number: something is already there, work out the rest.
  { id: 'l6', section: 'make', objective: { kind: 'balance' }, hint: 'Scout needs one more friend', star: 'dog',
    initial: { left: ['dog'], right: ['cat'] }, tray: ['chicken', 'cat'] },
  { id: 'l7', section: 'make', objective: { kind: 'balance' }, hint: 'Who else can sit with Scout?', star: 'bear',
    initial: { left: ['bear'], right: ['dog'] }, tray: ['cat', 'chicken'] },
  { id: 'l8', section: 'make', objective: { kind: 'balance' }, hint: 'Bramble is waiting', star: 'bear',
    initial: { left: ['bear'], right: ['cat'] }, tray: ['dog', 'chicken'] },
  { id: 'l9', section: 'make', objective: { kind: 'balance' }, hint: 'Just one more will do it', star: 'bear',
    initial: { left: ['bear', 'cat'], right: ['bear'] }, tray: ['cat', 'chicken'] },
  { id: 'l10', section: 'make', objective: { kind: 'balance' }, hint: 'Nearly there already', star: 'bear',
    initial: { left: ['bear', 'dog'], right: ['bear', 'cat'] }, tray: ['chicken', 'cat'] },

  // --- Build It: the numbers nothing weighs, and the gaps that need both sides.
  { id: 'l11', section: 'build', objective: { kind: 'balance' }, hint: 'Nobody weighs four!', star: 'dog',
    initial: { left: ['dog', 'chicken'], right: [] }, tray: ['dog', 'chicken', 'cat'] },
  { id: 'l12', section: 'build', objective: { kind: 'balance' }, hint: 'Four again: two and two', star: 'cat',
    initial: { left: ['cat', 'cat'], right: [] }, tray: ['cat', 'cat', 'dog'] },
  { id: 'l13', section: 'build', objective: { kind: 'balance' }, hint: 'Four one more time', star: 'bear',
    initial: { left: ['bear', 'dog'], right: ['dog', 'chicken'] }, tray: ['cat', 'cat', 'dog'] },
  // The gap is one and there is no chicken: the only way through is adding to
  // BOTH sides, which is the first time subtracting shows up as an idea.
  { id: 'l14', section: 'build', objective: { kind: 'balance' }, hint: 'No chickens left! Use both sides', star: 'dog',
    initial: { left: ['dog'], right: ['cat'] }, tray: ['cat', 'dog'] },
  { id: 'l15', section: 'build', objective: { kind: 'balance' }, hint: 'Both sides again', star: 'bear',
    initial: { left: ['bear'], right: ['dog', 'chicken'] }, tray: ['cat', 'dog'] },

  // --- Groups: the tray offers ready-made bundles, so the question is how many
  // of them rather than how many drags.
  { id: 'l16', section: 'groups', objective: { kind: 'balance' }, hint: 'Which group fits?', star: 'dog',
    initial: { left: ['dog', 'dog'], right: [] },
    tray: [{ of: 'cat', count: 2 }, { of: 'cat', count: 3 }, { of: 'cat', count: 4 }] },
  { id: 'l17', section: 'groups', objective: { kind: 'balance' }, hint: 'Count the cats in twos', star: 'bear',
    initial: { left: ['bear', 'dog'], right: [] },
    tray: [{ of: 'cat', count: 3 }, { of: 'cat', count: 4 }, { of: 'cat', count: 5 }] },
  { id: 'l18', section: 'groups', objective: { kind: 'balance' }, hint: 'Now count in threes', star: 'dog',
    initial: { left: ['dog', 'dog', 'dog'], right: [] },
    tray: [{ of: 'dog', count: 2 }, { of: 'dog', count: 3 }, { of: 'dog', count: 4 }] },
  { id: 'l19', section: 'groups', objective: { kind: 'balance' }, hint: 'A whole flock of chickens', star: 'bear',
    initial: { left: ['bear', 'cat'], right: [] },
    tray: [{ of: 'chicken', count: 5 }, { of: 'chicken', count: 7 }, { of: 'chicken', count: 9 }] },
  { id: 'l20', section: 'groups', objective: { kind: 'balance' }, hint: 'A group, and one more', star: 'bear',
    initial: { left: ['bear', 'bear'], right: [] },
    tray: [{ of: 'cat', count: 4 }, { of: 'cat', count: 5 }, 'chicken'] },

  // --- Take One Off: taught before it is needed. The first question can be
  // solved by lifting the extra animal, with nothing in the tray to confuse it.
  { id: 'l21', section: 'takeoff', objective: { kind: 'balance' }, allowRemoval: true,
    hint: 'One chicken wants to go home', star: 'chicken',
    initial: { left: ['chicken', 'chicken'], right: ['chicken'] }, tray: [] },
  { id: 'l22', section: 'takeoff', objective: { kind: 'balance' }, allowRemoval: true,
    hint: 'Mango is ready for bed', star: 'cat',
    initial: { left: ['bear', 'cat'], right: ['bear'] }, tray: [] },
  { id: 'l23', section: 'takeoff', objective: { kind: 'balance' }, allowRemoval: true,
    hint: 'One dog should go home', star: 'dog',
    initial: { left: ['dog', 'dog'], right: ['dog'] }, tray: [] },
  { id: 'l24', section: 'takeoff', objective: { kind: 'balance' }, allowRemoval: true,
    hint: 'Who needs to go home?', star: 'chicken',
    initial: { left: ['bear', 'dog', 'chicken'], right: ['bear', 'dog'] }, tray: [] },
  { id: 'l25', section: 'takeoff', objective: { kind: 'balance' }, allowRemoval: true,
    hint: 'One goes home, one arrives', star: 'bear',
    initial: { left: ['bear', 'dog'], right: ['bear'] }, tray: ['chicken'] },

  // --- Fair Shares: the whole pile has to go on, split evenly.
  { id: 'l26', section: 'share', objective: { kind: 'balance' }, requireEmptyTray: true,
    hint: 'Everybody wants a turn', star: 'cat',
    initial: { left: [], right: [] }, tray: ['cat', 'cat', 'chicken', 'chicken'] },
  { id: 'l27', section: 'share', objective: { kind: 'balance' }, requireEmptyTray: true,
    hint: 'Share them out fairly', star: 'dog',
    initial: { left: [], right: [] }, tray: ['dog', 'dog', 'cat', 'cat'] },
  { id: 'l28', section: 'share', objective: { kind: 'balance' }, requireEmptyTray: true,
    hint: 'Nobody gets left out', star: 'bear',
    initial: { left: [], right: [] }, tray: ['bear', 'dog', 'cat', 'chicken', 'dog'] },

  // --- Animal Park: one of each idea, met again.
  { id: 'l29', section: 'mixed', objective: { kind: 'balance' }, hint: 'Which group fits now?', star: 'bear',
    initial: { left: ['bear', 'dog'], right: [] },
    tray: [{ of: 'cat', count: 3 }, { of: 'cat', count: 4 }, { of: 'chicken', count: 6 }] },
  { id: 'l30', section: 'mixed', objective: { kind: 'balance' }, allowRemoval: true,
    hint: 'Somebody has to go home', star: 'chicken',
    initial: { left: ['bear', 'dog', 'chicken'], right: ['bear', 'dog'] }, tray: [] },
  { id: 'l31', section: 'mixed', objective: { kind: 'balance' }, requireEmptyTray: true,
    hint: 'Everybody on, evenly', star: 'bear',
    initial: { left: [], right: [] }, tray: ['bear', 'dog', 'cat', 'chicken', 'dog'] },
  { id: 'l32', section: 'mixed', objective: { kind: 'balance' },
    hint: 'Both sides, one last time', star: 'bear',
    initial: { left: ['bear', 'dog'], right: ['bear', 'cat'] }, tray: ['cat', 'dog'] },
];

/**
 * Whose question this is. Named in the level when it matters, and otherwise the
 * heaviest animal already on the seesaw — which is usually the one the question
 * is about.
 */
export function starOf(level: LevelDef): AnimalId {
  if (level.star) return level.star;
  const onBoard = [...level.initial.left, ...level.initial.right];
  const heaviest = [...onBoard].sort((a, b) => weightOf(b) - weightOf(a))[0];
  if (heaviest) return heaviest;
  const fromTray = level.tray.map(specOf).sort((a, b) => weightOf(b) - weightOf(a))[0];
  return fromTray ?? 'chicken';
}

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
