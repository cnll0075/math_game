import type { LevelDef } from './levels.data.js';

/** Best stars per round id, as kept in the host's storage. */
export type StarBook = Record<string, number>;

/**
 * The fewest shares a round can take: one for each course shared with the
 * dial, the dial turned straight to the answer. Tapping and cutting need none.
 */
export const bestShares = (def: LevelDef): number =>
  def.courses.filter((course) => (course.kind === 'share' && course.mode === 'dial') || course.kind === 'chairs').length;

/**
 * Stars count shares, never dial turns or taps: the fewest possible is three,
 * one more is two, anything else is one. Finishing is always worth a star, and
 * a round with nothing to share by the dial is worth three.
 */
export function starsFor(def: LevelDef, shares: number): 1 | 2 | 3 {
  const best = bestShares(def);
  if (best === 0 || shares <= best) return 3;
  return shares === best + 1 ? 2 : 1;
}

export const recordStars = (book: StarBook, id: string, stars: number): StarBook => ({
  ...book,
  [id]: Math.max(book[id] ?? 0, stars),
});
