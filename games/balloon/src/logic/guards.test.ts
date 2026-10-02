import { describe, it, expect } from 'vitest';
import { createRng } from '@bundle/core';
import { CHAPTERS, RESCUES } from './levels.data.js';
import { createRescue, liftOf, type Rescue } from './rescue.js';
import { targetOf, type RescueDef } from './rescue-def.js';
import { solve } from './solver.js';
import { starsFor } from './stars.js';

const biggestFirst = (values: readonly number[]) =>
  values.map((value, index) => ({ value, index })).sort((a, b) => b.value - a.value);

const exactOnLetGo = (rescue: Rescue): boolean => {
  const [event] = rescue.letGo();
  return event?.type === 'released' && event.outcome.verdict === 'exact';
};

/** Grabs the biggest balloons until there is enough, reading nothing but size. */
const sizeOnlyFirstTry = (def: RescueDef): boolean => {
  const rescue = createRescue(def);
  for (const { index } of biggestFirst(def.tray)) {
    if (liftOf(rescue.state) >= targetOf(def)) break;
    if (rescue.clip(index).some((event) => event.type === 'full')) break;
  }
  return exactOnLetGo(rescue);
};

/** Clips and pops at random and lets go, over and over. */
const randomStars = (def: RescueDef, seed: number): number => {
  const rng = createRng(seed);
  const rescue = createRescue(def);
  for (let attempt = 0; attempt < 60 && !rescue.state.rescued; attempt += 1) {
    while (rescue.state.clipped.length > 0) rescue.unclip(0);
    rescue.state.tied.forEach((balloon, index) => {
      if (balloon.popped) rescue.togglePop(index);
      if (rng.next() < 0.5) rescue.togglePop(index);
    });
    def.tray.forEach((_, index) => {
      if (rng.next() < 0.5) rescue.clip(index);
    });
    if (rescue.state.clipped.length + rescue.state.tied.length === 0) rescue.clip(0);
    rescue.letGo();
  }
  return starsFor(rescue.state.tries);
};

describe('the arithmetic is load-bearing', () => {
  it('a bot that grabs the biggest balloons is rarely right first time after the first chapter', () => {
    const later = CHAPTERS.slice(1).flatMap((each) => each.rescues);
    const hits = later.filter(sizeOnlyFirstTry).length;
    expect(hits / later.length).toBeLessThan(0.25);
  });

  it('a bot that picks at random averages under two stars', () => {
    let stars = 0;
    let played = 0;
    for (let seed = 1; seed <= 20; seed += 1) {
      for (const def of RESCUES) {
        stars += randomStars(def, seed * 1000 + played);
        played += 1;
      }
    }
    expect(stars / played).toBeLessThan(2);
  });

  it('a bot that works the sum out gets three stars on every rescue', () => {
    for (const def of RESCUES) {
      const answer = solve(def)[0]!;
      const rescue = createRescue(def);
      answer.pop.forEach((index) => rescue.togglePop(index));
      answer.clip.forEach((index) => rescue.clip(index));
      expect(exactOnLetGo(rescue), def.id).toBe(true);
      expect(starsFor(rescue.state.tries)).toBe(3);
    }
  });
});
