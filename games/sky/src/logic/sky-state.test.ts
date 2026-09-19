import { describe, it, expect } from 'vitest';
import { PLANE_TYPES, type PlaneTypeId } from './planes.js';
import { advance, damage, escaped, planeX, remaining, struck, type Plane } from './sky-state.js';

const plane = (type: PlaneTypeId, overrides: Partial<Plane> = {}): Plane => ({
  uid: 'p1',
  number: 15,
  type,
  progress: 0,
  fallSeconds: 10,
  lane: 0.5,
  phase: 0,
  age: 0,
  hits: 0,
  hidden: false,
  hideTimer: PLANE_TYPES[type].showSeconds,
  ...overrides,
});

describe('a plane falling', () => {
  it('crosses the sky in its own fall time', () => {
    const p = plane('glider');
    advance(p, 5);
    expect(p.progress).toBeCloseTo(0.5, 5);
    expect(remaining(p)).toBeCloseTo(5, 5);
    expect(escaped(p)).toBe(false);
    advance(p, 5);
    expect(escaped(p)).toBe(true);
    expect(remaining(p)).toBe(0);
  });

  it('keeps a weaver on the playfield however far it swings', () => {
    const p = plane('weaver', { lane: 0.02 });
    for (let i = 0; i < 400; i += 1) {
      advance(p, 1 / 60);
      const x = planeX(p);
      expect(x).toBeGreaterThanOrEqual(PLANE_TYPES.weaver.halfWidth - 1e-9);
      expect(x).toBeLessThanOrEqual(1 - PLANE_TYPES.weaver.halfWidth + 1e-9);
    }
  });

  it('holds a straight faller in its lane', () => {
    const p = plane('glider', { lane: 0.3 });
    advance(p, 3);
    expect(planeX(p)).toBeCloseTo(0.3, 5);
  });

  it('hides and shows the cloud-hider number in turn', () => {
    const p = plane('hider');
    expect(p.hidden).toBe(false);
    advance(p, PLANE_TYPES.hider.showSeconds + 0.01);
    expect(p.hidden).toBe(true);
    advance(p, PLANE_TYPES.hider.hideSeconds + 0.01);
    expect(p.hidden).toBe(false);
  });

  it('is struck only by a shell inside its body', () => {
    const p = plane('glider', { progress: 0.5, lane: 0.5 });
    expect(struck(p, 0.5, 0.5)).toBe(true);
    expect(struck(p, 0.5 + PLANE_TYPES.glider.halfWidth - 0.001, 0.5)).toBe(true);
    expect(struck(p, 0.5 + PLANE_TYPES.glider.halfWidth + 0.01, 0.5)).toBe(false);
    expect(struck(p, 0.5, 0.5 + PLANE_TYPES.glider.halfHeight + 0.01)).toBe(false);
  });

  it('takes a glider down in one shot', () => {
    expect(damage(plane('glider'))).toBe('destroyed');
  });

  it('takes a blimp down in three, and no fewer', () => {
    const p = plane('blimp');
    expect(damage(p)).toBe('damaged');
    expect(damage(p)).toBe('damaged');
    expect(damage(p)).toBe('destroyed');
  });
});
