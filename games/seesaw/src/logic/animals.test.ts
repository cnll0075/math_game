import { describe, it, expect } from 'vitest';
import { ANIMALS, ANIMAL_IDS, weightOf } from './animals.js';

describe('animal catalog', () => {
  it('uses the documented weights', () => {
    expect([ANIMALS.rabbit.weight, ANIMALS.cat.weight, ANIMALS.dog.weight, ANIMALS.bear.weight]).toEqual([1, 2, 3, 5]);
  });

  it('lists every animal once, lightest first', () => {
    expect(ANIMAL_IDS).toEqual(['rabbit', 'cat', 'dog', 'bear']);
  });

  it('gives every animal distinct art and a voice', () => {
    const bodies = new Set(ANIMAL_IDS.map((id) => ANIMALS[id].palette.body));
    expect(bodies.size).toBe(ANIMAL_IDS.length);
    for (const id of ANIMAL_IDS) expect(ANIMALS[id].voice.freq).toBeGreaterThan(0);
  });

  it('looks up weight by id', () => {
    expect(weightOf('bear')).toBe(5);
  });
});
