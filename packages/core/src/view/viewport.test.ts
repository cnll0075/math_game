import { describe, it, expect } from 'vitest';
import { DESIGN, fitToScreen, visibleBounds } from './viewport.js';

describe('fitToScreen', () => {
  it('centres the design space and round-trips a point', () => {
    const transform = fitToScreen({ width: 2304, height: 1536 });
    expect(transform.scale).toBe(2);
    const there = transform.toScreen({ x: 100, y: 50 });
    expect(transform.toDesign(there)).toEqual({ x: 100, y: 50 });
  });

  it('reports the surplus a wider screen leaves around the design rect', () => {
    const screen = { width: 2600, height: 1536 };
    const bounds = visibleBounds(screen, fitToScreen(screen));
    expect(bounds.left).toBeLessThan(0);
    expect(bounds.right).toBeGreaterThan(DESIGN.width);
  });
});
