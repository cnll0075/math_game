import { describe, it, expect } from 'vitest';
import { tempoAt } from './tempo.js';

describe('tempoAt', () => {
  it('opens with long gaps and plenty of time to read a row', () => {
    const tempo = tempoAt(0);
    expect(tempo.rowEvery).toBeCloseTo(3.5, 5);
    expect(tempo.approachSeconds).toBeGreaterThan(tempo.rowEvery);
  });

  it('tightens to the design figure by three minutes', () => {
    expect(tempoAt(180).rowEvery).toBeCloseTo(1.8, 5);
  });

  it('always keeps more than one row on the path, so the next can be read early', () => {
    for (const t of [0, 45, 120, 180, 600]) {
      const tempo = tempoAt(t);
      expect(tempo.approachSeconds).toBeGreaterThan(tempo.rowEvery);
    }
  });

  it('only ever gets harder, and never faster than its floor', () => {
    let previous = tempoAt(0);
    for (let t = 1; t <= 600; t += 1) {
      const next = tempoAt(t);
      expect(next.rowEvery).toBeLessThanOrEqual(previous.rowEvery + 1e-9);
      expect(next.rowEvery).toBeGreaterThanOrEqual(1.6);
      previous = next;
    }
  });

  it('thins the berries out as the run goes on', () => {
    expect(tempoAt(0).berryChance).toBeGreaterThan(tempoAt(180).berryChance);
    expect(tempoAt(600).berryChance).toBeGreaterThan(0);
  });
});
