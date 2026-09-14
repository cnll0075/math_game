import { describe, it, expect } from 'vitest';
import { describeObjective, isSatisfied } from './objectives.js';
import { describeSeesaw, type PlacedAnimal } from './seesaw-state.js';

/** Builds a snapshot with `left` and `right` rabbits, so weight equals count. */
const snap = (left: number, right: number) => {
  const placed: PlacedAnimal[] = [
    ...Array.from({ length: left }, (_, i) => ({ uid: `l${i}`, source: 'test', species: 'chicken' as const, side: 'left' as const })),
    ...Array.from({ length: right }, (_, i) => ({ uid: `r${i}`, source: 'test', species: 'chicken' as const, side: 'right' as const })),
  ];
  return describeSeesaw(placed);
};

describe('isSatisfied', () => {
  it('balance needs equality with animals present', () => {
    expect(isSatisfied({ kind: 'balance' }, snap(3, 3))).toBe(true);
    expect(isSatisfied({ kind: 'balance' }, snap(3, 2))).toBe(false);
    expect(isSatisfied({ kind: 'balance' }, snap(0, 0))).toBe(false);
  });

  it('sideDown needs that side strictly heavier', () => {
    expect(isSatisfied({ kind: 'sideDown', side: 'right' }, snap(1, 2))).toBe(true);
    expect(isSatisfied({ kind: 'sideDown', side: 'right' }, snap(2, 2))).toBe(false);
    expect(isSatisfied({ kind: 'sideDown', side: 'right' }, snap(3, 2))).toBe(false);
    expect(isSatisfied({ kind: 'sideDown', side: 'left' }, snap(3, 2))).toBe(true);
  });

  it('tilt needs the exact difference', () => {
    expect(isSatisfied({ kind: 'tilt', target: -3 }, snap(1, 4))).toBe(true);
    expect(isSatisfied({ kind: 'tilt', target: -3 }, snap(1, 5))).toBe(false);
    expect(isSatisfied({ kind: 'tilt', target: 2 }, snap(4, 2))).toBe(true);
  });

});

describe('describeObjective', () => {
  it('gives a short caption for each kind', () => {
    expect(describeObjective({ kind: 'balance' })).toBe('Make it level');
    expect(describeObjective({ kind: 'sideDown', side: 'right' })).toBe('Make the right side go down');
    expect(describeObjective({ kind: 'tilt', target: -1 })).toBe('Reach the star');
  });
});
