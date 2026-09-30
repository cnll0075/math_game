/** Best stars per rescue id, as kept in the host's storage. */
export type StarBook = Record<string, number>;

/** A rescue is never failed, only rescued more or less cleanly. */
export const starsFor = (tries: number): 1 | 2 | 3 => (tries <= 1 ? 3 : tries === 2 ? 2 : 1);

export const recordStars = (book: StarBook, id: string, stars: number): StarBook => ({
  ...book,
  [id]: Math.max(book[id] ?? 0, stars),
});
