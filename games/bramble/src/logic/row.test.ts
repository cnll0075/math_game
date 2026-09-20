import { describe, it, expect } from 'vitest';
import { createRng } from '@bundle/core';
import { answerSet, BANDS, isTrapFor } from '@bundle/math';
import { LANES } from './lanes.js';
import { buildRow, remaining } from './row.js';

describe('building a row', () => {
  it('always puts the answer in exactly one lane', () => {
    const rng = createRng(11);
    for (const band of BANDS) {
      for (let i = 0; i < 400; i += 1) {
        const row = buildRow(rng, band, `r${i}`, 5);
        const answering = row.numbers.filter((number) => number === row.sum.answer);
        expect(answering, `${row.numbers.join(',')} for ${row.sum.answer}`).toHaveLength(1);
        expect(row.numbers[row.answerLane]).toBe(row.sum.answer);
      }
    }
  });

  it('fills every lane, so there is never a safe one', () => {
    const rng = createRng(12);
    for (let i = 0; i < 200; i += 1) {
      const row = buildRow(rng, BANDS[1]!, `r${i}`, 5);
      expect(row.numbers).toHaveLength(LANES);
      expect(row.kinds).toHaveLength(LANES);
      for (const number of row.numbers) expect(Number.isInteger(number)).toBe(true);
    }
  });

  it('makes both wrong lanes plausible, so elimination does not work', () => {
    const rng = createRng(13);
    for (const band of BANDS) {
      for (let i = 0; i < 400; i += 1) {
        const row = buildRow(rng, band, `r${i}`, 5);
        row.numbers.forEach((number, lane) => {
          if (lane === row.answerLane) return;
          expect(isTrapFor(row.sum, number), `${number} against ${row.sum.answer} in ${band.id}`).toBe(true);
        });
      }
    }
  });

  it('never wears a number the band would not allow', () => {
    const rng = createRng(14);
    for (const band of BANDS) {
      const allowed = answerSet(band);
      for (let i = 0; i < 300; i += 1) {
        for (const number of buildRow(rng, band, 'r', 5).numbers) expect(allowed).toContain(number);
      }
    }
  });

  it('never repeats a number inside one row', () => {
    const rng = createRng(15);
    for (let i = 0; i < 400; i += 1) {
      const row = buildRow(rng, BANDS[2]!, `r${i}`, 5);
      expect(new Set(row.numbers).size).toBe(LANES);
    }
  });

  it('starts at the horizon, unresolved, and counts down its approach', () => {
    const row = buildRow(createRng(16), BANDS[0]!, 'r', 5);
    expect(row.progress).toBe(0);
    expect(row.resolved).toBe(false);
    expect(remaining(row)).toBeCloseTo(5, 5);
    row.progress = 0.5;
    expect(remaining(row)).toBeCloseTo(2.5, 5);
  });
});
