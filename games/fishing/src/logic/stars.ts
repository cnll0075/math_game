/** Best stars per level id, as kept in the host's storage. */
export type StarBook = Record<string, number>;

/**
 * Stars come from the clock: landing the big fish first is what leaves time
 * over. A third of it is three stars, a sixth is two.
 */
export const starsFor = (timeLeft: number, seconds: number): 1 | 2 | 3 => {
  const share = timeLeft / Math.max(1, seconds);
  return share >= 1 / 3 ? 3 : share >= 1 / 6 ? 2 : 1;
};

export const recordStars = (book: StarBook, id: string, stars: number): StarBook => ({
  ...book,
  [id]: Math.max(book[id] ?? 0, stars),
});
