import type { ChapterDef, RescueDef } from './rescue-def.js';

type Draft = Omit<RescueDef, 'id'>;

/** Ids are `<chapter>-<n>`, so a URL can name a rescue: `?level=pop-1`. */
const chapter = (id: string, title: string, targets: readonly [number, number], drafts: readonly Draft[]): ChapterDef => ({
  id,
  title,
  targets,
  rescues: drafts.map((draft, index) => ({ id: `${id}-${index + 1}`, ...draft })),
});

/**
 * Eight chapters, each one idea introduced and then practised. The tray is the
 * level design: the balloon a size-only guess would grab first is almost never
 * part of the answer, and every rule this data has to keep is a test in
 * levels.test.ts.
 */
export const CHAPTERS: readonly ChapterDef[] = [
  // Exact lift floats. The first rescue is the only one a single matching
  // balloon can answer; it is there to show what "just right" looks like.
  chapter('first-flight', 'First Flight', [2, 6], [
    { line: 'Pip is stuck at the bottom of the hill', weight: 3, tray: [3, 5] },
    { line: 'The picnic is up on the cliff', weight: 4, tray: [3, 6, 1] },
    { line: 'Bo got left behind!', weight: 5, tray: [2, 6, 3] },
    { line: 'Tilly wants to fly up to the others', weight: 6, tray: [4, 8, 2, 1] },
  ]),
  // Going over sends you flying. Every tray holds a pair that overshoots by
  // a little, because a near miss is the one that has to be worked out.
  chapter('whoosh', 'Whoosh!', [5, 10], [
    { line: 'Careful, not too high!', weight: 7, tray: [6, 4, 3, 1] },
    { line: 'Just enough to reach the top', weight: 8, tray: [7, 5, 3, 2] },
    { line: 'Juno is scared of the clouds', weight: 6, tray: [5, 4, 2, 1] },
    { line: 'Up, but not up and away', weight: 9, tray: [8, 6, 3, 2] },
    { line: 'Pick exactly the right lift', weight: 10, tray: [9, 7, 4, 3, 1] },
  ]),
  // No pair makes the weight, so every answer is three balloons or more.
  chapter('big-bunches', 'Big Bunches', [6, 10], [
    { line: 'Two balloons are not enough this time', weight: 9, tray: [4, 4, 6, 1] },
    { line: 'Try a bigger bunch', weight: 7, tray: [2, 2, 3, 6] },
    { line: 'Three balloons, all together', weight: 10, tray: [3, 3, 4, 8] },
    { line: 'Little ones add up', weight: 8, tray: [3, 1, 4, 6] },
    { line: 'Every balloon helps', weight: 6, tray: [1, 2, 3, 7] },
  ]),
  // Past ten, with a 10-balloon to make ten and then a bit more.
  chapter('heavy-cargo', 'Heavy Cargo', [11, 20], [
    { line: 'Bo packed a heavy backpack', weight: 13, tray: [10, 8, 3, 2] },
    { line: 'Pip ate all the berries', weight: 12, tray: [10, 9, 2, 1, 4] },
    { line: 'Tilly is carrying the picnic basket', weight: 15, tray: [10, 7, 5, 6, 2] },
    { line: 'Two kits hugging tight', weight: 17, tray: [10, 9, 4, 3, 8] },
    { line: 'The heaviest rescue yet!', weight: 20, tray: [10, 9, 8, 6, 5, 2] },
  ]),
  // A right answer that needs too many hooks sits in every tray beside one
  // that fits, so the limit changes which answer is right.
  chapter('tiny-harness', 'Tiny Harness', [8, 16], [
    { line: 'This harness only has two hooks', weight: 12, hooks: 2, tray: [4, 4, 4, 8, 6, 5] },
    { line: 'Two balloons, no more', weight: 10, hooks: 2, tray: [3, 3, 4, 7, 2, 6] },
    { line: 'Make every hook count', weight: 15, hooks: 2, tray: [5, 5, 5, 9, 6, 8] },
    { line: 'Three hooks this time', weight: 14, hooks: 3, tray: [2, 3, 4, 5, 8, 7, 1] },
    { line: 'Big balloons save hooks', weight: 16, hooks: 3, tray: [4, 4, 4, 4, 9, 5, 2] },
  ]),
  // Taking away. The first has an empty tray, so popping is the only thing to
  // try; the last pops one and clips one.
  chapter('pop', 'Pop!', [5, 15], [
    { line: 'Juno grabbed too many balloons!', weight: 7, tray: [], tied: [6, 3, 1] },
    { line: 'Pop one to float just right', weight: 5, tray: [], tied: [4, 2, 3] },
    { line: 'Which ones should go?', weight: 9, tray: [], tied: [5, 4, 3, 2] },
    { line: 'Way too much lift again', weight: 12, tray: [], tied: [7, 5, 3, 2] },
    { line: 'Pop one, then add one', weight: 10, tray: [2], tied: [9, 5, 3] },
  ]),
  // Rise exactly the right number of wind layers: lift minus weight. The bunch
  // that makes exactly the weight — the old habit — is always there, and only
  // gets the kit off the ground. The first comes already floating.
  chapter('windy-ridge', 'Windy Ridge', [4, 17], [
    { line: 'The wind is helping!', weight: 5, tray: [1, 2, 4], tied: [3, 2], layer: 2 },
    { line: 'The top wind blows home', weight: 7, tray: [5, 4, 3, 2], layer: 3 },
    { line: 'Just one layer up', weight: 6, tray: [5, 1, 3, 4], layer: 1 },
    { line: 'Catch the middle wind', weight: 9, tray: [8, 6, 5, 3, 1], layer: 2 },
    { line: 'All the way to the top wind', weight: 12, tray: [10, 7, 5, 2, 3], layer: 3 },
  ]),
  // Two ideas in every rescue.
  chapter('big-rescue', 'The Big Rescue', [5, 20], [
    { line: 'Two hooks, and the wind up high', weight: 13, hooks: 2, tray: [10, 5, 6, 7, 4, 3], layer: 2 },
    { line: 'A heavy load and too much lift', weight: 13, tray: [3], tied: [10, 6] },
    { line: 'Big load, little harness', weight: 18, hooks: 3, tray: [10, 9, 8, 6, 5, 3, 2] },
    { line: 'Pop, then up one wind', weight: 12, tray: [], tied: [7, 6, 4, 1], layer: 1 },
    { line: 'The last kit to rescue!', weight: 15, hooks: 2, tray: [10, 9, 8, 7, 6, 4, 3], layer: 2 },
  ]),
];

export const RESCUES: readonly RescueDef[] = CHAPTERS.flatMap((each) => each.rescues);

const CHAPTER_BY_RESCUE = new Map<string, ChapterDef>(
  CHAPTERS.flatMap((each) => each.rescues.map((rescue) => [rescue.id, each] as const)),
);

export function chapterOf(def: RescueDef): ChapterDef {
  const found = CHAPTER_BY_RESCUE.get(def.id);
  if (!found) throw new Error(`no chapter holds ${def.id}`);
  return found;
}

export const numberInChapter = (def: RescueDef): number =>
  chapterOf(def).rescues.findIndex((rescue) => rescue.id === def.id) + 1;
