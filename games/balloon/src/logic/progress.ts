import { CHAPTERS, RESCUES } from './levels.data.js';
import type { StarBook } from './stars.js';

/**
 * Whatever storage hands back, made safe. Storage is a convenience: an old save,
 * a damaged one or someone else's must never stop the game opening.
 */
export function readBook(raw: unknown): StarBook {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const book: StarBook = {};
  for (const [id, value] of Object.entries(raw)) {
    if (typeof value === 'number' && value >= 1 && value <= 3) book[id] = Math.floor(value);
  }
  return book;
}

/** The first rescue without stars; the beginning again once all have them. */
export function resumeIndex(book: StarBook): number {
  const index = RESCUES.findIndex((rescue) => (book[rescue.id] ?? 0) < 1);
  return index < 0 ? 0 : index;
}

/** A rescue id or chapter id from the URL, else where the player left off. */
export function startIndex(book: StarBook, startLevel?: string): number {
  if (startLevel) {
    const byRescue = RESCUES.findIndex((rescue) => rescue.id === startLevel);
    if (byRescue >= 0) return byRescue;
    const first = CHAPTERS.find((each) => each.id === startLevel)?.rescues[0];
    if (first) return RESCUES.indexOf(first);
  }
  return resumeIndex(book);
}

export const totalStars = (book: StarBook): number =>
  RESCUES.reduce((sum, rescue) => sum + (book[rescue.id] ?? 0), 0);

export const MAX_STARS = RESCUES.length * 3;
