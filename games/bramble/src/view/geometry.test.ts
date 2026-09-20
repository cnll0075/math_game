import { describe, it, expect } from 'vitest';
import { DESIGN } from '@bundle/core';
import { LANES, laneCentre } from '../logic/lanes.js';
import { laneWidth, obstacleSize, PATH, pathPoint, pathXTo } from './geometry.js';

describe('the path', () => {
  it('leaves the top bar clear, so a row never starts under the fuel bar', () => {
    expect(PATH.horizonY).toBeGreaterThan(PATH.hudY + 40);
  });

  it('gives the rabbit room below the last row', () => {
    expect(PATH.rabbitY).toBeGreaterThan(PATH.horizonY);
    expect(PATH.rabbitY).toBeLessThan(DESIGN.height);
  });

  it('fits an obstacle inside its lane with room to spare', () => {
    expect(obstacleSize().width).toBeLessThan(laneWidth());
    // Big enough for a two-digit number to read across a room.
    expect(obstacleSize().width).toBeGreaterThan(110);
  });

  it('keeps every lane on screen', () => {
    for (let lane = 0; lane < LANES; lane += 1) {
      const centre = pathPoint(laneCentre(lane), 0).x;
      expect(centre - obstacleSize().width / 2).toBeGreaterThanOrEqual(0);
      expect(centre + obstacleSize().width / 2).toBeLessThanOrEqual(DESIGN.width);
    }
  });

  it('maps the path onto the screen and back', () => {
    expect(pathXTo(pathPoint(0.25, 0).x)).toBeCloseTo(0.25, 5);
    expect(pathPoint(0, 0).x).toBe(PATH.left);
    expect(pathPoint(0.5, 1).y).toBe(PATH.rabbitY);
  });

  it('clamps a touch outside the path to its edge', () => {
    expect(pathXTo(-400)).toBe(0);
    expect(pathXTo(DESIGN.width + 400)).toBe(1);
  });
});
