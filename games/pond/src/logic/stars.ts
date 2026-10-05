/** Best stars per board id, as kept in the host's storage. */
export type StarBook = Record<string, number>;

/** At most one miss a pair is three stars, two a pair is two, anything more is one. */
export const starsFor = (misses: number, pairs: number): 1 | 2 | 3 =>
  misses <= pairs ? 3 : misses <= 2 * pairs ? 2 : 1;

export const recordStars = (book: StarBook, id: string, stars: number): StarBook => ({
  ...book,
  [id]: Math.max(book[id] ?? 0, stars),
});
