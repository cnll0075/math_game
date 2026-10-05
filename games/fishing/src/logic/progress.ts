import { LEVELS, levelIndex } from './levels.data.js';
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

/** The first level without stars; the beginning again once all have them. */
export function resumeIndex(book: StarBook): number {
  const index = LEVELS.findIndex((level) => (book[level.id] ?? 0) < 1);
  return index < 0 ? 0 : index;
}

/** A level id from the URL, else where the player left off. */
export function startIndex(book: StarBook, startLevel?: string): number {
  if (startLevel) {
    const byId = levelIndex(startLevel);
    if (byId >= 0) return byId;
  }
  return resumeIndex(book);
}

export const totalStars = (book: StarBook): number => LEVELS.reduce((sum, level) => sum + (book[level.id] ?? 0), 0);

export const MAX_STARS = LEVELS.length * 3;
