import { describe, it, expect } from 'vitest';
import { createRng } from '@bundle/core';
import { answerSet, BANDS } from './bands.data.js';
import { hasTrap, isTrapFor, nextNumber, spawnPlane, trapNumber } from './spawner.js';
import { PLANE_TYPES } from './planes.js';
import { planeX, type Plane } from './sky-state.js';
import type { Sum } from './equation.js';

const OVER_TEN = BANDS[1]!;
const SEVEN_PLUS_EIGHT: Sum = { left: 7, op: '+', right: 8, answer: 15 };

const wearing = (number: number): Plane => ({
  uid: `p${number}`,
  number,
  type: 'glider',
  progress: 0.2,
  fallSeconds: 10,
  lane: 0.5,
  phase: 0,
  age: 0,
  hits: 0,
  hidden: false,
  hideTimer: 0,
});

describe('isTrapFor', () => {
  it('counts an operand as a trap, because shooting one is the error of this age', () => {
    expect(isTrapFor(SEVEN_PLUS_EIGHT, 7)).toBe(true);
    expect(isTrapFor(SEVEN_PLUS_EIGHT, 8)).toBe(true);
  });

  it('counts a near miss as a trap', () => {
    expect(isTrapFor(SEVEN_PLUS_EIGHT, 14)).toBe(true);
    expect(isTrapFor(SEVEN_PLUS_EIGHT, 16)).toBe(true);
    expect(isTrapFor(SEVEN_PLUS_EIGHT, 13)).toBe(true);
  });

  it('does not count the answer itself, or a number nowhere near it', () => {
    expect(isTrapFor(SEVEN_PLUS_EIGHT, 15)).toBe(false);
    expect(isTrapFor(SEVEN_PLUS_EIGHT, 2)).toBe(false);
  });
});

describe('hasTrap', () => {
  it('is false for a sky where the answer is the only plausible number', () => {
    expect(hasTrap(SEVEN_PLUS_EIGHT, [wearing(15), wearing(2), wearing(3)])).toBe(false);
  });

  it('is true once something plausible-but-wrong is up there', () => {
    expect(hasTrap(SEVEN_PLUS_EIGHT, [wearing(15), wearing(16)])).toBe(true);
    expect(hasTrap(SEVEN_PLUS_EIGHT, [wearing(15), wearing(7)])).toBe(true);
  });
});

describe('trapNumber', () => {
  it('reaches for an operand first', () => {
    const rng = createRng(6);
    for (let i = 0; i < 40; i += 1) expect([7, 8]).toContain(trapNumber(rng, SEVEN_PLUS_EIGHT, OVER_TEN));
  });

  it('falls back to a near miss when the operands are not allowed in the sky', () => {
    // 20 − 19 = 1 in the opening band, whose planes only wear 2..10.
    const easy = BANDS[0]!;
    const sum: Sum = { left: 20, op: '-', right: 19, answer: 1 };
    const value = trapNumber(createRng(8), sum, easy);
    expect(answerSet(easy)).toContain(value);
    expect(isTrapFor(sum, value)).toBe(true);
  });

  it('never suggests a number the band would not allow', () => {
    const rng = createRng(12);
    for (const band of BANDS) {
      const allowed = answerSet(band);
      for (const answer of allowed) {
        const sum: Sum = { left: answer, op: '+', right: 0, answer };
        expect(allowed).toContain(trapNumber(rng, sum, band));
      }
    }
  });
});

describe('nextNumber', () => {
  it('injects a trap when the live sum has none in the sky', () => {
    const value = nextNumber(createRng(2), OVER_TEN, SEVEN_PLUS_EIGHT, [wearing(15), wearing(3)]);
    expect(isTrapFor(SEVEN_PLUS_EIGHT, value)).toBe(true);
  });

  it('draws freely once a trap is already flying', () => {
    const rng = createRng(2);
    const drawn = new Set<number>();
    for (let i = 0; i < 200; i += 1) {
      drawn.add(nextNumber(rng, OVER_TEN, SEVEN_PLUS_EIGHT, [wearing(15), wearing(16)]));
    }
    expect(drawn.size).toBeGreaterThan(4);
  });

  it('draws freely when nothing has been asked yet', () => {
    const allowed = answerSet(OVER_TEN);
    const rng = createRng(4);
    for (let i = 0; i < 100; i += 1) expect(allowed).toContain(nextNumber(rng, OVER_TEN, null, []));
  });
});

describe('spawnPlane', () => {
  it('starts a plane at the top, undamaged, in a lane that fits it', () => {
    const rng = createRng(5);
    for (let i = 0; i < 200; i += 1) {
      const plane = spawnPlane(rng, { uid: `p${i}`, number: 9, elapsed: 200, fallSeconds: 10 });
      const type = PLANE_TYPES[plane.type];
      expect(plane.progress).toBe(0);
      expect(plane.hits).toBe(0);
      expect(plane.number).toBe(9);
      expect(planeX(plane)).toBeGreaterThanOrEqual(type.halfWidth - 1e-9);
      expect(planeX(plane)).toBeLessThanOrEqual(1 - type.halfWidth + 1e-9);
      // A blimp is slow, so its fall takes longer than the tempo's own figure.
      expect(plane.fallSeconds).toBeCloseTo(10 / type.speed, 5);
    }
  });

  it('puts a plane where it is told, for an escort pair', () => {
    const plane = spawnPlane(createRng(1), { uid: 'p', number: 9, elapsed: 0, fallSeconds: 10, lane: 0.25 });
    expect(plane.lane).toBeCloseTo(0.25, 5);
  });
});

describe('finding room', () => {
  it('keeps a new plane clear of the ones already at the top', () => {
    const rng = createRng(19);
    const busy = [0.2, 0.5, 0.8];
    for (let i = 0; i < 200; i += 1) {
      const plane = spawnPlane(rng, {
        uid: `p${i}`,
        number: 9,
        elapsed: 0,
        fallSeconds: 10,
        avoid: busy,
      });
      const gap = Math.min(...busy.map((lane) => Math.abs(plane.lane - lane)));
      // Two numbers in the same place cannot be read, which in a game about
      // reading the number is the whole game broken.
      expect(gap).toBeGreaterThan(0.04);
    }
  });

  it('still obeys an explicit lane, so an escort pair stays a pair', () => {
    const plane = spawnPlane(createRng(1), {
      uid: 'p',
      number: 9,
      elapsed: 0,
      fallSeconds: 10,
      lane: 0.25,
      avoid: [0.25],
    });
    expect(plane.lane).toBeCloseTo(0.25, 5);
  });
});
