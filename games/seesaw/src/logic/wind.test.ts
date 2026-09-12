import { describe, it, expect } from 'vitest';
import { createWind, type WindSettings } from './wind.js';

const settings: WindSettings = {
  seed: 3,
  calmSeconds: [4, 6],
  warningSeconds: 1.5,
  gustSeconds: [3, 5],
  strength: [1, 2],
};

const advance = (wind: ReturnType<typeof createWind>, seconds: number) => {
  const phases: string[] = [];
  for (let t = 0; t < seconds; t += 1 / 60) {
    const changed = wind.tick(1 / 60);
    if (changed) phases.push(changed);
  }
  return phases;
};

describe('createWind', () => {
  it('starts calm, with no push', () => {
    const wind = createWind(settings);
    expect(wind.state.phase).toBe('calm');
    expect(wind.bias).toBe(0);
  });

  it('warns before it blows', () => {
    const wind = createWind(settings);
    const phases = advance(wind, 12);
    expect(phases[0]).toBe('warning');
    expect(phases[1]).toBe('blowing');
  });

  it('pushes nothing while it is only warning', () => {
    const wind = createWind(settings);
    advance(wind, 4.1);
    // Somewhere in the warning now, or still calm; either way, no push yet.
    if (wind.state.phase === 'warning') expect(wind.bias).toBe(0);
  });

  it('pushes a whole number of weight units while blowing', () => {
    const wind = createWind(settings);
    for (let t = 0; t < 60; t += 1 / 60) {
      wind.tick(1 / 60);
      if (wind.state.phase === 'blowing') {
        expect(Number.isInteger(wind.bias)).toBe(true);
        expect(Math.abs(wind.bias)).toBeGreaterThanOrEqual(1);
        expect(Math.abs(wind.bias)).toBeLessThanOrEqual(2);
      } else {
        expect(wind.bias).toBe(0);
      }
    }
  });

  it('drops back to calm after a gust', () => {
    const wind = createWind(settings);
    const phases = advance(wind, 20);
    expect(phases).toContain('calm');
  });

  it('blows both ways over a long spell', () => {
    const wind = createWind(settings);
    const sides = new Set<string>();
    for (let t = 0; t < 400; t += 1 / 60) {
      wind.tick(1 / 60);
      if (wind.state.phase === 'blowing') sides.add(wind.state.side);
    }
    expect(sides.size).toBe(2);
  });

  it('replays exactly for a seed', () => {
    const a = createWind(settings);
    const b = createWind(settings);
    for (let t = 0; t < 60; t += 1 / 60) {
      a.tick(1 / 60);
      b.tick(1 / 60);
      expect(a.bias).toBe(b.bias);
    }
  });

  it('reports how far through a phase it is, for the scenery to lean on', () => {
    const wind = createWind(settings);
    advance(wind, 4.5);
    expect(wind.state.through).toBeGreaterThanOrEqual(0);
    expect(wind.state.through).toBeLessThanOrEqual(1);
  });
});
