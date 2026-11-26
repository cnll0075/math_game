import { describe, it, expect } from 'vitest';
import { arrivalGap, bandAt, bandById, BANDS, PACE, paceStep } from './tempo.js';

describe('the bands', () => {
  it('grow the targets and the crates by the minute', () => {
    expect(bandAt(0)).toMatchObject({ id: 'little', targets: [5, 10], crates: [1, 5] });
    expect(bandAt(59.9).id).toBe('little');
    expect(bandAt(60)).toMatchObject({ id: 'bigger', targets: [5, 15], crates: [1, 7] });
    expect(bandAt(120)).toMatchObject({ id: 'heavy', targets: [5, 20], crates: [1, 9] });
    expect(bandAt(900).id).toBe('heavy');
  });

  it('are found by id, for the URL', () => {
    expect(bandById('heavy')?.from).toBe(120);
    expect(bandById('nonsense')).toBeUndefined();
    expect(bandById(undefined)).toBeUndefined();
    expect(BANDS.map((band) => band.title)).toEqual(['Little Loads', 'Bigger Loads', 'Heavy Loads']);
  });
});

describe('the pace', () => {
  it('starts at a crate every two seconds and comes ten per cent faster every fifteen', () => {
    expect(arrivalGap(0)).toBe(2);
    expect(arrivalGap(14.9)).toBe(2);
    expect(arrivalGap(15)).toBeCloseTo(2 / 1.1);
    expect(arrivalGap(30)).toBeCloseTo(2 / 1.1 ** 2);
    expect(paceStep(44.9)).toBe(2);
  });

  it('levels off at three quarters of a second, about two and a half minutes in', () => {
    expect(arrivalGap(150)).toBeGreaterThan(PACE.floorGap);
    expect(arrivalGap(165)).toBe(PACE.floorGap);
    expect(arrivalGap(10_000)).toBe(0.75);
  });
});
