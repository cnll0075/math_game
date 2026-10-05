import { describe, it, expect } from 'vitest';
import { COACH_LINES, coachAfter, type CoachStep } from './coach.js';

describe('the coach on the first board', () => {
  it('starts by asking for a tap', () => {
    expect(coachAfter('tap', [])).toBe('tap');
    expect(COACH_LINES.tap).toBe('Tap a lily pad to turn it over!');
  });

  it('asks for a second pad once one is up', () => {
    expect(coachAfter('tap', [{ type: 'flipped', index: 0 }])).toBe('second');
  });

  it('says why a pair stayed up, or why it hid again', () => {
    expect(coachAfter('second', [{ type: 'flipped', index: 3 }, { type: 'matched', a: 0, b: 3, value: 7 }])).toBe('match');
    expect(coachAfter('second', [{ type: 'flipped', index: 1 }, { type: 'missed', a: 0, b: 1 }])).toBe('miss');
  });

  it('asks for the second pad again when the next turn starts', () => {
    for (const from of ['match', 'miss'] as CoachStep[]) {
      expect(coachAfter(from, [{ type: 'flipped', index: 2 }])).toBe('second');
    }
    // A tap during the hold puts the missed pair back and starts a turn.
    expect(coachAfter('miss', [{ type: 'hidden', a: 0, b: 1 }, { type: 'flipped', index: 2 }])).toBe('second');
  });

  it('keeps explaining a miss while the pair is still up, and stops once the pond is cleared', () => {
    expect(coachAfter('miss', [{ type: 'hidden', a: 0, b: 1 }])).toBe('miss');
    expect(coachAfter('second', [{ type: 'flipped', index: 2 }, { type: 'matched', a: 1, b: 2, value: 5 }, { type: 'cleared', misses: 0 }])).toBe('done');
    expect(coachAfter('done', [{ type: 'flipped', index: 0 }])).toBe('done');
  });

  it('has a line for every step it shows', () => {
    for (const step of ['tap', 'second', 'match', 'miss'] as const) expect(COACH_LINES[step].length).toBeGreaterThan(0);
  });
});
