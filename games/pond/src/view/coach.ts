import type { GameEvent } from '../logic/game.js';

/** Where the first board's coach is in its explanation. */
export type CoachStep = 'tap' | 'second' | 'match' | 'miss' | 'done';

/** What the frog says at each step: short enough for a six-year-old to read. */
export const COACH_LINES: Record<Exclude<CoachStep, 'done'>, string> = {
  tap: 'Tap a lily pad to turn it over!',
  second: 'Now find a pad with the same amount!',
  match: 'Same amount, they match! Find the other pair.',
  miss: 'Not the same, so they hide again. Remember where they were!',
};

/**
 * The coach's next step after what just happened on the board. It follows the
 * child rather than leading: each line explains the thing they just did, or
 * the thing to do next.
 */
export function coachAfter(step: CoachStep, events: readonly GameEvent[]): CoachStep {
  let next = step;
  for (const event of events) {
    if (next === 'done') return 'done';
    if (event.type === 'cleared') next = 'done';
    else if (event.type === 'matched') next = 'match';
    else if (event.type === 'missed') next = 'miss';
    else if (event.type === 'flipped' && next !== 'second') next = 'second';
  }
  return next;
}
