import { describe, it, expect } from 'vitest';
import { DIAL, FOOD, onDial, onShare, plateAt, seats, SHARE, toFood } from './geometry.js';

describe('the table', () => {
  it('seats two, three or four across the table, left to right and evenly', () => {
    for (const count of [2, 3, 4]) {
      const places = seats(count);
      expect(places).toHaveLength(count);
      for (let index = 1; index < count; index += 1) expect(places[index]!.x).toBeGreaterThan(places[index - 1]!.x + 150);
      expect((places[0]!.x + places.at(-1)!.x) / 2).toBeCloseTo(576, 0);
    }
  });

  it('finds the plate under a tap: on the friend or their plate, generously', () => {
    for (const count of [2, 3, 4]) {
      seats(count).forEach((seat, index) => {
        expect(plateAt(seat, count)).toBe(index);
        expect(plateAt({ x: seat.x + 40, y: seat.y - 120 }, count)).toBe(index);
      });
      expect(plateAt({ x: 576, y: 740 }, count)).toBeNull();
      expect(plateAt({ x: 30, y: seats(count)[0]!.y }, count)).toBeNull();
    }
  });

  it('turns the dial down on its left and up on its right, and finds Share', () => {
    expect(onDial({ x: DIAL.x - 50, y: DIAL.y })).toBe(-1);
    expect(onDial({ x: DIAL.x + 50, y: DIAL.y })).toBe(1);
    expect(onDial({ x: 500, y: 300 })).toBeNull();
    expect(onShare({ x: SHARE.x, y: SHARE.y })).toBe(true);
    expect(onShare({ x: DIAL.x, y: DIAL.y })).toBe(false);
  });

  it('measures a swipe from the middle of the food, in its radii', () => {
    expect(toFood({ x: FOOD.x, y: FOOD.y })).toEqual({ x: 0, y: 0 });
    expect(toFood({ x: FOOD.x + FOOD.rx, y: FOOD.y - FOOD.ry })).toEqual({ x: 1, y: -1 });
  });
});
