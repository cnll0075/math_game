export type Op = '+' | '−';

/** One card's sum. `value` is what it works out to. */
export interface Sum {
  a: number;
  op: Op;
  b: number;
  value: number;
}

export const sumText = (sum: Sum): string => `${sum.a} ${sum.op} ${sum.b}`;
export const valueOf = (sum: Sum): number => (sum.op === '+' ? sum.a + sum.b : sum.a - sum.b);

/** Every `a + b` that makes `value`, both numbers at least 1. */
export function additionsFor(value: number, limit: number): Sum[] {
  if (value > limit) return [];
  const sums: Sum[] = [];
  for (let a = 1; a < value; a += 1) sums.push({ a, op: '+', b: value - a, value });
  return sums;
}

/** Every `a − b` that makes `value`, with `b` at least 1 and `a` within the limit. */
export function subtractionsFor(value: number, limit: number): Sum[] {
  const sums: Sum[] = [];
  for (let a = value + 1; a <= limit; a += 1) sums.push({ a, op: '−', b: a - value, value });
  return sums;
}
