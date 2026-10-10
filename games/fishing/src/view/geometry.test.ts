import { describe, it, expect } from 'vitest';
import { BAY } from '../logic/world.js';
import { onBoat, RIG, rigPoint } from './geometry.js';

describe('the rig', () => {
  it('puts the rod tip where the world hangs the hook, whichever way the boat faces', () => {
    for (const facing of [1, -1] as const) {
      const tip = rigPoint({ x: 500, facing, angle: 0, sink: 0 }, RIG.rodTip);
      expect(tip.x).toBeCloseTo(500 + facing * BAY.rodReach, 0);
    }
  });

  it('sits the hull on the water', () => {
    expect(rigPoint({ x: 500, facing: 1, angle: 0, sink: 0 }, { x: 0, y: RIG.waterline }).y).toBe(BAY.surfaceY);
  });

  it('keeps the boy below the top of the screen', () => {
    const head = rigPoint({ x: 500, facing: 1, angle: 0, sink: 0 }, { x: RIG.fisherman.x, y: RIG.fisherman.y });
    expect(head.y).toBeGreaterThan(10);
  });

  it('knows a tap on the boat from a tap on the water beside it', () => {
    expect(onBoat({ x: 500, y: BAY.surfaceY - 60 }, 500, 1)).toBe(true);
    expect(onBoat({ x: 500, y: BAY.surfaceY + 200 }, 500, 1)).toBe(false);
    expect(onBoat({ x: 800, y: BAY.surfaceY - 60 }, 500, 1)).toBe(false);
  });
});
