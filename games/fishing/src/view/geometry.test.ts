import { describe, it, expect } from 'vitest';
import { BAY } from '../logic/world.js';
import { across, onBoat, RIG, rigPoint } from './geometry.js';

describe('the rig', () => {
  it('puts the rod tip where the world hangs the hook, whichever way the boat faces', () => {
    for (const swing of [0, Math.PI / 3, Math.PI / 2, Math.PI]) {
      const tip = rigPoint({ x: 500, swing, angle: 0, sink: 0 }, RIG.rodTip);
      expect(tip.x).toBeCloseTo(500 + across(swing) * BAY.rodReach, 0);
    }
    expect(across(0)).toBe(1);
    expect(across(Math.PI)).toBe(-1);
  });

  it('sits the hull on the water', () => {
    expect(rigPoint({ x: 500, swing: 0, angle: 0, sink: 0 }, { x: 0, y: RIG.waterline }).y).toBe(BAY.surfaceY);
  });

  it('keeps the boy below the top of the screen', () => {
    const head = rigPoint({ x: 500, swing: 0, angle: 0, sink: 0 }, { x: RIG.fisherman.x, y: RIG.fisherman.y });
    expect(head.y).toBeGreaterThan(10);
  });

  it('knows a tap on the boat from a tap on the water beside it', () => {
    expect(onBoat({ x: 500, y: BAY.surfaceY - 60 }, 500, 0)).toBe(true);
    expect(onBoat({ x: 500, y: BAY.surfaceY + 200 }, 500, 0)).toBe(false);
    expect(onBoat({ x: 800, y: BAY.surfaceY - 60 }, 500, 0)).toBe(false);
  });

  it('swings the far end of the boat up as it turns, rather than squashing it flat', () => {
    const half = rigPoint({ x: 500, swing: Math.PI / 2, angle: 0, sink: 0 }, RIG.rodTip);
    const flat = rigPoint({ x: 500, swing: 0, angle: 0, sink: 0 }, RIG.rodTip);
    expect(half.y).toBeLessThan(flat.y - 30);
  });
});
