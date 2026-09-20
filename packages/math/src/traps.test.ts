import { describe, it, expect } from 'vitest';
import { createRng } from '@bundle/core';
import { answerSet, BANDS } from './bands.data.js';
import { isTrapFor, trapNumber } from './traps.js';
import type { Sum } from './equation.js';

const OVER_TEN = BANDS[1]!;
const SEVEN_PLUS_EIGHT: Sum = { left: 7, op: '+', right: 8, answer: 15 };

describe('isTrapFor', () => {
  it('counts an operand, because taking one is the error of this age', () => {
    expect(isTrapFor(SEVEN_PLUS_EIGHT, 7)).toBe(true);
    expect(isTrapFor(SEVEN_PLUS_EIGHT, 8)).toBe(true);
  });

  it('counts a near miss', () => {
    expect(isTrapFor(SEVEN_PLUS_EIGHT, 14)).toBe(true);
    expect(isTrapFor(SEVEN_PLUS_EIGHT, 13)).toBe(true);
  });

  it('never counts the answer itself, or a number nowhere near it', () => {
    expect(isTrapFor(SEVEN_PLUS_EIGHT, 15)).toBe(false);
    expect(isTrapFor(SEVEN_PLUS_EIGHT, 2)).toBe(false);
  });
});

describe('trapNumber', () => {
  it('reaches for an operand first', () => {
    const rng = createRng(6);
    for (let i = 0; i < 40; i += 1) expect([7, 8]).toContain(trapNumber(rng, SEVEN_PLUS_EIGHT, OVER_TEN));
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
