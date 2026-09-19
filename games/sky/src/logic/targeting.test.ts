import { describe, it, expect } from 'vitest';
import { createRng } from '@bundle/core';
import { chooseTarget, eligible } from './targeting.js';
import { remaining, type Plane } from './sky-state.js';

const at = (uid: string, progress: number, fallSeconds = 10): Plane => ({
  uid,
  number: 15,
  type: 'glider',
  progress,
  fallSeconds,
  lane: 0.5,
  phase: 0,
  age: 0,
  hits: 0,
  hidden: false,
  hideTimer: 0,
});

describe('eligible', () => {
  it('passes over a plane with less than the thinking time left', () => {
    const aloft = [at('high', 0.1), at('low', 0.8)];
    expect(eligible(aloft, 5).map((plane) => plane.uid)).toEqual(['high']);
    expect(remaining(aloft[1]!)).toBeLessThan(5);
  });

  it('counts a freshly spawned plane as fair, whatever the tempo', () => {
    expect(eligible([at('new', 0, 5.5)], 3)).toHaveLength(1);
  });
});

describe('chooseTarget', () => {
  it('gives up when nothing aloft has time left', () => {
    expect(chooseTarget(createRng(1), [at('low', 0.95)], 3)).toBeNull();
    expect(chooseTarget(createRng(1), [], 3)).toBeNull();
  });

  it('always chooses a plane that still has its full fair window', () => {
    const aloft = [at('a', 0.1), at('b', 0.3), at('c', 0.45), at('d', 0.9)];
    const rng = createRng(21);
    for (let i = 0; i < 300; i += 1) {
      const chosen = chooseTarget(rng, aloft, 5)!;
      expect(remaining(chosen)).toBeGreaterThanOrEqual(5);
      expect(chosen.uid).not.toBe('d');
    }
  });

  it('leans on the most urgent plane without ever being predictable', () => {
    const aloft = [at('a', 0.05), at('b', 0.25), at('c', 0.45)];
    const rng = createRng(33);
    const counts = new Map<string, number>();
    for (let i = 0; i < 900; i += 1) {
      const uid = chooseTarget(rng, aloft, 5)!.uid;
      counts.set(uid, (counts.get(uid) ?? 0) + 1);
    }
    // The lowest fair plane is likeliest, so the pressure is real...
    expect(counts.get('c')!).toBeGreaterThan(counts.get('b')!);
    expect(counts.get('b')!).toBeGreaterThan(counts.get('a')!);
    // ...but every plane gets asked about, so position is never the answer.
    expect(counts.get('a')!).toBeGreaterThan(80);
  });
});
