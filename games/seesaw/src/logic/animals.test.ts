import { describe, it, expect } from 'vitest';
import { ANIMALS, ANIMAL_IDS, weightOf } from './animals.js';

describe('animal catalog', () => {
  it('uses the documented weights', () => {
    expect([ANIMALS.chicken.weight, ANIMALS.cat.weight, ANIMALS.dog.weight, ANIMALS.bear.weight]).toEqual([1, 2, 3, 5]);
  });

  it('lists every animal once, lightest first', () => {
    expect(ANIMAL_IDS).toEqual(['chicken', 'cat', 'dog', 'bear']);
  });

  it('gives every animal distinct art', () => {
    const bodies = new Set(ANIMAL_IDS.map((id) => ANIMALS[id].palette.body));
    expect(bodies.size).toBe(ANIMAL_IDS.length);
  });

  it('gives every animal a cry a child would recognise', () => {
    for (const id of ANIMAL_IDS) {
      const { voice } = ANIMALS[id];
      expect(voice.from, id).toBeGreaterThan(0);
      expect(voice.to, id).toBeGreaterThan(0);
      expect(voice.seconds, id).toBeGreaterThan(0);
      expect(voice.repeats, id).toBeGreaterThanOrEqual(1);
      expect(voice.grit, id).toBeGreaterThanOrEqual(0);
      expect(voice.grit, id).toBeLessThanOrEqual(1);
    }
  });

  it('pitches them from the smallest animal down to the biggest', () => {
    const pitches = ANIMAL_IDS.map((id) => ANIMALS[id].voice.from);
    expect([...pitches].sort((a, b) => b - a)).toEqual(pitches);
  });

  it('looks up weight by id', () => {
    expect(weightOf('bear')).toBe(5);
    expect(weightOf('chicken')).toBe(1);
  });
});
