import type { FoodId, FriendId, TreatId } from './friends.js';

/**
 * One thing to share in a round.
 * `share` — a basket of treats, shared by tapping plates (`tap`) or with the dial.
 * `invite` — Teddy, the host, chooses who comes to the table: only a number of
 *            friends that shares the treats with nothing over can share them.
 * `cut` — one pizza or cake, cut through the middle into pieces.
 */
export type Course =
  | { kind: 'share'; treat: TreatId; count: number; mode: 'tap' | 'dial' }
  | { kind: 'invite'; treat: TreatId; count: number }
  | { kind: 'cut'; food: FoodId; pieces: 2 | 4 };

export interface LevelDef {
  id: string;
  title: string;
  /** Under the title for the whole round: the new idea. */
  line: string;
  /** Who sits at the table, left to right. In an invite course the first is the host and the rest wait to be asked. */
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
    courses: [{ kind: 'share', treat: 'strawberry', count: 7, mode: 'tap' }],
  },
  {
    id: 'nine-sandwiches',
    title: 'Nine Sandwiches',
    line: 'Can nine be shared by two?',
    friends: ['bunny', 'fox'],
    courses: [{ kind: 'share', treat: 'sandwich', count: 9, mode: 'tap' }],
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
    id: 'who-can-come',
    title: 'Who Can Come?',
    line: 'Tap friends to invite them. Share 9 with none left over!',
    friends: ['teddy', 'bunny', 'fox', 'raccoon'],
    courses: [{ kind: 'invite', treat: 'cookie', count: 9 }],
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
];

export const levelIndex = (id: string): number => LEVELS.findIndex((level) => level.id === id);

/**
 * Whether anything in this round cannot go round, so Biscuit comes to the
 * table: he is only there when there will be something for him.
 */
export const hasLeftovers = (def: LevelDef): boolean =>
  def.courses.some((course) => course.kind === 'share' && course.count % def.friends.length !== 0);
