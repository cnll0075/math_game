import { describe, it, expect } from 'vitest';
import { createRng } from '@bundle/core';
import { drawApproach, drawGap, ROOMY_GAP, tempoAt } from './tempo.js';

describe('tempoAt', () => {
  it('opens brisk but readable, not with a lull', () => {
    const tempo = tempoAt(0);
    expect(tempo.minGap).toBeCloseTo(2.4, 5);
    expect(tempo.approachSeconds).toBeGreaterThan(tempo.minGap);
  });

  it('is driven by bursts, not by the clock', () => {
    // Get good and the path answers back; sit there and it does not rush you.
    expect(tempoAt(40).minGap).toBeLessThan(tempoAt(10).minGap);
    expect(tempoAt(60).minGap).toBeLessThan(tempoAt(40).minGap);
  });

  it('never asks for less than a second and a half, however far a run goes', () => {
    // A six-year-old needs time to read a sum and pick a lane. This is the
    // promise the whole pacing is built to keep.
    for (const n of [0, 20, 60, 200, 2000]) {
      expect(tempoAt(n).minGap).toBeGreaterThanOrEqual(1.5);
    }
  });

  it('narrows the gaps as the pace climbs, so the speed-up can be felt', () => {
    // Without this a breather late in a run was longer than a tight gap at the
    // start: the ranges overlapped and no amount of ramping the average showed.
    const early = tempoAt(0);
    const late = tempoAt(60);
    const longest = (t: typeof early): number => t.minGap * (1 + (2.3 - 1) * t.gapSpread);
    expect(longest(late)).toBeLessThan(early.minGap);
    expect(late.gapSpread).toBeLessThan(early.gapSpread);
  });

  it('keeps the opening brisk: no gap at the start is a lull', () => {
    const early = tempoAt(0);
    const longestOpening = early.minGap * (1 + (2.3 - 1) * early.gapSpread) * 1.1;
    // Counted at four to five seconds once, which read as the game not having
    // started. Nothing at the start should be near that.
    expect(longestOpening).toBeLessThan(4);
  });

  it('keeps the speeds varied even as the gaps tighten', () => {
    // The gaps carry the rhythm; the speeds carry the variation you can see.
    for (const n of [0, 30, 60, 120]) {
      expect(tempoAt(n).speedSpread).toBeGreaterThan(0.5);
    }
  });

  it('only ever presses harder, and never below its floor', () => {
    let previous = tempoAt(0);
    for (let t = 1; t <= 300; t += 1) {
      const next = tempoAt(t);
      expect(next.minGap).toBeLessThanOrEqual(previous.minGap + 1e-9);
      expect(next.minGap).toBeGreaterThanOrEqual(1.1);
      expect(next.pressure).toBeGreaterThanOrEqual(previous.pressure - 1e-9);
      previous = next;
    }
  });

  it('thins the carrots out as the run goes on', () => {
    expect(tempoAt(0).berryChance).toBeGreaterThan(tempoAt(60).berryChance);
    expect(tempoAt(200).berryChance).toBeGreaterThan(0);
  });
});

describe('drawGap', () => {
  it('never asks for less than the floor', () => {
    const rng = createRng(5);
    for (const t of [0, 10, 30, 80]) {
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
    const tempo = tempoAt(8);
    const shapes = new Set(Array.from({ length: 400 }, () => drawGap(rng, tempo).shape));
    expect([...shapes].sort()).toEqual(['breather', 'steady', 'tight']);
  });

  it('phrases the gaps without letting any of them become a lull', () => {
    const rng = createRng(7);
    const tempo = tempoAt(5);
    const gaps = Array.from({ length: 300 }, () => drawGap(rng, tempo).seconds);
    const spread = Math.max(...gaps) / Math.min(...gaps);
    // Enough to be phrasing rather than a beat, but not so much that a breather
    // reads as the game having stopped. The variation a player *sees* is in the
    // speeds, not here.
    expect(spread).toBeGreaterThan(1.4);
    expect(spread).toBeLessThan(2.2);
  });

  it('spreads the speeds widely, which is the variation on screen', () => {
    const rng = createRng(9);
    const tempo = tempoAt(5);
    const speeds = Array.from({ length: 300 }, () => drawApproach(rng, tempo).seconds);
    expect(Math.max(...speeds) / Math.min(...speeds)).toBeGreaterThan(1.8);
  });

  it('crowds out the breathers as the run presses on', () => {
    const rng = createRng(8);
    const share = (elapsed: number): number => {
      const tempo = tempoAt(elapsed);
      const drawn = Array.from({ length: 600 }, () => drawGap(rng, tempo).shape);
      return drawn.filter((shape) => shape === 'tight').length / drawn.length;
    };
    const early = share(0);
    const late = share(80);
    expect(late).toBeGreaterThan(early + 0.25);
  });

  it('leaves room for a carrot only in a gap that has room', () => {
    expect(ROOMY_GAP).toBeGreaterThan(1);
  });
});
