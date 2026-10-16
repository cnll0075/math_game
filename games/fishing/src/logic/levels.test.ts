import { describe, it, expect } from 'vitest';
import { LEVELS } from './levels.data.js';
import { reachable, weightsIn } from './reach.js';
import { ITEMS, SPECIES, SPECIES_IDS, type ItemId } from './species.js';

describe('the levels', () => {
  it('are between ten and fifteen, each with its own id and title', () => {
    expect(LEVELS.length).toBeGreaterThanOrEqual(10);
    expect(LEVELS.length).toBeLessThanOrEqual(15);
    expect(new Set(LEVELS.map((level) => level.id)).size).toBe(LEVELS.length);
    expect(new Set(LEVELS.map((level) => level.title)).size).toBe(LEVELS.length);
  });

  it('can always be finished: the bucket can be made from what swims, from where it starts', () => {
    for (const level of LEVELS) {
      const start = (level.start ?? []).reduce((sum, weight) => sum + weight, 0);
      expect(start, level.id).toBeLessThan(level.capacity);
      expect(reachable(level.capacity - start, weightsIn(level)), level.id).toBe(true);
    }
  });

  it('meet every fish and every item somewhere', () => {
    const fish = new Set(LEVELS.flatMap((level) => level.fish.map(({ species }) => species)));
    expect([...fish].sort()).toEqual([...SPECIES_IDS].sort());
    const items = new Set(LEVELS.flatMap((level) => (level.items ?? []).map(({ item }) => item)));
    expect([...items].sort()).toEqual((Object.keys(ITEMS) as ItemId[]).sort());
  });

  it('bring in new fish a few at a time, never all at once', () => {
    const seen = new Set<string>();
    for (const level of LEVELS) {
      const fresh = level.fish.filter(({ species }) => !seen.has(species));
      expect(fresh.length, level.id).toBeLessThanOrEqual(LEVELS.indexOf(level) === 0 ? 2 : 1);
      for (const { species } of level.fish) seen.add(species);
    }
  });

  it('bring in one new item at a time', () => {
    const seen = new Set<string>();
    for (const level of LEVELS) {
      const fresh = (level.items ?? []).filter(({ item }) => !seen.has(item));
      expect(fresh.length, level.id).toBeLessThanOrEqual(1);
      for (const { item } of level.items ?? []) seen.add(item);
    }
  });

  it('teach the gap first and coach the very first level', () => {
    expect(LEVELS[0]!.coach).toBe(true);
    expect(LEVELS.slice(0, 3).every((level) => level.showGap)).toBe(true);
    expect(LEVELS.slice(3).some((level) => level.showGap)).toBe(false);
  });

  it('only ask for totals a six-to-eight-year-old works with: 25 at most', () => {
    for (const level of LEVELS) expect(level.capacity).toBeLessThanOrEqual(25);
  });

  it('only use fish that weigh 1 to 10', () => {
    for (const species of SPECIES_IDS) {
      expect(SPECIES[species].weight).toBeGreaterThanOrEqual(1);
      expect(SPECIES[species].weight).toBeLessThanOrEqual(10);
    }
  });
});
