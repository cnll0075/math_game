import { describe, it, expect } from 'vitest';
import { LANES, laneAt, laneCentre } from './lanes.js';

describe('lanes', () => {
  it('has three of them', () => {
    expect(LANES).toBe(3);
  });

  it('puts each lane centre inside its own third', () => {
    for (let lane = 0; lane < LANES; lane += 1) {
      expect(laneAt(laneCentre(lane))).toBe(lane);
    }
    expect(laneCentre(0)).toBeCloseTo(1 / 6, 5);
    expect(laneCentre(1)).toBeCloseTo(0.5, 5);
    expect(laneCentre(2)).toBeCloseTo(5 / 6, 5);
  });

  it('reads the edges of the path as the outside lanes', () => {
    expect(laneAt(0)).toBe(0);
    expect(laneAt(1)).toBe(LANES - 1);
    expect(laneAt(-2)).toBe(0);
    expect(laneAt(9)).toBe(LANES - 1);
  });

  it('splits at the thirds', () => {
    expect(laneAt(0.32)).toBe(0);
    expect(laneAt(0.34)).toBe(1);
    expect(laneAt(0.66)).toBe(1);
    expect(laneAt(0.68)).toBe(2);
  });
});
