import { describe, it, expect } from 'vitest';
import { tempoAt } from './tempo.js';

describe('tempoAt', () => {
  it('opens gently: a long fall, a thin sky, and time to think', () => {
    const tempo = tempoAt(0);
    expect(tempo.fallSeconds).toBeCloseTo(13, 5);
    expect(tempo.aloft).toBe(4);
    expect(tempo.thinkSeconds).toBeCloseTo(5.5, 5);
  });

  it('tightens to the design figures by three minutes', () => {
    const tempo = tempoAt(180);
    expect(tempo.fallSeconds).toBeCloseTo(5.5, 5);
    expect(tempo.aloft).toBe(7);
    expect(tempo.thinkSeconds).toBeCloseTo(3, 5);
  });

  it('never falls below the floor, however long the run', () => {
    expect(tempoAt(3600).fallSeconds).toBeGreaterThanOrEqual(5);
    expect(tempoAt(3600).thinkSeconds).toBeGreaterThanOrEqual(3);
  });

  it('only ever gets harder', () => {
    let previous = tempoAt(0);
    for (let t = 1; t <= 600; t += 1) {
      const next = tempoAt(t);
      expect(next.fallSeconds).toBeLessThanOrEqual(previous.fallSeconds + 1e-9);
      expect(next.thinkSeconds).toBeLessThanOrEqual(previous.thinkSeconds + 1e-9);
      previous = next;
    }
  });

  it('spawns often enough to keep the sky as full as it wants to be', () => {
    for (const t of [0, 45, 120, 180, 400]) {
      const tempo = tempoAt(t);
      expect(tempo.spawnEvery * tempo.aloft).toBeCloseTo(tempo.fallSeconds, 5);
    }
  });
});
