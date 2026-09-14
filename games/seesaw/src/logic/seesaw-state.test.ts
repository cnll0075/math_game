import { describe, it, expect } from 'vitest';
import { describeSeesaw, DEFAULT_BALANCE_CONFIG } from './seesaw-state.js';
import type { AnimalId } from './animals.js';
import type { PlacedAnimal, Side } from './seesaw-state.js';

const place = (side: Side, ...species: AnimalId[]): PlacedAnimal[] =>
  species.map((animal, index) => ({ uid: `${side}-${animal}-${index}`, species: animal, side }));

describe('describeSeesaw', () => {
  it('sums each side', () => {
    const state = describeSeesaw([...place('left', 'cat', 'chicken'), ...place('right', 'dog')]);
    expect(state.leftWeight).toBe(3);
    expect(state.rightWeight).toBe(3);
    expect(state.totalAnimals).toBe(3);
  });

  it('reports a positive difference when the left is heavier', () => {
    const state = describeSeesaw(place('left', 'bear'));
    expect(state.balanceDifference).toBe(5);
    expect(state.heavySide).toBe('left');
  });

  it('reports a negative difference when the right is heavier', () => {
    const state = describeSeesaw(place('right', 'dog'));
    expect(state.balanceDifference).toBe(-3);
    expect(state.heavySide).toBe('right');
  });

  it('has no heavy side when the weights are equal', () => {
    const state = describeSeesaw([...place('left', 'cat'), ...place('right', 'chicken', 'chicken')]);
    expect(state.heavySide).toBeNull();
    expect(state.isPerfectlyBalanced).toBe(true);
  });

  it('is not perfectly balanced while empty', () => {
    const state = describeSeesaw([]);
    expect(state.balanceDifference).toBe(0);
    expect(state.isPerfectlyBalanced).toBe(false);
  });

  it('normalizes proportionally inside the range', () => {
    expect(describeSeesaw(place('left', 'dog')).normalizedBalance).toBeCloseTo(0.5);
  });

  it('clamps normalized balance to the range', () => {
    expect(describeSeesaw(place('left', 'bear', 'bear', 'bear')).normalizedBalance).toBe(1);
    expect(describeSeesaw(place('right', 'bear', 'bear', 'bear')).normalizedBalance).toBe(-1);
  });

  it('maps differences to zones', () => {
    expect(describeSeesaw(place('left', 'chicken')).zone).toBe('green');
    expect(describeSeesaw(place('left', 'dog')).zone).toBe('yellow');
    expect(describeSeesaw(place('left', 'bear')).zone).toBe('red');
  });

  it('treats a balanced seesaw as green', () => {
    expect(describeSeesaw([...place('left', 'cat'), ...place('right', 'cat')]).zone).toBe('green');
  });

  it('honours per-level thresholds', () => {
    const config = { maxTiltDifference: 10, green: 2, yellow: 6 };
    expect(describeSeesaw(place('left', 'cat'), config).zone).toBe('green');
    expect(describeSeesaw(place('left', 'bear'), config).zone).toBe('yellow');
    expect(describeSeesaw(place('left', 'bear'), config).normalizedBalance).toBeCloseTo(0.5);
  });

  it('ships sane defaults', () => {
    expect(DEFAULT_BALANCE_CONFIG).toEqual({ maxTiltDifference: 6, green: 1, yellow: 3 });
  });
});

describe('external force', () => {
  it('is zero unless a wind is blowing', () => {
    const state = describeSeesaw(place('left', 'cat'));
    expect(state.bias).toBe(0);
    expect(state.balanceDifference).toBe(state.animalDifference);
  });

  it('presses a side down like extra weight', () => {
    const state = describeSeesaw([...place('left', 'cat'), ...place('right', 'cat')], undefined, 2);
    expect(state.animalDifference).toBe(0);
    expect(state.balanceDifference).toBe(2);
    expect(state.heavySide).toBe('left');
    expect(state.zone).toBe('yellow');
  });

  it('can be cancelled by putting weight on the other side', () => {
    const state = describeSeesaw([...place('left', 'cat'), ...place('right', 'cat', 'cat')], undefined, 2);
    expect(state.balanceDifference).toBe(0);
    expect(state.isPerfectlyBalanced).toBe(true);
  });

  it('keeps the bell quiet while a gust holds the plank over', () => {
    // Equal animals, but the wind is still pressing: the plank is not level, so
    // it must not ring.
    const state = describeSeesaw([...place('left', 'cat'), ...place('right', 'cat')], undefined, 1);
    expect(state.animalDifference).toBe(0);
    expect(state.isPerfectlyBalanced).toBe(false);
  });
});
