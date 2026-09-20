import { describe, it, expect } from 'vitest';
import { depthOf, recordingContext } from '@bundle/core';
import { PLANE_IDS, type PlaneTypeId } from '../logic/planes.js';
import { drawBoom, drawBullet, drawFighter, drawMissed, drawPlane } from './plane-art.js';
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
    drawFighter(ctx, 0.5, { jammed: false, sum: '7 + 8', urgency: 0 });
    expect(texts).toContain('7 + 8');
    expect(depthOf(ctx)).toBe(0);
  });

  it('looks different when the gun is jammed', () => {
    const cool = recordingContext();
    drawFighter(cool.ctx, 0.5, { jammed: false, sum: '7 + 8', urgency: 0 });
    const hot = recordingContext();
    drawFighter(hot.ctx, 0.5, { jammed: true, sum: '7 + 8', urgency: 0 });
    expect(hot.calls.length).toBeGreaterThan(cool.calls.length);
  });
});

describe('drawing a gold plane', () => {
  it('wears a heart, so what it is worth needs no explaining', () => {
    const { ctx, calls } = recordingContext();
    drawPlane(ctx, plane('treasure'), true);
    // The badge is the only bezier work in a plane; the others have none.
    expect(calls.filter((call) => call === 'bezierCurveTo').length).toBeGreaterThanOrEqual(2);
    expect(depthOf(ctx)).toBe(0);
  });

  it('never wears a heart it cannot give back', () => {
    const offered = recordingContext();
    drawPlane(offered.ctx, plane('treasure'), true);
    const spent = recordingContext();
    drawPlane(spent.ctx, plane('treasure'), false);
    // The badge is still there either way — but filled when there is a heart to
    // win and outlined when there is not, which is how the top bar draws a
    // spent heart too.
    expect(spent.calls.filter((call) => call === 'bezierCurveTo').length).toBe(
      offered.calls.filter((call) => call === 'bezierCurveTo').length,
    );
    expect(spent.calls.filter((call) => call === 'fill').length).toBeLessThan(
      offered.calls.filter((call) => call === 'fill').length,
    );
    expect(depthOf(spent.ctx)).toBe(0);
  });

  it('leaves every other plane without one', () => {
    for (const id of PLANE_IDS.filter((entry) => entry !== 'treasure')) {
      const { ctx, calls } = recordingContext();
      drawPlane(ctx, plane(id), true);
      expect(calls.filter((call) => call === 'bezierCurveTo')).toHaveLength(0);
    }
  });
});

describe('drawing what got away', () => {
  it('rings it and writes the sum that was missed', () => {
    const { ctx, texts } = recordingContext();
    drawMissed(ctx, { x: 400, y: 600 }, '7 + 8 = 15', 0.2);
    expect(texts).toContain('7 + 8 = 15');
    expect(depthOf(ctx)).toBe(0);
  });
});

describe('the plaque under pressure', () => {
  it('warms as the plane being asked about runs out of sky', () => {
    const calm = recordingContext();
    drawFighter(calm.ctx, 0.5, { jammed: false, sum: '7 + 8', urgency: 0 });
    const urgent = recordingContext();
    drawFighter(urgent.ctx, 0.5, { jammed: false, sum: '7 + 8', urgency: 1 });
    // Same shapes either way: it is the colour that changes, not the layout, so
    // nothing moves under the player's eye.
    expect(urgent.calls.length).toBe(calm.calls.length);
    expect(depthOf(urgent.ctx)).toBe(0);
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
