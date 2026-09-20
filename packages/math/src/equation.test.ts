import { describe, it, expect } from 'vitest';
import { createRng } from '@bundle/core';
import { BANDS, answerSet } from './bands.data.js';
import { additionsFor, drawAnswer, subtractionsFor, sumText, writeSum, CEILING } from './equation.js';

const EASY = BANDS[0]!;
const OVER_TEN = BANDS[1]!;
const TAKE_AWAYS = BANDS[2]!;

describe('sums for an answer', () => {
  it('lists every addition that makes it, with no zeroes', () => {
    expect(additionsFor(4)).toEqual([
      { left: 1, op: '+', right: 3, answer: 4 },
      { left: 2, op: '+', right: 2, answer: 4 },
      { left: 3, op: '+', right: 1, answer: 4 },
    ]);
  });

  it('lists every take-away that makes it, staying under the ceiling', () => {
    const sums = subtractionsFor(18);
    expect(sums).toEqual([
      { left: 19, op: '-', right: 1, answer: 18 },
      { left: 20, op: '-', right: 2, answer: 18 },
    ]);
    for (const sum of sums) expect(sum.left).toBeLessThanOrEqual(CEILING);
  });

  it('writes the minus sign as a minus sign, not a hyphen', () => {
    expect(sumText({ left: 15, op: '-', right: 8, answer: 7 })).toBe('15 − 8');
    expect(sumText({ left: 7, op: '+', right: 8, answer: 15 })).toBe('7 + 8');
  });
});

describe('writeSum', () => {
  it('always produces a sum whose answer is the number asked for', () => {
    const rng = createRng(7);
    for (const band of BANDS) {
      for (const answer of answerSet(band)) {
        const sum = writeSum(rng, band, answer, []);
        expect(sum, `no sum for ${answer} in ${band.id}`).not.toBeNull();
        const worked = sum!.op === '+' ? sum!.left + sum!.right : sum!.left - sum!.right;
        expect(worked).toBe(answer);
        expect(sum!.left).toBeLessThanOrEqual(CEILING);
        expect(sum!.right).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('only writes additions while take-aways have not arrived', () => {
    const rng = createRng(3);
    for (let i = 0; i < 200; i += 1) {
      expect(writeSum(rng, OVER_TEN, 14, [])!.op).toBe('+');
      expect(writeSum(rng, EASY, 9, [])!.op).toBe('+');
    }
  });

  it('writes both signs once take-aways arrive, so the sign must be read', () => {
    const rng = createRng(5);
    const ops = new Set<string>();
    for (let i = 0; i < 300; i += 1) ops.add(writeSum(rng, TAKE_AWAYS, 8, [])!.op);
    expect([...ops].sort()).toEqual(['+', '-']);
  });

  it('prefers operands already in the sky, so the sky baits its own trap', () => {
    const rng = createRng(11);
    const sky = [7, 3, 19];
    for (let i = 0; i < 50; i += 1) {
      const sum = writeSum(rng, OVER_TEN, 15, sky)!;
      // Any of them will do — what matters is that the question names a number
      // the player can see, so there is a wrong plane worth shooting.
      expect(sky.some((number) => number === sum.left || number === sum.right)).toBe(true);
    }
  });

  it('falls back to any sum when the sky offers no useful operand', () => {
    const sum = writeSum(createRng(2), OVER_TEN, 15, [20]);
    expect(sum!.left + sum!.right).toBe(15);
  });
});

describe('drawAnswer', () => {
  it('stays inside the band it was asked about', () => {
    const rng = createRng(13);
    for (const band of BANDS) {
      const allowed = answerSet(band);
      for (let i = 0; i < 500; i += 1) expect(allowed).toContain(drawAnswer(rng, band));
    }
  });

  it('keeps easy sums flying in the over-ten band, but mostly big ones', () => {
    const rng = createRng(17);
    const drawn = Array.from({ length: 1000 }, () => drawAnswer(rng, OVER_TEN));
    const easy = drawn.filter((n) => n <= 10).length;
    expect(easy).toBeGreaterThan(150);
    expect(easy).toBeLessThan(450);
  });
});
