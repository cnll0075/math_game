import type { FoodId, FriendId, TreatId } from './friends.js';

/**
 * One thing to share in a round.
 * `share` — a basket of treats, shared by tapping plates (`tap`) or with the dial.
 * `chairs` — the dial sets how many sit down; only a number that shares with
 *            nothing over will seat them, and then it is shared with the dial.
 * `cut` — one pizza or cake, cut through the middle into pieces.
 */
export type Course =
  | { kind: 'share'; treat: TreatId; count: number; mode: 'tap' | 'dial' }
  | { kind: 'chairs'; treat: TreatId; count: number; choices: readonly number[] }
  | { kind: 'cut'; food: FoodId; pieces: 2 | 4 };

export interface LevelDef {
  id: string;
  title: string;
  /** Under the title for the whole round: the new idea. */
  line: string;
  /** Who sits at the table, left to right. A chairs course seats the first few. */
  friends: readonly FriendId[];
  courses: readonly Course[];
}

export const LEVELS: readonly LevelDef[] = [
  {
    id: 'two-friends',
    title: 'Two Friends',
    line: 'Tap a plate to give a cookie. Everyone the same!',
    friends: ['teddy', 'bunny'],
    courses: [{ kind: 'share', treat: 'cookie', count: 6, mode: 'tap' }],
  },
  {
    id: 'strawberry-share',
    title: 'Strawberry Share',
    line: 'Share the strawberries fairly',
    friends: ['teddy', 'bunny'],
    courses: [{ kind: 'share', treat: 'strawberry', count: 10, mode: 'tap' }],
  },
  {
    id: 'one-for-biscuit',
    title: 'One for Biscuit',
    line: 'What if one is left over?',
    friends: ['teddy', 'fox'],
    courses: [{ kind: 'share', treat: 'cookie', count: 7, mode: 'tap' }],
  },
  {
    id: 'odd-grapes',
    title: 'Odd Grapes',
    line: 'Can nine be shared by two?',
    friends: ['bunny', 'fox'],
    courses: [{ kind: 'share', treat: 'grapes', count: 9, mode: 'tap' }],
  },
  {
    id: 'the-dial',
    title: 'The Dial',
    line: 'Turn the dial: how many each, all at once?',
    friends: ['teddy', 'bunny', 'fox'],
    courses: [{ kind: 'share', treat: 'cookie', count: 9, mode: 'dial' }],
  },
  {
    id: 'three-plates',
    title: 'Three Plates',
    line: 'One share is the best share',
    friends: ['teddy', 'bunny', 'fox'],
    courses: [{ kind: 'share', treat: 'strawberry', count: 12, mode: 'dial' }],
  },
  {
    id: 'four-friends',
    title: 'Four Friends',
    line: 'Raccoon has come too!',
    friends: ['teddy', 'bunny', 'fox', 'raccoon'],
    courses: [{ kind: 'share', treat: 'grapes', count: 16, mode: 'dial' }],
  },
  {
    id: 'sandwich-stack',
    title: 'Sandwich Stack',
    line: 'Biscuit is hoping again',
    friends: ['teddy', 'bunny', 'fox', 'raccoon'],
    courses: [{ kind: 'share', treat: 'sandwich', count: 14, mode: 'dial' }],
  },
  {
    id: 'surprise-guests',
    title: 'Surprise Guests',
    line: 'How many chairs, so nothing is left over?',
    friends: ['teddy', 'bunny', 'fox', 'raccoon'],
    courses: [{ kind: 'chairs', treat: 'cookie', count: 9, choices: [2, 3, 4] }],
  },
  {
    id: 'pizza-halves',
    title: 'Pizza Halves',
    line: 'Swipe across the middle to cut it in two',
    friends: ['teddy', 'bunny'],
    courses: [{ kind: 'cut', food: 'pizza', pieces: 2 }],
  },
  {
    id: 'cake-quarters',
    title: 'Cake Quarters',
    line: 'Two cuts through the middle make four',
    friends: ['teddy', 'bunny', 'fox', 'raccoon'],
    courses: [{ kind: 'cut', food: 'cake', pieces: 4 }],
  },
  {
    id: 'picnic-party',
    title: 'Picnic Party',
    line: 'Cookies first, then strawberries',
    friends: ['teddy', 'fox', 'raccoon'],
    courses: [
      { kind: 'share', treat: 'cookie', count: 6, mode: 'dial' },
      { kind: 'share', treat: 'strawberry', count: 9, mode: 'dial' },
    ],
  },
];

export const levelIndex = (id: string): number => LEVELS.findIndex((level) => level.id === id);
