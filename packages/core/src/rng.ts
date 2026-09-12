/** A seeded pseudo-random source, so generated content can be replayed exactly. */
export interface Rng {
  next(): number;
  int(maxExclusive: number): number;
  pick<T>(items: readonly T[]): T;
}

/** mulberry32: small, fast, and good enough for gameplay variation. */
export function createRng(seed: number): Rng {
  let state = seed >>> 0;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    int: (maxExclusive) => Math.floor(next() * maxExclusive),
    pick: (items) => {
      const picked = items[Math.floor(next() * items.length)];
      if (picked === undefined) throw new Error('cannot pick from an empty list');
      return picked;
    },
  };
}
