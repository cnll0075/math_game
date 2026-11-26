import { describe, it, expect } from 'vitest';
import { LEVELS, levelIndex } from './levels.data.js';

const shares = LEVELS.flatMap((level, index) =>
  level.courses.flatMap((course) => (course.kind === 'share' ? [{ level, index, course }] : [])),
);

describe('the rounds', () => {
  it('are twelve, each with its own id', () => {
    expect(LEVELS).toHaveLength(12);
    expect(new Set(LEVELS.map((level) => level.id)).size).toBe(12);
    expect(levelIndex('cake-quarters')).toBe(10);
    expect(levelIndex('nope')).toBe(-1);
  });

  it('seat two to four different friends', () => {
    for (const level of LEVELS) {
      expect(level.friends.length).toBeGreaterThanOrEqual(2);
      expect(level.friends.length).toBeLessThanOrEqual(4);
      expect(new Set(level.friends).size).toBe(level.friends.length);
    }
  });

  it('share one at a time for the first four rounds, and with the dial from the fifth', () => {
    for (const { index, course } of shares) expect(course.mode).toBe(index < 4 ? 'tap' : 'dial');
  });

  it('always have enough for everyone, and a dial answer between 1 and 10', () => {
    for (const { level, course } of shares) {
      expect(course.count).toBeGreaterThanOrEqual(level.friends.length);
      const each = Math.floor(course.count / level.friends.length);
      expect(each).toBeGreaterThanOrEqual(1);
      expect(each).toBeLessThanOrEqual(10);
    }
  });

  it('leave something for Biscuit only in the remainder rounds, and always fewer than the friends', () => {
    const remainders = shares.filter(({ level, course }) => course.count % level.friends.length !== 0);
    expect(remainders.map(({ level }) => level.id)).toEqual(['one-for-biscuit', 'odd-grapes', 'sandwich-stack']);
  });

  it('have one round of inviting friends, where exactly one number at the table shares with nothing over', () => {
    const invites = LEVELS.flatMap((level) => level.courses.flatMap((course) => (course.kind === 'invite' ? [{ level, course }] : [])));
    expect(invites).toHaveLength(1);
    const { level, course } = invites[0]!;
    const sizes = Array.from({ length: level.friends.length - 1 }, (_, index) => index + 2);
    expect(sizes.filter((size) => course.count % size === 0)).toHaveLength(1);
  });

  it('cut a pizza in halves for two, and a cake in quarters for four', () => {
    const cuts = LEVELS.flatMap((level) => level.courses.flatMap((course) => (course.kind === 'cut' ? [{ level, course }] : [])));
    expect(cuts.map(({ level, course }) => [course.food, course.pieces, level.friends.length])).toEqual([
      ['pizza', 2, 2],
      ['cake', 4, 4],
    ]);
  });
});
