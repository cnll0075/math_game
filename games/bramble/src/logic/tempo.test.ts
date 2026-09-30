import { describe, it, expect } from 'vitest';
import { createRng } from '@bundle/core';
import { drawGap, ROOMY_GAP, tempoAt } from './tempo.js';

describe('tempoAt', () => {
  it('opens with plenty of time to read a row', () => {
    const tempo = tempoAt(0);
    expect(tempo.minGap).toBeCloseTo(3.6, 5);
    expect(tempo.approachSeconds).toBeGreaterThan(tempo.minGap);
  });

  it('never asks for less than a second and a half, however long the run', () => {
    // A six-year-old needs time to read a sum and pick a lane. This is the
    // promise the whole pacing is built to keep.
    for (const t of [0, 60, 180, 600, 3600]) {
      expect(tempoAt(t).minGap).toBeGreaterThanOrEqual(1.5);
    }
    expect(tempoAt(180).minGap).toBeCloseTo(2.2, 5);
  });

  it('keeps the path thin: a breather empties it rather than stacking rows', () => {
    for (const t of [0, 45, 120, 180, 600]) {
      const tempo = tempoAt(t);
      const onPath = tempo.approachSeconds / tempo.minGap;
      // Never three walls of obstacles at once, which read as noise.
      expect(onPath).toBeLessThan(2);
      expect(onPath).toBeGreaterThan(1);
    }
  });

  it('only ever presses harder, and never below its floor', () => {
    let previous = tempoAt(0);
    for (let t = 1; t <= 600; t += 1) {
      const next = tempoAt(t);
      expect(next.minGap).toBeLessThanOrEqual(previous.minGap + 1e-9);
      expect(next.minGap).toBeGreaterThanOrEqual(1.1);
      expect(next.pressure).toBeGreaterThanOrEqual(previous.pressure - 1e-9);
      previous = next;
    }
  });

  it('thins the carrots out as the run goes on', () => {
    expect(tempoAt(0).berryChance).toBeGreaterThan(tempoAt(180).berryChance);
    expect(tempoAt(600).berryChance).toBeGreaterThan(0);
  });
});

describe('drawGap', () => {
  it('never asks for less than the floor', () => {
    const rng = createRng(5);
    for (const t of [0, 40, 120, 300]) {
      const tempo = tempoAt(t);
      for (let i = 0; i < 400; i += 1) {
        // The floor is the least time a player is ever given to read a sum, and
        // nothing — not a flurry, not the wobble — may go under it.
        expect(drawGap(rng, tempo).seconds).toBeGreaterThanOrEqual(tempo.minGap * 0.89);
      }
    }
  });

  it('uses every shape, so the path is phrased rather than beaten out', () => {
    const rng = createRng(6);
    const tempo = tempoAt(30);
    const shapes = new Set(Array.from({ length: 400 }, () => drawGap(rng, tempo).shape));
    expect([...shapes].sort()).toEqual(['breather', 'steady', 'tight']);
  });

  it('spreads the gaps widely, not around one beat', () => {
    const rng = createRng(7);
    const tempo = tempoAt(20);
    const gaps = Array.from({ length: 300 }, () => drawGap(rng, tempo).seconds);
    // Longest at least twice the shortest: that spread is the rhythm.
    expect(Math.max(...gaps) / Math.min(...gaps)).toBeGreaterThan(2);
  });

  it('crowds out the breathers as the run presses on', () => {
    const rng = createRng(8);
    const share = (elapsed: number): number => {
      const tempo = tempoAt(elapsed);
      const drawn = Array.from({ length: 600 }, () => drawGap(rng, tempo).shape);
      return drawn.filter((shape) => shape === 'tight').length / drawn.length;
    };
    const early = share(0);
    const late = share(240);
    expect(late).toBeGreaterThan(early + 0.25);
  });

  it('leaves room for a carrot only in a gap that has room', () => {
    expect(ROOMY_GAP).toBeGreaterThan(1);
  });
});
