import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { CHAPTERS, RESCUES, chapterOf, numberInChapter } from './levels.data.js';
import { DEFAULT_HOOKS, hooksOf, layerOf, LAYERS, problemsWith, targetOf, tiedOf, type RescueDef } from './rescue-def.js';
import { needsPop, solve, subsetsOf, totalAt } from './solver.js';

const chapter = (id: string) => {
  const found = CHAPTERS.find((each) => each.id === id);
  if (!found) throw new Error(`no chapter ${id}`);
  return found;
};
const indexOfChapter = (id: string) => CHAPTERS.findIndex((each) => each.id === id);
const pairs = (tray: readonly number[]) => subsetsOf(tray.length).filter((set) => set.length === 2);

describe('the chapters', () => {
  it('are the eight the spec names, in order', () => {
    expect(CHAPTERS.map((each) => each.title)).toEqual([
      'First Flight',
      'Whoosh!',
      'Big Bunches',
      'Heavy Cargo',
      'Tiny Harness',
      'Pop!',
      'Windy Ridge',
      'The Big Rescue',
    ]);
  });

  it('hold four or five rescues each, with unique ids', () => {
    for (const each of CHAPTERS) expect(each.rescues.length).toBeGreaterThanOrEqual(4);
    for (const each of CHAPTERS) expect(each.rescues.length).toBeLessThanOrEqual(5);
    expect(new Set(RESCUES.map((rescue) => rescue.id)).size).toBe(RESCUES.length);
  });

  it('know which chapter and place each rescue belongs to', () => {
    const popOne = RESCUES.find((rescue) => rescue.id === 'pop-1')!;
    expect(chapterOf(popOne).title).toBe('Pop!');
    expect(numberInChapter(popOne)).toBe(1);
  });
});

describe('every rescue', () => {
  it('has sound numbers', () => {
    for (const rescue of RESCUES) expect(problemsWith(rescue), rescue.id).toEqual([]);
  });

  it('has at least one exact answer within its hooks', () => {
    for (const rescue of RESCUES) expect(solve(rescue).length, rescue.id).toBeGreaterThan(0);
  });

  it('asks for a target in its chapter\'s range', () => {
    for (const each of CHAPTERS) {
      for (const rescue of each.rescues) {
        expect(targetOf(rescue), rescue.id).toBeGreaterThanOrEqual(each.targets[0]);
        expect(targetOf(rescue), rescue.id).toBeLessThanOrEqual(each.targets[1]);
      }
    }
  });

  it('can be answered by one matching balloon only in the very first rescue', () => {
    const matches = (rescue: RescueDef) => tiedOf(rescue).length === 0 && rescue.tray.includes(targetOf(rescue));
    expect(matches(RESCUES[0]!)).toBe(true);
    for (const rescue of RESCUES.slice(1)) expect(matches(rescue), rescue.id).toBe(false);
  });
});

describe('what each chapter is for', () => {
  it('Whoosh! always offers a pair that overshoots by one to three', () => {
    for (const rescue of chapter('whoosh').rescues) {
      const bait = pairs(rescue.tray).some((pair) => {
        const over = totalAt(rescue.tray, pair) - rescue.weight;
        return over >= 1 && over <= 3;
      });
      expect(bait, rescue.id).toBe(true);
    }
  });

  it('Big Bunches can never be answered with one or two balloons', () => {
    for (const rescue of chapter('big-bunches').rescues) {
      expect(solve(rescue).every((answer) => answer.clip.length >= 3), rescue.id).toBe(true);
    }
  });

  it('Heavy Cargo always goes past ten', () => {
    for (const rescue of chapter('heavy-cargo').rescues) expect(rescue.weight, rescue.id).toBeGreaterThan(10);
  });

  it('Tiny Harness offers a right bunch that needs too many hooks, and one that fits', () => {
    for (const rescue of chapter('tiny-harness').rescues) {
      expect(hooksOf(rescue), rescue.id).toBeLessThan(DEFAULT_HOOKS);
      const tooBig = subsetsOf(rescue.tray.length).some(
        (set) => set.length > hooksOf(rescue) && totalAt(rescue.tray, set) === rescue.weight,
      );
      expect(tooBig, rescue.id).toBe(true);
    }
  });

  it('nothing before Pop! needs a pop, and nothing before it is tied', () => {
    for (const rescue of CHAPTERS.slice(0, indexOfChapter('pop')).flatMap((each) => each.rescues)) {
      expect(tiedOf(rescue), rescue.id).toEqual([]);
      expect(needsPop(rescue), rescue.id).toBe(false);
    }
  });

  it('every rescue in Pop! needs a pop, and the first has nothing in the tray', () => {
    for (const rescue of chapter('pop').rescues) expect(needsPop(rescue), rescue.id).toBe(true);
    expect(chapter('pop').rescues[0]!.tray).toEqual([]);
  });

  it('Windy Ridge is all wind layers, and uses every one of them', () => {
    const rescues = chapter('windy-ridge').rescues;
    for (const rescue of rescues) expect(layerOf(rescue), rescue.id).toBeGreaterThan(0);
    const used = new Set(rescues.map(layerOf));
    for (let layer = 1; layer <= LAYERS; layer += 1) expect(used.has(layer), `layer ${layer}`).toBe(true);
  });

  it('Windy Ridge always offers the bunch that makes exactly the weight — the old habit, as bait', () => {
    for (const rescue of chapter('windy-ridge').rescues) {
      const tied = totalAt(tiedOf(rescue), tiedOf(rescue).map((_, index) => index));
      const bait = subsetsOf(rescue.tray.length).some((set) => tied + totalAt(rescue.tray, set) === rescue.weight);
      expect(bait, rescue.id).toBe(true);
    }
  });

  it('Windy Ridge opens with the kit already floating, so the climb is the only new thing', () => {
    const first = chapter('windy-ridge').rescues[0]!;
    expect(totalAt(tiedOf(first), tiedOf(first).map((_, index) => index))).toBe(first.weight);
  });

  it('every rescue in The Big Rescue needs two ideas at once', () => {
    for (const rescue of chapter('big-rescue').rescues) {
      const ideas = [rescue.weight > 10, hooksOf(rescue) < DEFAULT_HOOKS, needsPop(rescue), layerOf(rescue) > 0];
      expect(ideas.filter(Boolean).length, rescue.id).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('the words', () => {
  it('never repeat Seesaw Park\'s chapter titles or questions', () => {
    const seesaw = ['level.ts', 'levels.data.ts']
      .map((file) => readFileSync(new URL(`../../../seesaw/src/logic/${file}`, import.meta.url), 'utf8'))
      .join('\n')
      .toLowerCase();
    const ours = [...CHAPTERS.map((each) => each.title), ...RESCUES.map((rescue) => rescue.line)];
    for (const words of ours) expect(seesaw.includes(`'${words.toLowerCase()}'`), words).toBe(false);
  });

  it('give every rescue its own line', () => {
    expect(new Set(RESCUES.map((rescue) => rescue.line)).size).toBe(RESCUES.length);
  });
});
