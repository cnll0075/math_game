import { describe, it, expect } from 'vitest';
import { answerSet, bandAt, bandById, BANDS } from './bands.data.js';

describe('bands', () => {
  it('opens on easy sums and hands over on time', () => {
    expect(bandAt(0).id).toBe('easy');
    expect(bandAt(44).id).toBe('easy');
    expect(bandAt(45).id).toBe('over-ten');
    expect(bandAt(119).id).toBe('over-ten');
    expect(bandAt(120).id).toBe('take-aways');
    expect(bandAt(9999).id).toBe('take-aways');
  });

  it('is titled for a six-year-old', () => {
    expect(BANDS.map((band) => band.title)).toEqual(['Easy Sums', 'Over Ten', 'Take-Aways']);
  });

  it('finds a band by id, for ?game=sky&level=take-aways', () => {
    expect(bandById('take-aways')?.from).toBe(120);
    expect(bandById('nonsense')).toBeUndefined();
  });

  it('never allows a number outside 1..20 into the sky', () => {
    for (const band of BANDS) {
      for (const number of answerSet(band)) {
        expect(number).toBeGreaterThanOrEqual(1);
        expect(number).toBeLessThanOrEqual(20);
      }
    }
  });

  it('keeps the opening band inside ten', () => {
    expect(answerSet(BANDS[0]!)).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('lets easy sums keep flying once the numbers get big', () => {
    const overTen = answerSet(BANDS[1]!);
    expect(overTen).toContain(4);
    expect(overTen).toContain(20);
  });
});
