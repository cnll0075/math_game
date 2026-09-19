import { describe, it, expect } from 'vitest';
import { depthOf, recordingContext } from '@bundle/core';
import { PLANE_IDS, type PlaneTypeId } from '../logic/planes.js';
import { drawBoom, drawBullet, drawFighter, drawPlane } from './plane-art.js';
import type { Plane } from '../logic/sky-state.js';

const plane = (type: PlaneTypeId, overrides: Partial<Plane> = {}): Plane => ({
  uid: 'p',
  number: 15,
  type,
  progress: 0.4,
  fallSeconds: 10,
  lane: 0.5,
  phase: 0,
  age: 0,
  hits: 0,
  hidden: false,
  hideTimer: 0,
  ...overrides,
});

describe('drawing a plane', () => {
  it('writes its number on it, and balances every save with a restore', () => {
    for (const id of PLANE_IDS) {
      const { ctx, texts } = recordingContext();
      drawPlane(ctx, plane(id));
      expect(texts).toContain('15');
      expect(depthOf(ctx)).toBe(0);
    }
  });

  it('hides the number of a plane behind cloud, but still draws the plane', () => {
    const { ctx, texts, calls } = recordingContext();
    drawPlane(ctx, plane('hider', { hidden: true }));
    expect(texts).not.toContain('15');
    expect(calls).toContain('fill');
    expect(depthOf(ctx)).toBe(0);
  });

  it('shows a blimp wearing its damage', () => {
    const fresh = recordingContext();
    drawPlane(fresh.ctx, plane('blimp'));
    const hurt = recordingContext();
    drawPlane(hurt.ctx, plane('blimp', { hits: 2 }));
    expect(hurt.calls.length).toBeGreaterThan(fresh.calls.length);
    expect(depthOf(hurt.ctx)).toBe(0);
  });
});

describe('drawing the fighter', () => {
  it('carries the sum on its fuselage', () => {
    const { ctx, texts } = recordingContext();
    drawFighter(ctx, 0.5, { jammed: false, sum: '7 + 8' });
    expect(texts).toContain('7 + 8');
    expect(depthOf(ctx)).toBe(0);
  });

  it('looks different when the gun is jammed', () => {
    const cool = recordingContext();
    drawFighter(cool.ctx, 0.5, { jammed: false, sum: '7 + 8' });
    const hot = recordingContext();
    drawFighter(hot.ctx, 0.5, { jammed: true, sum: '7 + 8' });
    expect(hot.calls.length).toBeGreaterThan(cool.calls.length);
  });
});

describe('drawing shells and explosions', () => {
  it('draws without leaving the context saved', () => {
    const { ctx, calls } = recordingContext();
    drawBullet(ctx, 0.5, 0.8);
    drawBoom(ctx, { x: 400, y: 300 }, 0.5);
    expect(calls).toContain('fill');
    expect(depthOf(ctx)).toBe(0);
  });
});
