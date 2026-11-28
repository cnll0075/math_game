import { describe, it, expect } from 'vitest';
import { DIAL, fenceAt, fenceSpot, FOOD, fromFood, onDial, onShare, plateAt, SEAT_CENTRE, seats, SHARE, toFood } from './geometry.js';

describe('the table', () => {
  it('seats two, three or four across the table, left to right and evenly', () => {
    for (const count of [2, 3, 4]) {
      const places = seats(count);
      expect(places).toHaveLength(count);
      for (let index = 1; index < count; index += 1) expect(places[index]!.x).toBeGreaterThan(places[index - 1]!.x + 150);
      expect((places[0]!.x + places.at(-1)!.x) / 2).toBeCloseTo(SEAT_CENTRE, 0);
      // Within the cloth's back edge, clear of its corners.
      expect(places[0]!.x).toBeGreaterThan(264 + 20);
      expect(places.at(-1)!.x).toBeLessThan(819 - 20);
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

  it('finds a friend waiting at the fence, and only those waiting', () => {
    for (const friend of [1, 2, 3]) {
      const spot = fenceSpot(friend);
      expect(fenceAt({ x: spot.x, y: spot.y - 60 }, [1, 2, 3])).toBe(friend);
      expect(fenceAt({ x: spot.x, y: spot.y - 60 }, [])).toBeNull();
    }
    expect(fenceAt({ x: 576, y: 700 }, [1, 2, 3])).toBeNull();
  });

  it('turns the dial down on its left and up on its right, and finds Share', () => {
    expect(onDial({ x: DIAL.x - 50, y: DIAL.y })).toBe(-1);
    expect(onDial({ x: DIAL.x + 50, y: DIAL.y })).toBe(1);
    expect(onDial({ x: 500, y: 300 })).toBeNull();
    expect(onShare({ x: SHARE.x, y: SHARE.y })).toBe(true);
    expect(onShare({ x: DIAL.x, y: DIAL.y })).toBe(false);
  });

  it('measures a swipe from the middle of whichever food it is, in its own radii', () => {
    for (const food of ['pizza', 'cake'] as const) {
      const shape = FOOD[food];
      expect(toFood(food, { x: shape.x, y: shape.y })).toEqual({ x: 0, y: 0 });
      expect(toFood(food, { x: shape.x + shape.rx, y: shape.y - shape.ry })).toEqual({ x: 1, y: -1 });
      expect(fromFood(food, { x: 1, y: -1 })).toEqual({ x: shape.x + shape.rx, y: shape.y - shape.ry });
    }
    // The cake is narrower than the pizza, so a cut across it is shorter.
    expect(FOOD.cake.rx).toBeLessThan(FOOD.pizza.rx);
  });
});
