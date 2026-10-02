import { describe, it, expect } from 'vitest';
import { hooksOf, layerOf, problemsWith, targetOf, tiedOf, type RescueDef } from './rescue-def.js';

const plain: RescueDef = { id: 'x', line: 'x', weight: 8, tray: [5, 3] };

describe('a rescue definition', () => {
  it('has six hooks and nothing tied unless it says otherwise', () => {
    expect(hooksOf(plain)).toBe(6);
    expect(tiedOf(plain)).toEqual([]);
    expect(hooksOf({ ...plain, hooks: 2 })).toBe(2);
  });

  it('asks for its weight, plus a layer of lift for every wind layer up', () => {
    expect(layerOf(plain)).toBe(0);
    expect(targetOf(plain)).toBe(8);
    expect(targetOf({ ...plain, weight: 7, layer: 3 })).toBe(10);
  });

  it('finds nothing wrong with a sound rescue', () => {
    expect(problemsWith(plain)).toEqual([]);
    expect(problemsWith({ ...plain, layer: 3 })).toEqual([]);
  });

  it('rejects numbers outside the ranges the game draws', () => {
    expect(problemsWith({ ...plain, weight: 21 })).not.toEqual([]);
    expect(problemsWith({ ...plain, tray: [11] })).not.toEqual([]);
    expect(problemsWith({ ...plain, tray: [0] })).not.toEqual([]);
    expect(problemsWith({ ...plain, hooks: 7 })).not.toEqual([]);
  });

  it('rejects a layer that is not one of the three, and a target past twenty', () => {
    expect(problemsWith({ ...plain, layer: 0 })).not.toEqual([]);
    expect(problemsWith({ ...plain, layer: 4 })).not.toEqual([]);
    expect(problemsWith({ ...plain, weight: 18, layer: 3 })).not.toEqual([]);
  });

  it('rejects more tied balloons than hooks', () => {
    expect(problemsWith({ ...plain, hooks: 2, tied: [1, 1, 1] })).not.toEqual([]);
  });
});
