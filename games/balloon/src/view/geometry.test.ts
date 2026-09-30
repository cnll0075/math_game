import { describe, it, expect } from 'vitest';
import { DESIGN } from '@bundle/core';
import { createRescue } from '../logic/rescue.js';
import { RESCUES } from '../logic/levels.data.js';
import type { RescueDef } from '../logic/rescue-def.js';
import { balloonRadius, bunchCount, bunchPoint, HOME, hitTest, LAYOUT, ledgeSpot, pegPoint, PUFF_RADIUS, puffTrayPoint, trayPoint } from './geometry.js';

const def: RescueDef = { id: 'g', line: '', weight: 8, tray: [5, 3, 6, 2] };

describe('geometry', () => {
  it('makes a bigger number a bigger balloon', () => {
    for (let value = 1; value < 10; value += 1) expect(balloonRadius(value + 1)).toBeGreaterThan(balloonRadius(value));
  });

  it('keeps every tray balloon apart and on screen, in every rescue', () => {
    for (const rescue of RESCUES) {
      const points = rescue.tray.map((_, index) => trayPoint(rescue, index));
      points.forEach((point, index) => {
        const radius = balloonRadius(rescue.tray[index]!);
        expect(point.x - radius, rescue.id).toBeGreaterThanOrEqual(0);
        expect(point.x + radius, rescue.id).toBeLessThanOrEqual(LAYOUT.button.left);
        const next = points[index + 1];
        if (next) expect(next.x - point.x, rescue.id).toBeGreaterThanOrEqual(radius + balloonRadius(rescue.tray[index + 1]!) - 12);
      });
      rescue.wind?.puffs.forEach((_, index) => {
        expect(puffTrayPoint(rescue, index).x, rescue.id).toBeLessThan(LAYOUT.button.left);
      });
    }
  });

  it('gives each puff in the tray room for its gusts, so none overlaps the next', () => {
    for (const rescue of RESCUES) {
      const puffs = rescue.wind?.puffs ?? [];
      for (let index = 1; index < puffs.length; index += 1) {
        const gap = puffTrayPoint(rescue, index).x - puffTrayPoint(rescue, index - 1).x;
        expect(gap, rescue.id).toBeGreaterThanOrEqual(2 * PUFF_RADIUS + 24);
      }
    }
  });

  it('keeps the peg clear of the first step post', () => {
    const firstPost = LAYOUT.homeX + LAYOUT.stepWidth;
    expect(Math.abs(pegPoint(HOME).x - firstPost)).toBeGreaterThanOrEqual(16);
  });

  it('puts the ledge on screen, above the ground', () => {
    for (const rescue of RESCUES) {
      const spot = ledgeSpot(rescue);
      expect(spot.x).toBeGreaterThan(0);
      expect(spot.x).toBeLessThan(DESIGN.width);
      expect(spot.y).toBeLessThan(HOME.y);
    }
  });

  it('finds the tray balloon under a finger, and skips one already taken', () => {
    const rescue = createRescue(def);
    expect(hitTest(trayPoint(def, 2), rescue.state)).toEqual({ kind: 'tray', index: 2 });
    rescue.clip(2);
    expect(hitTest(trayPoint(def, 2), rescue.state)).toBeNull();
  });

  it('clips the balloon under the finger even where a squeezed tray lets tap circles overlap', () => {
    for (const rescue of RESCUES) {
      const state = createRescue(rescue).state;
      rescue.tray.forEach((value, index) => {
        const centre = trayPoint(rescue, index);
        const reach = balloonRadius(value) * 0.8;
        for (let step = 0; step < 8; step += 1) {
          const angle = (step / 8) * Math.PI * 2;
          const point = { x: centre.x + Math.cos(angle) * reach, y: centre.y + Math.sin(angle) * reach };
          expect(hitTest(point, state), `${rescue.id} balloon ${index}`).toEqual({ kind: 'tray', index });
        }
      });
    }
  });

  it('finds a clipped balloon on the harness', () => {
    const rescue = createRescue(def);
    rescue.clip(0);
    rescue.clip(1);
    expect(hitTest(bunchPoint(1, 2, HOME), rescue.state)).toEqual({ kind: 'clipped', slot: 1 });
  });

  it('finds a tied balloon, which a tap pops', () => {
    const rescue = createRescue({ id: 't', line: '', weight: 7, tray: [2], tied: [6, 3, 1] });
    rescue.clip(0);
    expect(hitTest(bunchPoint(1, 4, HOME), rescue.state)).toEqual({ kind: 'tied', index: 1 });
    expect(hitTest(bunchPoint(3, 4, HOME), rescue.state)).toEqual({ kind: 'clipped', slot: 0 });
  });

  it('lays a limited harness out by its hooks, and finds its balloons there', () => {
    const limited: RescueDef = { id: 'h', line: '', weight: 12, hooks: 2, tray: [4, 8] };
    const rescue = createRescue(limited);
    rescue.clip(1);
    expect(bunchCount(rescue.state)).toBe(2);
    expect(hitTest(bunchPoint(0, 2, HOME), rescue.state)).toEqual({ kind: 'clipped', slot: 0 });
    expect(bunchCount(createRescue(def).state)).toBe(0);
  });

  it('finds the button', () => {
    const { left, top, width, height } = LAYOUT.button;
    expect(hitTest({ x: left + width / 2, y: top + height / 2 }, createRescue(def).state)).toEqual({ kind: 'letGo' });
  });

  it('finds nothing in the open sky', () => {
    expect(hitTest({ x: 700, y: 120 }, createRescue(def).state)).toBeNull();
  });
});
