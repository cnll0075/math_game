import { BOARDS } from './boards.data.js';
import type { StarBook } from './stars.js';

/** Whatever storage hands back, made safe: a damaged save must never stop the game opening. */
export function readBook(raw: unknown): StarBook {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const book: StarBook = {};
  for (const [id, value] of Object.entries(raw)) {
    if (typeof value === 'number' && value >= 1 && value <= 3) book[id] = Math.floor(value);
  }
  return book;
}

/** The first board is always open; every other opens once the one before has stars. */
export const isOpen = (book: StarBook, index: number): boolean =>
  index === 0 || (book[BOARDS[index - 1]?.id ?? ''] ?? 0) >= 1;

/** The first board without stars; the summit once every board has them. */
export function resumeIndex(book: StarBook): number {
  const index = BOARDS.findIndex((board) => (book[board.id] ?? 0) < 1);
  return index < 0 ? BOARDS.length - 1 : index;
}

/** A board id from the URL, else where the player left off. */
export function startIndex(book: StarBook, startLevel?: string): number {
  const named = startLevel ? BOARDS.findIndex((board) => board.id === startLevel) : -1;
  return named >= 0 ? named : resumeIndex(book);
}

export const totalStars = (book: StarBook): number => BOARDS.reduce((sum, board) => sum + (book[board.id] ?? 0), 0);
export const MAX_STARS = BOARDS.length * 3;
