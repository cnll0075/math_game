import { describe, it, expect } from 'vitest';
import { DESIGN, fitToScreen, slotPositions } from './layout.js';
import { SCENE, platformAnchor } from './geometry.js';

describe('fitToScreen', () => {
  it('scales to fit a wide screen and letterboxes the sides', () => {
    const transform = fitToScreen({ width: 2048, height: 768 });
    expect(transform.scale).toBeCloseTo(1);
    expect(transform.offsetX).toBeCloseTo((2048 - 1024) / 2);
    expect(transform.offsetY).toBeCloseTo(0);
  });

  it('scales to fit a tall screen and letterboxes top and bottom', () => {
    const transform = fitToScreen({ width: 1024, height: 1536 });
    expect(transform.scale).toBeCloseTo(1);
    expect(transform.offsetY).toBeCloseTo((1536 - 768) / 2);
    expect(transform.offsetX).toBeCloseTo(0);
  });

  it('maps design points into screen space', () => {
    const transform = fitToScreen({ width: 2048, height: 1536 });
    expect(transform.scale).toBeCloseTo(2);
    expect(transform.toScreen({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
    expect(transform.toScreen({ x: DESIGN.width, y: DESIGN.height })).toEqual({ x: 2048, y: 1536 });
  });

  it('maps screen points back to design space', () => {
    const transform = fitToScreen({ width: 2048, height: 1536 });
    expect(transform.toDesign({ x: 1024, y: 768 })).toEqual({ x: 512, y: 384 });
  });

  it('survives a zero-sized screen', () => {
    const transform = fitToScreen({ width: 0, height: 0 });
    expect(Number.isFinite(transform.scale)).toBe(true);
  });
});

describe('slotPositions', () => {
  it('spaces animals without overlapping, for one through five', () => {
    for (let count = 1; count <= 5; count++) {
      const xs = slotPositions(count, 320);
      expect(xs).toHaveLength(count);
      for (let i = 1; i < count; i++) expect(xs[i]! - xs[i - 1]!).toBeGreaterThan(40);
    }
  });

  it('centres the row on the platform', () => {
    for (let count = 1; count <= 5; count++) {
      const xs = slotPositions(count, 320);
      expect(xs[0]! + xs[count - 1]!).toBeCloseTo(0);
    }
  });

  it('keeps animals on the platform', () => {
    for (let count = 1; count <= 6; count++) {
      for (const x of slotPositions(count, 320)) expect(Math.abs(x)).toBeLessThanOrEqual(160);
    }
  });

  it('returns nothing for an empty platform', () => {
    expect(slotPositions(0, 320)).toEqual([]);
  });
});

describe('scene fits the design space', () => {
  it('keeps both baskets on screen at full tilt', () => {
    const halfBasket = SCENE.platformWidth / 2;
    for (const side of ['left', 'right'] as const) {
      for (const tilt of [-SCENE.maxTiltRad, 0, SCENE.maxTiltRad]) {
        const anchor = platformAnchor(side, tilt);
        expect(anchor.x - halfBasket).toBeGreaterThanOrEqual(0);
        expect(anchor.x + halfBasket).toBeLessThanOrEqual(DESIGN.width);
      }
    }
  });

  it('keeps the tray clear of the ground line and the bottom edge', () => {
    expect(SCENE.trayY).toBeGreaterThan(SCENE.groundY);
    expect(SCENE.trayY + 60).toBeLessThanOrEqual(DESIGN.height);
  });
});
