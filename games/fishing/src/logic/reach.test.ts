import { describe, it, expect } from 'vitest';
import { reachable } from './reach.js';

describe('reachable', () => {
  it('says whether an amount can be made from these weights, any number of each', () => {
    expect(reachable(0, [2, 5])).toBe(true);
    expect(reachable(1, [2, 5])).toBe(false);
    expect(reachable(3, [2, 5])).toBe(false);
    expect(reachable(7, [2, 5])).toBe(true);
    expect(reachable(9, [2, 5])).toBe(true);
    expect(reachable(-1, [1])).toBe(false);
  });
});
