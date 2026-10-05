import { describe, it, expect } from 'vitest';
import { additionsFor, subtractionsFor, sumText, valueOf } from './sums.js';

describe('sums', () => {
  it('writes a sum with a real minus sign', () => {
    expect(sumText({ a: 9, op: '−', b: 2, value: 7 })).toBe('9 − 2');
    expect(sumText({ a: 3, op: '+', b: 4, value: 7 })).toBe('3 + 4');
  });

  it('lists every addition for a value, every number at least 1', () => {
    expect(additionsFor(4, 10).map(sumText)).toEqual(['1 + 3', '2 + 2', '3 + 1']);
    expect(additionsFor(11, 10)).toEqual([]);
  });

  it('lists every subtraction for a value, the bigger number within the limit', () => {
    expect(subtractionsFor(7, 10).map(sumText)).toEqual(['8 − 1', '9 − 2', '10 − 3']);
    expect(subtractionsFor(10, 10)).toEqual([]);
  });

  it('works every sum out to its value', () => {
    for (const sum of [...additionsFor(9, 20), ...subtractionsFor(9, 20)]) expect(valueOf(sum)).toBe(9);
  });
});
