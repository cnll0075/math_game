import { describe, it, expect } from 'vitest';
import { createRng } from '@bundle/core';
import { drawType, PLANE_IDS, PLANE_TYPES, typesAt } from './planes.js';

describe('plane types', () => {
  it('opens with nothing but gliders', () => {
    expect(typesAt(0).map((type) => type.id)).toEqual(['glider']);
  });

  it('brings each type in at its own arrival time', () => {
    expect(typesAt(30).map((type) => type.id)).toEqual(['glider', 'weaver']);
    expect(typesAt(50).map((type) => type.id)).toContain('blimp');
    expect(typesAt(75).map((type) => type.id)).toContain('scout');
    expect(typesAt(110).map((type) => type.id)).toEqual(PLANE_IDS);
  });

  it('describes a blimp as slow and three-hit, and a scout as fast and one-hit', () => {
    expect(PLANE_TYPES.blimp.speed).toBeLessThan(1);
    expect(PLANE_TYPES.blimp.hits).toBe(3);
    expect(PLANE_TYPES.scout.speed).toBeGreaterThan(1.5);
    expect(PLANE_TYPES.scout.hits).toBe(1);
  });

  it('gives only the cloud-hider something to hide behind', () => {
    for (const id of PLANE_IDS) {
      if (id === 'hider') expect(PLANE_TYPES[id].hideSeconds).toBeGreaterThan(0);
      else expect(PLANE_TYPES[id].hideSeconds).toBe(0);
    }
  });

  it('keeps every plane small enough to fit the playfield twice over', () => {
    for (const id of PLANE_IDS) {
      expect(PLANE_TYPES[id].halfWidth).toBeGreaterThan(0);
      expect(PLANE_TYPES[id].halfWidth).toBeLessThan(0.25);
      expect(PLANE_TYPES[id].hits).toBeGreaterThanOrEqual(1);
    }
  });

  it('only ever draws a type that has arrived', () => {
    const rng = createRng(4);
    for (let i = 0; i < 500; i += 1) expect(drawType(rng, 40).id).toMatch(/glider|weaver/);
  });

  it('draws every arrived type sooner or later', () => {
    const rng = createRng(9);
    const seen = new Set(Array.from({ length: 2000 }, () => drawType(rng, 200).id));
    expect([...seen].sort()).toEqual([...PLANE_IDS].sort());
  });
});
