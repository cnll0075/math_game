import { describe, it, expect } from 'vitest';
import { createRng } from './rng.js';

describe('createRng', () => {
  it('is deterministic for a seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    expect([a.next(), a.next(), a.next()]).toEqual([b.next(), b.next(), b.next()]);
  });

  it('differs across seeds', () => {
    expect(createRng(1).next()).not.toBe(createRng(2).next());
  });

  it('produces values in [0,1)', () => {
    const rng = createRng(7);
    for (let i = 0; i < 500; i++) {
      const value = rng.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('picks integers below the exclusive maximum', () => {
    const rng = createRng(1);
    for (let i = 0; i < 200; i++) {
      const value = rng.int(5);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(5);
      expect(Number.isInteger(value)).toBe(true);
    }
  });

  it('picks an element from a list', () => {
    const rng = createRng(3);
    const items = ['a', 'b', 'c'] as const;
    for (let i = 0; i < 50; i++) expect(items).toContain(rng.pick(items));
  });
});
