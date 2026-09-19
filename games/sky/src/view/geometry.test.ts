import { describe, it, expect } from 'vitest';
import { DESIGN } from '@bundle/core';
import { PLANE_IDS, PLANE_TYPES } from '../logic/planes.js';
import { FIELD_WIDTH, laneAt, planeSize, skyPoint, SKY } from './geometry.js';

describe('the sky', () => {
  it('leaves the top bar clear, so a plane never flies through the hearts', () => {
    expect(SKY.spawnY).toBeGreaterThan(SKY.hudY + 30);
  });

  it('gives the fighter room below the escape line', () => {
    expect(SKY.escapeY).toBeLessThan(SKY.fighterY - 40);
    expect(SKY.fighterY).toBeLessThan(DESIGN.height);
  });

  it('keeps the widest plane on screen at either edge of its lane', () => {
    const blimp = planeSize(PLANE_TYPES.blimp);
    const left = skyPoint(PLANE_TYPES.blimp.halfWidth, 0).x - blimp.width / 2;
    const right = skyPoint(1 - PLANE_TYPES.blimp.halfWidth, 0).x + blimp.width / 2;
    expect(left).toBeGreaterThanOrEqual(0);
    expect(right).toBeLessThanOrEqual(DESIGN.width);
  });

  it('draws every plane big enough for its number to be read', () => {
    for (const id of PLANE_IDS) {
      const size = planeSize(PLANE_TYPES[id]);
      expect(size.width).toBeGreaterThan(70);
      expect(size.height).toBeGreaterThan(30);
    }
  });

  it('maps the playfield onto the screen and back again', () => {
    expect(laneAt(skyPoint(0.25, 0).x)).toBeCloseTo(0.25, 5);
    expect(skyPoint(0, 0).x).toBe(SKY.fieldLeft);
    expect(skyPoint(1, 0).x).toBeCloseTo(SKY.fieldLeft + FIELD_WIDTH, 5);
    expect(skyPoint(0.5, 1).y).toBe(SKY.escapeY);
  });

  it('clamps a tap outside the playfield to its edge', () => {
    expect(laneAt(-500)).toBe(0);
    expect(laneAt(DESIGN.width + 500)).toBe(1);
  });
});
