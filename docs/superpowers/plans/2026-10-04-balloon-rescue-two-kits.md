# Balloon Rescue: Start Over, Two at Once, and Lift During the Count — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the wind-layer chapter and replace it with Two at Once (two kits sharing one tray), add a ↺ start-over button, and make the kit rise in proportion to the running total during the count.

**Architecture:** A rescue gains an optional second kit (`friend`, its weight). Every per-kit quantity — lift, hooks, clipped balloons, outcome — takes a kit index, and `letGo` returns one outcome per kit. The driver tracks which kit a tapped balloon goes to; the view draws a kit, bunch and gauge per kit. Wind layers are deleted outright; the breeze over the ledge stays.

**Tech Stack:** TypeScript (strict, `noUncheckedIndexedAccess`), Vitest, canvas 2D. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-29-balloon-rescue-design.md` — the Two at Once, Controls and Feel sections, and "Revisions after the second playtest (2026-10-04)".

## Global Constraints

- **At most two kits.** Kit 0 is the left kit and the only one that can have tied balloons. The hook limit applies to each kit.
- **Two at Once trays add up to both weights**, plus at most one spare balloon, and only the last two rescues of the chapter carry a spare.
- **A rescue is rescued only when every kit is exact.** Each kit gets its own verdict, gauge and finished sum.
- **↺ Start over** re-inflates every popped balloon and returns every clipped one; tries are kept; it is dimmed and does nothing when there is nothing to undo.
- **No running total while building**, as before. The count after "Let go!" may lift the kit, by at most `COUNT_RISE` = 44 design pixels, in proportion to running total over weight.
- **The minus sign is `−` (U+2212).**
- `src/logic/` stays pure; `src/view/` reads state and never writes it.
- Run `npm test` and `npm run typecheck` before every commit. Both must be clean.

## Review Focus

1. **Tapping a kit in a one-kit rescue.** Nothing happens — no select, no clip. Pinned in Task 4 (geometry).
2. **Start over pressed during the flight, or after the rescue.** Ignored: the driver only acts while building, and a rescued rescue refuses. Pinned in Task 2 (rescue) and Task 3 (driver).
3. **Dragging a balloon off the second kit into the tray.** It comes off the second kit, not the first. Pinned in Task 5 (input).
4. **A two-kit rescue where one kit is exact and the other is not.** Each kit flies by its own verdict; building resumes only when the longest flight ends, with both kits home and a gauge over each (the exact one green, "Just right!"). Pinned in Task 3 (driver: `feedback` has both outcomes) and Task 4 (scene: a gauge per kit).
5. **Saved stars for the removed `windy-ridge-*` ids.** They stop counting toward the total (no rescue has those ids) without breaking the load. Already covered by `readBook` / `totalStars` tests.

---

### Task 1: Remove wind layers from the rules

**Files:**
- Replace: `games/balloon/src/logic/rescue-def.ts`, `games/balloon/src/logic/rescue-def.test.ts`, `games/balloon/src/logic/outcome.ts`, `games/balloon/src/logic/outcome.test.ts`

**Interfaces:**
- Produces from `rescue-def.ts`: `RescueDef.friend?: number`; `weightsOf(def): number[]`; `kitsOf(def): number`. Removes `LAYERS`, `layer`, `layerOf`, `targetOf`.
- Produces from `outcome.ts`: `interface Outcome { verdict: Verdict; have: number; need: number }`; `judge(lift, weight): Outcome`.

The rest of the package does not compile again until Task 3; run only these two test files in this task.

- [ ] **Step 1: Write the tests**

```ts
// games/balloon/src/logic/rescue-def.test.ts
import { describe, it, expect } from 'vitest';
import { hooksOf, kitsOf, problemsWith, tiedOf, weightsOf, type RescueDef } from './rescue-def.js';

const plain: RescueDef = { id: 'x', line: 'x', weight: 8, tray: [5, 3] };

describe('a rescue definition', () => {
  it('has six hooks and nothing tied unless it says otherwise', () => {
    expect(hooksOf(plain)).toBe(6);
    expect(tiedOf(plain)).toEqual([]);
    expect(hooksOf({ ...plain, hooks: 2 })).toBe(2);
  });

  it('has one kit, or two when a friend shares the tray', () => {
    expect(weightsOf(plain)).toEqual([8]);
    expect(kitsOf(plain)).toBe(1);
    expect(weightsOf({ ...plain, friend: 5 })).toEqual([8, 5]);
    expect(kitsOf({ ...plain, friend: 5 })).toBe(2);
  });

  it('finds nothing wrong with a sound rescue', () => {
    expect(problemsWith(plain)).toEqual([]);
    expect(problemsWith({ ...plain, friend: 5 })).toEqual([]);
  });

  it('rejects numbers outside the ranges the game draws', () => {
    expect(problemsWith({ ...plain, weight: 21 })).not.toEqual([]);
    expect(problemsWith({ ...plain, friend: 0 })).not.toEqual([]);
    expect(problemsWith({ ...plain, friend: 21 })).not.toEqual([]);
    expect(problemsWith({ ...plain, tray: [11] })).not.toEqual([]);
    expect(problemsWith({ ...plain, tray: [0] })).not.toEqual([]);
    expect(problemsWith({ ...plain, hooks: 7 })).not.toEqual([]);
  });

  it('rejects more tied balloons than hooks', () => {
    expect(problemsWith({ ...plain, hooks: 2, tied: [1, 1, 1] })).not.toEqual([]);
  });
});
```

```ts
// games/balloon/src/logic/outcome.test.ts
import { describe, it, expect } from 'vitest';
import { feedbackLine, gaugeText, judge, verdictOf } from './outcome.js';

describe('letting go', () => {
  it('is short, exact or over by the sign of the difference', () => {
    expect(verdictOf(6, 8)).toBe('short');
    expect(verdictOf(8, 8)).toBe('exact');
    expect(verdictOf(11, 8)).toBe('over');
  });

  it('weighs the lift against the weight', () => {
    expect(judge(6, 8)).toEqual({ verdict: 'short', have: 6, need: 8 });
    expect(judge(8, 8)).toEqual({ verdict: 'exact', have: 8, need: 8 });
  });

  it('says how far off it was, in the words the child reads', () => {
    expect(feedbackLine(judge(6, 8))).toBe('2 more!');
    expect(feedbackLine(judge(11, 8))).toBe('3 too many!');
    expect(feedbackLine(judge(8, 8))).toBe('Just right!');
  });

  it('writes the gauge as what you had over what you needed', () => {
    expect(gaugeText(judge(6, 8))).toBe('6 / 8');
  });
});
```

- [ ] **Step 2: Run to see them fail**

Run: `npx vitest run games/balloon/src/logic/rescue-def.test.ts games/balloon/src/logic/outcome.test.ts`
Expected: FAIL — `weightsOf`/`kitsOf` do not exist, and outcomes still carry `weight` and `layer`.

- [ ] **Step 3: Implement**

```ts
// games/balloon/src/logic/rescue-def.ts
export const BALLOON_MIN = 1;
export const BALLOON_MAX = 10;
export const WEIGHT_MAX = 20;
export const DEFAULT_HOOKS = 6;

/** One rescue is one question. */
export interface RescueDef {
  id: string;
  /** What is happening, told as a story rather than as the mechanic. */
  line: string;
  weight: number;
  /** Balloons waiting to be clipped on. The tray is the level design. */
  tray: readonly number[];
  /** Balloons already on the left kit's harness when the rescue opens. Tapping one pops it. */
  tied?: readonly number[];
  /** The hook limit, for each kit. */
  hooks?: number;
  /** Two at Once: a second kit, of this weight, sharing the tray. */
  friend?: number;
}

export interface ChapterDef {
  id: string;
  title: string;
  /** The weights this chapter's kits may have. */
  targets: readonly [number, number];
  rescues: readonly RescueDef[];
}

export const hooksOf = (def: RescueDef): number => def.hooks ?? DEFAULT_HOOKS;
export const tiedOf = (def: RescueDef): readonly number[] => def.tied ?? [];
/** Every kit's weight, left to right. */
export const weightsOf = (def: RescueDef): number[] => (def.friend === undefined ? [def.weight] : [def.weight, def.friend]);
export const kitsOf = (def: RescueDef): number => weightsOf(def).length;

const whole = (value: number, low: number, high: number): boolean =>
  Number.isInteger(value) && value >= low && value <= high;

/** Everything wrong with a rescue's numbers; empty when it is sound. */
export function problemsWith(def: RescueDef): string[] {
  const problems: string[] = [];
  for (const weight of weightsOf(def)) {
    if (!whole(weight, 1, WEIGHT_MAX)) problems.push(`weight ${weight}`);
  }
  for (const value of [...def.tray, ...tiedOf(def)]) {
    if (!whole(value, BALLOON_MIN, BALLOON_MAX)) problems.push(`balloon ${value}`);
  }
  if (!whole(hooksOf(def), 1, DEFAULT_HOOKS)) problems.push(`hooks ${hooksOf(def)}`);
  if (tiedOf(def).length > hooksOf(def)) problems.push('more tied balloons than hooks');
  return problems;
}
```

```ts
// games/balloon/src/logic/outcome.ts
export type Verdict = 'short' | 'exact' | 'over';

/** What letting go did for one kit. */
export interface Outcome {
  verdict: Verdict;
  have: number;
  need: number;
}

export const verdictOf = (have: number, need: number): Verdict =>
  have < need ? 'short' : have > need ? 'over' : 'exact';

export const judge = (lift: number, weight: number): Outcome => ({ verdict: verdictOf(lift, weight), have: lift, need: weight });

/** The gap in words: the teaching half of a wrong try. */
export function feedbackLine(outcome: Outcome): string {
  if (outcome.verdict === 'exact') return 'Just right!';
  const gap = Math.abs(outcome.need - outcome.have);
  return outcome.verdict === 'short' ? `${gap} more!` : `${gap} too many!`;
}

export const gaugeText = (outcome: Outcome): string => `${outcome.have} / ${outcome.need}`;
```

- [ ] **Step 4: Run to see them pass**

Run: `npx vitest run games/balloon/src/logic/rescue-def.test.ts games/balloon/src/logic/outcome.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add games/balloon/src/logic/rescue-def.ts games/balloon/src/logic/rescue-def.test.ts games/balloon/src/logic/outcome.ts games/balloon/src/logic/outcome.test.ts
git commit -m "feat(balloon): a rescue can have a second kit; wind layers are gone"
```

---

### Task 2: Two kits, start over, and the chapter

**Files:**
- Replace: `games/balloon/src/logic/rescue.ts`, `rescue.test.ts`, `solver.ts`, `solver.test.ts`, `levels.test.ts`, `guards.test.ts` (all in `games/balloon/src/logic/`)
- Modify: `games/balloon/src/logic/levels.data.ts`

**Interfaces:**
- Consumes: Task 1.
- Produces from `rescue.ts`: `Taken { value; from; kit }`; `RescueEvent` with `{ type: 'clipped'; value; kit }`, `{ type: 'reset' }` and `{ type: 'released'; outcomes: Outcome[]; tries }`; `Rescue.clip(trayIndex, kit = 0)`, `Rescue.unclip(kit, slot)`, `Rescue.startOver()`; `clippedOn(state, kit)`, `liftedValues(state, kit = 0)`, `liftedSlots(state, kit = 0)`, `liftOf(state, kit = 0)`, `hooksUsed(state, kit = 0)`, `trayTaken`, `canLetGo`, `canStartOver`, `outcomesOf`, `answerLines`.
- Produces from `solver.ts`: `Answer { clip: number[]; friend: number[]; pop: number[] }` (tray indices for each kit, tied indices to pop).
- Produces from `levels.data.ts`: chapter `two-at-once`, "Two at Once", replacing `windy-ridge`.

- [ ] **Step 1: Write the tests**

```ts
// games/balloon/src/logic/rescue.test.ts
import { describe, it, expect } from 'vitest';
import {
  answerLines,
  canLetGo,
  canStartOver,
  clippedOn,
  createRescue,
  hooksUsed,
  liftedSlots,
  liftOf,
  trayTaken,
} from './rescue.js';
import type { RescueDef } from './rescue-def.js';

const eight: RescueDef = { id: 'eight', line: '', weight: 8, tray: [5, 3, 6, 2] };
const pair: RescueDef = { id: 'pair', line: '', weight: 4, friend: 5, tray: [3, 1, 2, 3] };

describe('a rescue', () => {
  it('clips a tray balloon to the left kit and adds its lift', () => {
    const rescue = createRescue(eight);
    expect(rescue.clip(0)).toEqual([{ type: 'clipped', value: 5, kit: 0 }]);
    expect(liftOf(rescue.state)).toBe(5);
    expect(trayTaken(rescue.state, 0)).toBe(true);
  });

  it('will not clip the same tray balloon twice', () => {
    const rescue = createRescue(eight);
    rescue.clip(0);
    expect(rescue.clip(0)).toEqual([]);
    expect(liftOf(rescue.state)).toBe(5);
  });

  it('sends a clipped balloon back to its own place in the tray', () => {
    const rescue = createRescue(eight);
    rescue.clip(2);
    rescue.clip(0);
    expect(rescue.unclip(0, 0)).toEqual([{ type: 'unclipped', value: 6 }]);
    expect(trayTaken(rescue.state, 2)).toBe(false);
    expect(clippedOn(rescue.state, 0)).toEqual([{ value: 5, from: 0, kit: 0 }]);
  });

  it('ignores slots, tray places and kits that do not exist', () => {
    const rescue = createRescue(eight);
    expect(rescue.clip(9)).toEqual([]);
    expect(rescue.clip(-1)).toEqual([]);
    expect(rescue.clip(0, 1)).toEqual([]);
    expect(rescue.unclip(0, 0)).toEqual([]);
    expect(rescue.unclip(0, -1)).toEqual([]);
    expect(rescue.togglePop(0)).toEqual([]);
  });

  it('refuses a clip once every hook is used', () => {
    const rescue = createRescue({ ...eight, hooks: 2 });
    rescue.clip(0);
    rescue.clip(1);
    expect(rescue.clip(2)).toEqual([{ type: 'full' }]);
    expect(hooksUsed(rescue.state)).toBe(2);
  });

  it('counts tied balloons against the hooks, popped or not', () => {
    const rescue = createRescue({ id: 't', line: '', weight: 7, tray: [2], tied: [6, 3], hooks: 2 });
    rescue.togglePop(1);
    expect(rescue.clip(0)).toEqual([{ type: 'full' }]);
  });

  it('pops a tied balloon, and puts it back on a second tap', () => {
    const rescue = createRescue({ id: 't', line: '', weight: 7, tray: [], tied: [6, 3, 1] });
    expect(liftOf(rescue.state)).toBe(10);
    expect(rescue.togglePop(1)).toEqual([{ type: 'popped', index: 1, value: 3 }]);
    expect(liftOf(rescue.state)).toBe(7);
    expect(rescue.togglePop(1)).toEqual([{ type: 'reinflated', index: 1, value: 3 }]);
  });

  it('does nothing on "Let go!" with nothing on any harness', () => {
    const rescue = createRescue(eight);
    expect(canLetGo(rescue.state)).toBe(false);
    expect(rescue.letGo()).toEqual([]);
    expect(rescue.state.tries).toBe(0);
  });

  it('counts a wrong try and leaves the bunch exactly as it was', () => {
    const rescue = createRescue(eight);
    rescue.clip(0);
    rescue.clip(2);
    expect(rescue.letGo()).toEqual([{ type: 'released', outcomes: [{ verdict: 'over', have: 11, need: 8 }], tries: 1 }]);
    expect(clippedOn(rescue.state, 0)).toEqual([
      { value: 5, from: 0, kit: 0 },
      { value: 6, from: 2, kit: 0 },
    ]);
    expect(rescue.state.rescued).toBe(false);
  });

  it('is rescued by an exact lift, and then will not change', () => {
    const rescue = createRescue(eight);
    rescue.clip(0);
    rescue.clip(1);
    rescue.letGo();
    expect(rescue.state.rescued).toBe(true);
    expect(rescue.clip(3)).toEqual([]);
    expect(rescue.unclip(0, 0)).toEqual([]);
    expect(rescue.startOver()).toEqual([]);
    expect(rescue.letGo()).toEqual([]);
  });

  it('knows which bunch slots are still lifting', () => {
    const rescue = createRescue({ id: 't', line: '', weight: 7, tray: [2], tied: [6, 3, 1] });
    rescue.togglePop(1);
    rescue.clip(0);
    expect(liftedSlots(rescue.state)).toEqual([0, 2, 3]);
  });
});

describe('two kits', () => {
  it('clips to either kit, and keeps their lifts apart', () => {
    const rescue = createRescue(pair);
    rescue.clip(0, 0);
    expect(rescue.clip(2, 1)).toEqual([{ type: 'clipped', value: 2, kit: 1 }]);
    rescue.clip(3, 1);
    expect(liftOf(rescue.state, 0)).toBe(3);
    expect(liftOf(rescue.state, 1)).toBe(5);
    expect(liftedSlots(rescue.state, 1)).toEqual([0, 1]);
  });

  it('judges each kit on its own, and rescues only when both are exact', () => {
    const rescue = createRescue(pair);
    rescue.clip(0, 0);
    rescue.clip(2, 1);
    rescue.clip(3, 1);
    expect(rescue.letGo()).toEqual([
      { type: 'released', outcomes: [{ verdict: 'short', have: 3, need: 4 }, { verdict: 'exact', have: 5, need: 5 }], tries: 1 },
    ]);
    expect(rescue.state.rescued).toBe(false);
    rescue.clip(1, 0);
    rescue.letGo();
    expect(rescue.state.rescued).toBe(true);
  });

  it('applies the hook limit to each kit', () => {
    const rescue = createRescue({ ...pair, hooks: 1 });
    rescue.clip(0, 0);
    expect(rescue.clip(1, 0)).toEqual([{ type: 'full' }]);
    expect(rescue.clip(1, 1)).toEqual([{ type: 'clipped', value: 1, kit: 1 }]);
  });

  it('takes a balloon off the kit it is on', () => {
    const rescue = createRescue(pair);
    rescue.clip(0, 0);
    rescue.clip(2, 1);
    expect(rescue.unclip(1, 0)).toEqual([{ type: 'unclipped', value: 2 }]);
    expect(clippedOn(rescue.state, 0)).toHaveLength(1);
    expect(clippedOn(rescue.state, 1)).toHaveLength(0);
  });
});

describe('starting over', () => {
  it('blows every pop back up and sends every balloon back, keeping the tries', () => {
    const rescue = createRescue({ id: 't', line: '', weight: 10, tray: [2], tied: [9, 5, 3] });
    rescue.togglePop(1);
    rescue.clip(0);
    rescue.letGo();
    expect(canStartOver(rescue.state)).toBe(true);
    expect(rescue.startOver()).toEqual([{ type: 'reset' }]);
    expect(rescue.state.tied.every((balloon) => !balloon.popped)).toBe(true);
    expect(rescue.state.clipped).toEqual([]);
    expect(rescue.state.tries).toBe(1);
  });

  it('does nothing when there is nothing to undo', () => {
    const rescue = createRescue(eight);
    expect(canStartOver(rescue.state)).toBe(false);
    expect(rescue.startOver()).toEqual([]);
  });
});

describe('the finished sums', () => {
  it('adds up what lifted', () => {
    const rescue = createRescue(eight);
    rescue.clip(0);
    rescue.clip(1);
    expect(answerLines(rescue.state)).toEqual(['5 + 3 = 8']);
  });

  it('takes away what was popped', () => {
    const rescue = createRescue({ id: 't', line: '', weight: 10, tray: [2], tied: [9, 5, 3] });
    rescue.togglePop(0);
    rescue.clip(0);
    expect(answerLines(rescue.state)).toEqual(['17 − 9 + 2 = 10']);
  });

  it('says just the number when one balloon did it', () => {
    const rescue = createRescue({ id: 'one', line: '', weight: 3, tray: [3, 5] });
    rescue.clip(0);
    expect(answerLines(rescue.state)).toEqual(['3']);
  });

  it('writes one sum per kit', () => {
    const rescue = createRescue(pair);
    rescue.clip(0, 0);
    rescue.clip(1, 0);
    rescue.clip(2, 1);
    rescue.clip(3, 1);
    expect(answerLines(rescue.state)).toEqual(['3 + 1 = 4', '2 + 3 = 5']);
  });
});
```

```ts
// games/balloon/src/logic/solver.test.ts
import { describe, it, expect } from 'vitest';
import { createRescue } from './rescue.js';
import { needsPop, solve, subsetsOf, totalAt } from './solver.js';
import type { RescueDef } from './rescue-def.js';

describe('the solver', () => {
  it('lists every subset once', () => {
    expect(subsetsOf(0)).toEqual([[]]);
    expect(subsetsOf(3)).toHaveLength(8);
  });

  it('finds every bunch that makes the weight', () => {
    const answers = solve({ id: 'a', line: '', weight: 7, tray: [6, 4, 3, 1] });
    expect(answers.map((answer) => answer.clip)).toEqual(expect.arrayContaining([[0, 3], [1, 2]]));
    expect(answers).toHaveLength(2);
    for (const answer of answers) expect(answer.friend).toEqual([]);
  });

  it('respects the hook limit', () => {
    const def: RescueDef = { id: 'h', line: '', weight: 12, hooks: 2, tray: [4, 4, 4, 8] };
    expect(solve(def).every((answer) => answer.clip.length <= 2)).toBe(true);
    expect(solve({ ...def, tray: [4, 4, 4] })).toEqual([]);
  });

  it('pops tied balloons when it must', () => {
    const def: RescueDef = { id: 'p', line: '', weight: 7, tray: [], tied: [6, 3, 1] };
    expect(solve(def)).toEqual([{ clip: [], friend: [], pop: [1] }]);
    expect(needsPop(def)).toBe(true);
    expect(needsPop({ id: 'n', line: '', weight: 3, tray: [3] })).toBe(false);
  });

  it('splits one tray between two kits', () => {
    const def: RescueDef = { id: 'pair', line: '', weight: 4, friend: 5, tray: [3, 1, 2, 3] };
    const answers = solve(def);
    expect(answers.length).toBeGreaterThan(0);
    for (const answer of answers) {
      expect(totalAt(def.tray, answer.clip)).toBe(4);
      expect(totalAt(def.tray, answer.friend)).toBe(5);
      expect(answer.clip.filter((index) => answer.friend.includes(index))).toEqual([]);
    }
  });

  it('applies the hook limit to each kit', () => {
    const def: RescueDef = { id: 'pair', line: '', weight: 4, friend: 5, hooks: 1, tray: [3, 1, 2, 3] };
    expect(solve(def)).toEqual([]);
  });

  it('gives answers that really do rescue', () => {
    for (const def of [
      { id: 'x', line: '', weight: 10, tray: [2], tied: [9, 5, 3] },
      { id: 'pair', line: '', weight: 4, friend: 5, tray: [3, 1, 2, 3] },
    ] satisfies RescueDef[]) {
      for (const answer of solve(def)) {
        const rescue = createRescue(def);
        answer.pop.forEach((index) => rescue.togglePop(index));
        answer.clip.forEach((index) => rescue.clip(index, 0));
        answer.friend.forEach((index) => rescue.clip(index, 1));
        rescue.letGo();
        expect(rescue.state.rescued).toBe(true);
      }
    }
  });
});
```

```ts
// games/balloon/src/logic/levels.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { CHAPTERS, RESCUES, chapterOf, numberInChapter } from './levels.data.js';
import { DEFAULT_HOOKS, hooksOf, problemsWith, tiedOf, weightsOf, type RescueDef } from './rescue-def.js';
import { needsPop, solve, subsetsOf, totalAt } from './solver.js';

const chapter = (id: string) => {
  const found = CHAPTERS.find((each) => each.id === id);
  if (!found) throw new Error(`no chapter ${id}`);
  return found;
};
const indexOfChapter = (id: string) => CHAPTERS.findIndex((each) => each.id === id);
const pairs = (tray: readonly number[]) => subsetsOf(tray.length).filter((set) => set.length === 2);
const trayTotal = (rescue: RescueDef) => totalAt(rescue.tray, rescue.tray.map((_, index) => index));
const spareOf = (rescue: RescueDef) => trayTotal(rescue) - weightsOf(rescue).reduce((sum, weight) => sum + weight, 0);

describe('the chapters', () => {
  it('are the eight the spec names, in order', () => {
    expect(CHAPTERS.map((each) => each.title)).toEqual([
      'First Flight',
      'Whoosh!',
      'Big Bunches',
      'Heavy Cargo',
      'Tiny Harness',
      'Pop!',
      'Two at Once',
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

  it('gives every kit a weight in its chapter\'s range', () => {
    for (const each of CHAPTERS) {
      for (const rescue of each.rescues) {
        for (const weight of weightsOf(rescue)) {
          expect(weight, rescue.id).toBeGreaterThanOrEqual(each.targets[0]);
          expect(weight, rescue.id).toBeLessThanOrEqual(each.targets[1]);
        }
      }
    }
  });

  it('can be answered by one matching balloon only in the very first rescue', () => {
    const matches = (rescue: RescueDef) =>
      tiedOf(rescue).length === 0 && weightsOf(rescue).some((weight) => rescue.tray.includes(weight));
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

  it('nothing before Two at Once has a second kit', () => {
    for (const rescue of CHAPTERS.slice(0, indexOfChapter('two-at-once')).flatMap((each) => each.rescues)) {
      expect(weightsOf(rescue), rescue.id).toHaveLength(1);
    }
  });

  it('Two at Once always has two kits, and uses every balloon bar at most one spare', () => {
    for (const rescue of chapter('two-at-once').rescues) {
      expect(weightsOf(rescue), rescue.id).toHaveLength(2);
      const spare = spareOf(rescue);
      expect(spare === 0 || rescue.tray.includes(spare), rescue.id).toBe(true);
    }
  });

  it('Two at Once saves the spare balloon for its last two rescues', () => {
    const rescues = chapter('two-at-once').rescues;
    for (const rescue of rescues.slice(0, -2)) expect(spareOf(rescue), rescue.id).toBe(0);
    for (const rescue of rescues.slice(-2)) expect(spareOf(rescue), rescue.id).toBeGreaterThan(0);
  });

  it('every rescue in The Big Rescue needs two ideas at once', () => {
    for (const rescue of chapter('big-rescue').rescues) {
      const weights = weightsOf(rescue);
      const ideas = [Math.max(...weights) > 10, hooksOf(rescue) < DEFAULT_HOOKS, needsPop(rescue), weights.length > 1];
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
```

```ts
// games/balloon/src/logic/guards.test.ts
import { describe, it, expect } from 'vitest';
import { createRng } from '@bundle/core';
import { CHAPTERS, RESCUES } from './levels.data.js';
import { createRescue, liftOf, type Rescue } from './rescue.js';
import { weightsOf, type RescueDef } from './rescue-def.js';
import { solve } from './solver.js';
import { starsFor } from './stars.js';

const biggestFirst = (values: readonly number[]) =>
  values.map((value, index) => ({ value, index })).sort((a, b) => b.value - a.value);

const exactOnLetGo = (rescue: Rescue): boolean => {
  const [event] = rescue.letGo();
  return event?.type === 'released' && event.outcomes.every((outcome) => outcome.verdict === 'exact');
};

/** Grabs the biggest balloons for each kit in turn until it has enough, reading nothing but size. */
const sizeOnlyFirstTry = (def: RescueDef): boolean => {
  const rescue = createRescue(def);
  const weights = weightsOf(def);
  let kit = 0;
  for (const { index } of biggestFirst(def.tray)) {
    while (kit < weights.length && liftOf(rescue.state, kit) >= weights[kit]!) kit += 1;
    if (kit >= weights.length) break;
    if (rescue.clip(index, kit).some((event) => event.type === 'full')) kit += 1;
  }
  return exactOnLetGo(rescue);
};

/** Clips to random kits and pops at random, and lets go, over and over. */
const randomStars = (def: RescueDef, seed: number): number => {
  const rng = createRng(seed);
  const rescue = createRescue(def);
  const kits = weightsOf(def).length;
  for (let attempt = 0; attempt < 60 && !rescue.state.rescued; attempt += 1) {
    rescue.startOver();
    rescue.state.tied.forEach((_, index) => {
      if (rng.next() < 0.5) rescue.togglePop(index);
    });
    def.tray.forEach((_, index) => {
      const choice = rng.int(kits + 1);
      if (choice < kits) rescue.clip(index, choice);
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
      answer.clip.forEach((index) => rescue.clip(index, 0));
      answer.friend.forEach((index) => rescue.clip(index, 1));
      expect(exactOnLetGo(rescue), def.id).toBe(true);
      expect(starsFor(rescue.state.tries)).toBe(3);
    }
  });
});
```

- [ ] **Step 2: Run to see them fail**

Run: `npx vitest run games/balloon/src/logic`
Expected: FAIL — `clippedOn`, `canStartOver`, `startOver`, two-kit clipping and the `two-at-once` chapter do not exist.

- [ ] **Step 3: Replace `rescue.ts`**

```ts
// games/balloon/src/logic/rescue.ts
import { judge, type Outcome } from './outcome.js';
import { hooksOf, kitsOf, tiedOf, weightsOf, type RescueDef } from './rescue-def.js';

/** A balloon taken from the tray: where it came from, and which kit it is on. */
export interface Taken {
  value: number;
  from: number;
  kit: number;
}

export interface TiedBalloon {
  value: number;
  popped: boolean;
}

export interface RescueState {
  readonly def: RescueDef;
  /** Tied balloons are always on the left kit. */
  tied: TiedBalloon[];
  clipped: Taken[];
  tries: number;
  rescued: boolean;
}

export type RescueEvent =
  | { type: 'clipped'; value: number; kit: number }
  | { type: 'unclipped'; value: number }
  | { type: 'full' }
  | { type: 'popped'; index: number; value: number }
  | { type: 'reinflated'; index: number; value: number }
  | { type: 'reset' }
  | { type: 'released'; outcomes: Outcome[]; tries: number };

export interface Rescue {
  readonly state: RescueState;
  clip(trayIndex: number, kit?: number): RescueEvent[];
  unclip(kit: number, slot: number): RescueEvent[];
  togglePop(tiedIndex: number): RescueEvent[];
  startOver(): RescueEvent[];
  letGo(): RescueEvent[];
}

const MINUS = '−';
const total = (values: readonly number[]): number => values.reduce((sum, value) => sum + value, 0);

const tiedOn = (state: RescueState, kit: number): TiedBalloon[] => (kit === 0 ? state.tied : []);

/** The clipped balloons on one kit, in the order they hang. */
export const clippedOn = (state: RescueState, kit: number): Taken[] => state.clipped.filter((taken) => taken.kit === kit);

/** Every value still lifting one kit, tied first, in the order they hang on the harness. */
export const liftedValues = (state: RescueState, kit = 0): number[] => [
  ...tiedOn(state, kit).filter((balloon) => !balloon.popped).map((balloon) => balloon.value),
  ...clippedOn(state, kit).map((taken) => taken.value),
];

/** The bunch slots of those same balloons: tied first, then clipped. */
export const liftedSlots = (state: RescueState, kit = 0): number[] => {
  const tied = tiedOn(state, kit);
  return [
    ...tied.flatMap((balloon, index) => (balloon.popped ? [] : [index])),
    ...clippedOn(state, kit).map((_, index) => tied.length + index),
  ];
};

export const liftOf = (state: RescueState, kit = 0): number => total(liftedValues(state, kit));
/** A popped balloon still hangs on its hook. */
export const hooksUsed = (state: RescueState, kit = 0): number => tiedOn(state, kit).length + clippedOn(state, kit).length;
export const trayTaken = (state: RescueState, index: number): boolean => state.clipped.some((taken) => taken.from === index);
export const canLetGo = (state: RescueState): boolean =>
  !state.rescued && weightsOf(state.def).some((_, kit) => hooksUsed(state, kit) > 0);
/** Anything to undo: a popped balloon, or a clipped one. */
export const canStartOver = (state: RescueState): boolean =>
  !state.rescued && (state.clipped.length > 0 || state.tied.some((balloon) => balloon.popped));

export const outcomesOf = (state: RescueState): Outcome[] =>
  weightsOf(state.def).map((weight, kit) => judge(liftOf(state, kit), weight));

/**
 * The sums the rescue made, one per kit, written out for the moment it lands.
 * That beat is the teaching: the child sees their bunch turned into
 * arithmetic. A pop is written as taking away, because that is what it was.
 */
export function answerLines(state: RescueState): string[] {
  return weightsOf(state.def).map((weight, kit) => {
    const tied = tiedOn(state, kit);
    const popped = tied.filter((balloon) => balloon.popped).map((balloon) => balloon.value);
    const lifted = liftedValues(state, kit);
    if (popped.length > 0) {
      const whole = total(tied.map((balloon) => balloon.value));
      const terms = [String(whole), ...popped.map((value) => `${MINUS} ${value}`), ...clippedOn(state, kit).map((taken) => `+ ${taken.value}`)];
      return `${terms.join(' ')} = ${weight}`;
    }
    return lifted.length > 1 ? `${lifted.join(' + ')} = ${weight}` : String(weight);
  });
}

export function createRescue(def: RescueDef): Rescue {
  const state: RescueState = {
    def,
    tied: tiedOf(def).map((value) => ({ value, popped: false })),
    clipped: [],
    tries: 0,
    rescued: false,
  };

  return {
    state,

    clip(index, kit = 0) {
      const value = def.tray[index];
      if (state.rescued || value === undefined || trayTaken(state, index)) return [];
      if (kit < 0 || kit >= kitsOf(def)) return [];
      if (hooksUsed(state, kit) >= hooksOf(def)) return [{ type: 'full' }];
      state.clipped.push({ value, from: index, kit });
      return [{ type: 'clipped', value, kit }];
    },

    unclip(kit, slot) {
      const taken = clippedOn(state, kit)[slot];
      if (state.rescued || !taken) return [];
      state.clipped.splice(state.clipped.indexOf(taken), 1);
      return [{ type: 'unclipped', value: taken.value }];
    },

    togglePop(index) {
      const balloon = state.tied[index];
      if (state.rescued || !balloon) return [];
      balloon.popped = !balloon.popped;
      return [{ type: balloon.popped ? 'popped' : 'reinflated', index, value: balloon.value }];
    },

    startOver() {
      if (!canStartOver(state)) return [];
      for (const balloon of state.tied) balloon.popped = false;
      state.clipped.length = 0;
      return [{ type: 'reset' }];
    },

    letGo() {
      if (!canLetGo(state)) return [];
      state.tries += 1;
      const outcomes = outcomesOf(state);
      if (outcomes.every((outcome) => outcome.verdict === 'exact')) state.rescued = true;
      return [{ type: 'released', outcomes, tries: state.tries }];
    },
  };
}
```

- [ ] **Step 4: Replace `solver.ts`**

```ts
// games/balloon/src/logic/solver.ts
import { hooksOf, tiedOf, weightsOf, type RescueDef } from './rescue-def.js';

/** One way through a rescue: tray balloons for each kit, and tied ones to pop. */
export interface Answer {
  clip: number[];
  friend: number[];
  pop: number[];
}

/** Every subset of `0..size-1`, smallest masks first. Trays are small enough for this. */
export function subsetsOf(size: number): number[][] {
  const subsets: number[][] = [];
  for (let mask = 0; mask < 1 << size; mask += 1) {
    const subset: number[] = [];
    for (let index = 0; index < size; index += 1) if (mask & (1 << index)) subset.push(index);
    subsets.push(subset);
  }
  return subsets;
}

export const totalAt = (values: readonly number[], indices: readonly number[]): number =>
  indices.reduce((sum, index) => sum + (values[index] ?? 0), 0);

/**
 * Brute force: every tray balloon stays in the tray or goes to one of the kits,
 * every tied balloon is popped or not. Proof, not play: the tests use it to show
 * every rescue is answerable and to check what each chapter is for.
 */
export function solve(def: RescueDef): Answer[] {
  const tied = tiedOf(def);
  const weights = weightsOf(def);
  const choices = weights.length + 1;
  const tiedTotal = totalAt(tied, tied.map((_, index) => index));
  const answers: Answer[] = [];
  for (const pop of subsetsOf(tied.length)) {
    const base = tiedTotal - totalAt(tied, pop);
    for (let code = 0; code < choices ** def.tray.length; code += 1) {
      const clip: number[] = [];
      const friend: number[] = [];
      let rest = code;
      for (let index = 0; index < def.tray.length; index += 1) {
        const choice = rest % choices;
        rest = (rest - choice) / choices;
        if (choice === 1) clip.push(index);
        else if (choice === 2) friend.push(index);
      }
      if (tied.length + clip.length > hooksOf(def) || friend.length > hooksOf(def)) continue;
      if (base + totalAt(def.tray, clip) !== weights[0]) continue;
      if (weights.length > 1 && totalAt(def.tray, friend) !== weights[1]) continue;
      answers.push({ clip, friend, pop });
    }
  }
  return answers;
}

/** Answerable, and only by popping something. */
export const needsPop = (def: RescueDef): boolean => {
  const answers = solve(def);
  return answers.length > 0 && answers.every((answer) => answer.pop.length > 0);
};
```

- [ ] **Step 5: Replace Windy Ridge and rework The Big Rescue in `levels.data.ts`**

Replace the `windy-ridge` chapter, comment included, with:

```ts
  // Two kits, one tray, and a split: the tray adds up to both weights together,
  // so every balloon is used. The last two carry one spare, so the split has
  // to be chosen rather than forced.
  chapter('two-at-once', 'Two at Once', [4, 10], [
    { line: 'Pip and Bo both need a lift', weight: 4, friend: 5, tray: [3, 1, 2, 3] },
    { line: 'Two friends, one bunch of balloons', weight: 6, friend: 7, tray: [5, 4, 2, 1, 1] },
    { line: 'A big kit and a little kit', weight: 5, friend: 9, tray: [6, 4, 3, 1] },
    { line: 'One balloon will be left over', weight: 8, friend: 6, tray: [5, 4, 3, 2, 1] },
    { line: 'Tilly and Juno, side by side', weight: 10, friend: 7, tray: [6, 5, 4, 3, 2] },
  ]),
```

and replace the `big-rescue` chapter with:

```ts
  // Two ideas in every rescue.
  chapter('big-rescue', 'The Big Rescue', [5, 20], [
    { line: 'Two heavy kits this time', weight: 12, friend: 5, tray: [10, 2, 3, 2] },
    { line: 'A heavy load and too much lift', weight: 13, tray: [3], tied: [10, 6] },
    { line: 'Big load, little harness', weight: 18, hooks: 3, tray: [10, 9, 8, 6, 5, 3, 2] },
    { line: 'Pop for one kit, share for the other', weight: 13, friend: 5, tray: [3, 2], tied: [7, 6, 4] },
    { line: 'The last two kits to rescue!', weight: 15, friend: 9, hooks: 2, tray: [10, 5, 6, 3] },
  ]),
```

Every number above was checked against the curriculum rules before this plan was written.

- [ ] **Step 6: Run to see them pass**

Run: `npx vitest run games/balloon/src/logic`
Expected: PASS. (The driver and view compile again after Tasks 3–4.)

- [ ] **Step 7: Commit**

```bash
git add games/balloon/src/logic
git commit -m "feat(balloon): two kits sharing a tray, start over, and Two at Once"
```

---

### Task 3: The driver, the module and the sounds

**Files:**
- Replace: `games/balloon/src/intent.ts`, `games/balloon/src/driver.ts`, `games/balloon/src/view/timing.ts`
- Modify: `games/balloon/src/driver.test.ts`, `games/balloon/src/index.ts`, `games/balloon/src/integration.test.ts`, `games/balloon/src/audio/balloon-sounds.ts`

**Interfaces:**
- Consumes: Task 2.
- Produces from `intent.ts`: `Intent` = `tray { index; kit? }` | `clipped { kit; slot }` | `tied { index }` | `select { kit }` | `reset` | `letGo` | `next`.
- Produces from `driver.ts`: `Flight { outcomes; t; count; fly; lifted: number[][] }`; `DriverEvent` adds `{ type: 'selected'; kit }` and `landed { outcomes }`; `SceneModel` adds `selected: number`, and `feedback: readonly Outcome[] | null`; `Driver.selected`.
- Produces from `timing.ts`: `flySeconds(outcomes)`.

- [ ] **Step 1: Write the tests**

In `driver.test.ts`:
- in `'flies after "Let go!", then comes back with the gap to fix'` the landed event becomes `{ type: 'landed', outcomes: [{ verdict: 'over', have: 5, need: 3 }] }`, and `expect(driver.feedback?.verdict).toBe('over')` becomes `expect(driver.feedback?.[0]?.verdict).toBe('over')`;
- in `'finishes after the last rescue, and starts over from there'` the setup becomes:

```ts
    const driver = createDriver({ book: {}, startLevel: 'big-rescue-5' });
    // 10 + 5 for the 15, 6 + 3 for the 9.
    driver.act({ kind: 'tray', index: 0 });
    driver.act({ kind: 'tray', index: 1 });
    driver.act({ kind: 'select', kit: 1 });
    driver.act({ kind: 'tray', index: 2 });
    driver.act({ kind: 'tray', index: 3 });
    driver.act({ kind: 'letGo' });
```

- in `'forgets the old verdict as soon as the bunch changes'` the unclip becomes `driver.act({ kind: 'clipped', kit: 0, slot: 0 });`;
- delete `'gives a kit blown the wrong way time to drift and parachute home'` and its `TIMING` import;
- add:

```ts
  it('clips a tapped balloon to the selected kit, and judges each kit on its own', () => {
    const driver = createDriver({ book: {}, startLevel: 'two-at-once-1' });
    driver.act({ kind: 'tray', index: 0 }); // 3 on the 4
    expect(driver.act({ kind: 'select', kit: 1 })).toEqual([{ type: 'selected', kit: 1 }]);
    driver.act({ kind: 'tray', index: 2 }); // 2 on the 5
    driver.act({ kind: 'tray', index: 3 }); // 3 on the 5
    driver.act({ kind: 'letGo' });
    const events = settle(driver);
    expect(events).toContainEqual({
      type: 'landed',
      outcomes: [
        { verdict: 'short', have: 3, need: 4 },
        { verdict: 'exact', have: 5, need: 5 },
      ],
    });
    expect(driver.phase).toBe('building');
    expect(driver.feedback).toHaveLength(2);
  });

  it('clips a dropped balloon to the kit it was dropped on, whichever is selected', () => {
    const driver = createDriver({ book: {}, startLevel: 'two-at-once-1' });
    driver.act({ kind: 'tray', index: 1, kit: 1 });
    expect(driver.selected).toBe(0);
    expect(driver.rescue.state.clipped).toEqual([{ value: 1, from: 1, kit: 1 }]);
  });

  it('will not select a kit that is not there', () => {
    const driver = createDriver({ book: {}, startLevel: 'whoosh-1' });
    expect(driver.act({ kind: 'select', kit: 1 })).toEqual([]);
    expect(driver.selected).toBe(0);
  });

  it('starts over: every balloon back, every pop undone, the tries kept', () => {
    const driver = createDriver({ book: {}, startLevel: 'pop-1' });
    driver.act({ kind: 'tied', index: 0 });
    driver.act({ kind: 'letGo' });
    settle(driver);
    expect(driver.act({ kind: 'reset' })).toEqual([{ type: 'reset' }]);
    expect(driver.rescue.state.tied.every((balloon) => !balloon.popped)).toBe(true);
    expect(driver.rescue.state.tries).toBe(1);
    expect(driver.feedback).toBeNull();
  });

  it('ignores start over while the kit is in the air', () => {
    const driver = createDriver({ book: {}, startLevel: 'pop-1' });
    driver.act({ kind: 'tied', index: 1 });
    driver.act({ kind: 'letGo' });
    driver.step(FRAME);
    expect(driver.act({ kind: 'reset' })).toEqual([]);
  });

  it('goes back to the left kit for each new rescue', () => {
    const driver = createDriver({ book: {}, startLevel: 'two-at-once-1' });
    driver.act({ kind: 'select', kit: 1 });
    driver.act({ kind: 'tray', index: 2 });
    driver.act({ kind: 'tray', index: 3 });
    driver.act({ kind: 'select', kit: 0 });
    driver.act({ kind: 'tray', index: 0 });
    driver.act({ kind: 'tray', index: 1 });
    driver.act({ kind: 'select', kit: 1 });
    driver.act({ kind: 'letGo' });
    settle(driver);
    driver.act({ kind: 'next' });
    expect(driver.selected).toBe(0);
  });
```

In `integration.test.ts` change `session.__test.act({ kind: 'clipped', slot: 0 });` to `session.__test.act({ kind: 'clipped', kit: 0, slot: 0 });`.

- [ ] **Step 2: Run to see them fail**

Run: `npx vitest run games/balloon/src/driver.test.ts`
Expected: FAIL — the driver has no `select`, `reset` or `selected`, and still reads `event.outcome`.

- [ ] **Step 3: Replace `intent.ts`, `timing.ts` and `driver.ts`**

```ts
// games/balloon/src/intent.ts
/** Everything a tap or a drop can mean. Input produces these; the driver acts on them. */
export type Intent =
  /** A tray balloon onto a kit: the one it was dropped on, or the selected one for a tap. */
  | { kind: 'tray'; index: number; kit?: number }
  | { kind: 'clipped'; kit: number; slot: number }
  | { kind: 'tied'; index: number }
  | { kind: 'select'; kit: number }
  | { kind: 'reset' }
  | { kind: 'letGo' }
  | { kind: 'next' };
```

```ts
// games/balloon/src/view/timing.ts
import type { Outcome } from '../logic/outcome.js';

/**
 * How the game feels, in one place. Retuning choreography should never mean
 * hunting through the renderer.
 */
export const TIMING = {
  /** Each lifting balloon lights in turn as the gauge counts on. The teaching beat. */
  countPerBalloon: 0.42,
  /** However big the bunch, the count never keeps a child waiting longer than this. */
  countMax: 2.6,
  flight: {
    /** A strain and a hop. */
    short: 1.5,
    /** Up to the ledge, carried onto it by the breeze. */
    exact: 2.8,
    /** Up past the ledge, a cloud, and the parachute down. */
    over: 3.8,
  },
  chapterAnnounceSeconds: 2.3,
  chapterSettleFraction: 0.26,
  popSeconds: 0.4,
  solvedSeconds: 1.2,
  starsDelaySeconds: 0.9,
  starSeconds: 0.35,
  /** How fast a released bunch rises off the ledge, in design pixels per second. */
  releaseRise: 420,
  /** How far it rises before it is off the top and no longer drawn. */
  releaseGone: 560,
} as const;

export const countSeconds = (balloons: number): number =>
  Math.min(TIMING.countMax, balloons * TIMING.countPerBalloon);

/** The longest of every kit's flight, so the last to land decides when the next try can start. */
export const flySeconds = (outcomes: readonly Outcome[]): number =>
  Math.max(0, ...outcomes.map((outcome) => TIMING.flight[outcome.verdict]));
```

```ts
// games/balloon/src/driver.ts
import type { Intent } from './intent.js';
import { RESCUES, chapterOf, numberInChapter } from './logic/levels.data.js';
import type { Outcome } from './logic/outcome.js';
import { MAX_STARS, startIndex, totalStars } from './logic/progress.js';
import { createRescue, liftedValues, type Rescue, type RescueEvent, type RescueState } from './logic/rescue.js';
import { kitsOf, weightsOf, type ChapterDef } from './logic/rescue-def.js';
import { recordStars, starsFor, type StarBook } from './logic/stars.js';
import { countSeconds, flySeconds, TIMING } from './view/timing.js';

export type Phase = 'building' | 'flying' | 'rescued' | 'finished';

/** One "Let go!": the count, then the flight. `t` runs across both. One entry per kit. */
export interface Flight {
  outcomes: readonly Outcome[];
  t: number;
  count: number;
  fly: number;
  lifted: readonly (readonly number[])[];
}

export type DriverEvent =
  | RescueEvent
  | { type: 'selected'; kit: number }
  | { type: 'chapter'; chapter: ChapterDef }
  | { type: 'landed'; outcomes: readonly Outcome[] }
  | { type: 'rescued'; id: string; stars: number; book: StarBook }
  | { type: 'finished' };

/** Everything the scene draws from. */
export interface SceneModel {
  rescue: RescueState;
  chapter: ChapterDef;
  number: number;
  phase: Phase;
  flight: Flight | null;
  /** The last wrong try, one outcome per kit, until the bunch changes. */
  feedback: readonly Outcome[] | null;
  earned: number | null;
  totalStars: number;
  maxStars: number;
  /** The kit a tapped balloon goes to. */
  selected: number;
}

export interface DriverOptions {
  book: StarBook;
  /** A rescue or chapter id from the URL. Anything unrecognised opens where the player left off. */
  startLevel?: string;
}

/**
 * Strings rescues together. Scene, sound, input and the frame loop all talk to
 * the rescue through this, so none of them need to know when a flight ends or
 * which rescue comes next.
 */
export interface Driver {
  readonly phase: Phase;
  readonly rescue: Rescue;
  readonly flight: Flight | null;
  readonly feedback: readonly Outcome[] | null;
  readonly earned: number | null;
  readonly book: StarBook;
  readonly selected: number;
  /**
   * Whether a tap may move on. Not until the sum and every star have been
   * shown: a child still tapping as the kit lands would otherwise skip the
   * teaching beat without ever seeing it.
   */
  readonly readyForNext: boolean;
  step(dt: number): DriverEvent[];
  act(intent: Intent): DriverEvent[];
  model(): SceneModel;
}

const rescueAt = (index: number): Rescue => {
  const def = RESCUES[index];
  if (!def) throw new Error(`no rescue at ${index}`);
  return createRescue(def);
};

export function createDriver(options: DriverOptions): Driver {
  let book = options.book;
  let index = startIndex(book, options.startLevel);
  let rescue = rescueAt(index);
  let phase: Phase = 'building';
  let flight: Flight | null = null;
  let feedback: readonly Outcome[] | null = null;
  let earned: number | null = null;
  let selected = 0;
  /** Seconds since the rescue landed. */
  let since = 0;
  let pending: DriverEvent[] = [{ type: 'chapter', chapter: chapterOf(rescue.state.def) }];

  const open = (next: number): DriverEvent[] => {
    const before = chapterOf(rescue.state.def);
    index = next;
    rescue = rescueAt(index);
    phase = 'building';
    flight = null;
    feedback = null;
    earned = null;
    selected = 0;
    since = 0;
    const chapter = chapterOf(rescue.state.def);
    return chapter === before ? [] : [{ type: 'chapter', chapter }];
  };

  const build = (intent: Intent): DriverEvent[] => {
    switch (intent.kind) {
      case 'tray':
        return rescue.clip(intent.index, intent.kit ?? selected);
      case 'clipped':
        return rescue.unclip(intent.kit, intent.slot);
      case 'tied':
        return rescue.togglePop(intent.index);
      case 'select':
        if (intent.kit < 0 || intent.kit >= kitsOf(rescue.state.def) || intent.kit === selected) return [];
        selected = intent.kit;
        return [{ type: 'selected', kit: selected }];
      case 'reset':
        return rescue.startOver();
      case 'letGo':
        return rescue.letGo();
      case 'next':
        return [];
    }
  };

  const readyForNext = (): boolean =>
    phase === 'finished' ||
    (phase === 'rescued' && since >= TIMING.starsDelaySeconds + (earned ?? 0) * TIMING.starSeconds);

  return {
    get readyForNext() {
      return readyForNext();
    },
    get phase() {
      return phase;
    },
    get rescue() {
      return rescue;
    },
    get flight() {
      return flight;
    },
    get feedback() {
      return feedback;
    },
    get earned() {
      return earned;
    },
    get book() {
      return book;
    },
    get selected() {
      return selected;
    },

    act(intent) {
      if (phase === 'rescued' || phase === 'finished') {
        if (intent.kind !== 'next' || !readyForNext()) return [];
        if (phase === 'finished') return open(0);
        if (index + 1 >= RESCUES.length) {
          phase = 'finished';
          return [{ type: 'finished' }];
        }
        return open(index + 1);
      }
      if (phase !== 'building') return [];

      const events = build(intent);
      if (events.some((event) => event.type !== 'selected')) feedback = null;
      for (const event of events) {
        if (event.type !== 'released') continue;
        const lifted = weightsOf(rescue.state.def).map((_, kit) => liftedValues(rescue.state, kit));
        flight = {
          outcomes: event.outcomes,
          t: 0,
          count: countSeconds(lifted.flat().length),
          fly: flySeconds(event.outcomes),
          lifted,
        };
        phase = 'flying';
      }
      return events;
    },

    step(dt) {
      const events = pending;
      pending = [];
      if (phase === 'rescued') since += dt;
      if (phase !== 'flying' || !flight) return events;

      flight.t += dt;
      if (flight.t < flight.count + flight.fly) return events;

      const outcomes = flight.outcomes;
      flight = null;
      events.push({ type: 'landed', outcomes });
      if (outcomes.every((outcome) => outcome.verdict === 'exact')) {
        const id = rescue.state.def.id;
        earned = starsFor(rescue.state.tries);
        book = recordStars(book, id, earned);
        phase = 'rescued';
        since = 0;
        events.push({ type: 'rescued', id, stars: earned, book });
      } else {
        phase = 'building';
        feedback = outcomes;
      }
      return events;
    },

    model: () => ({
      rescue: rescue.state,
      chapter: chapterOf(rescue.state.def),
      number: numberInChapter(rescue.state.def),
      phase,
      flight,
      feedback,
      earned,
      totalStars: totalStars(book),
      maxStars: MAX_STARS,
      selected,
    }),
  };
}
```

- [ ] **Step 4: Update the module and the sounds**

`audio/balloon-sounds.ts`: add `'reset'` and `'select'` to `SOUND_EVENTS`, and the voices:

```ts
/** Start over: everything whisking back, a quick fall. */
const reset: Voice = (bus, delay) => {
  noiseBurst(bus, { duration: 0.25, gain: 0.07, filterHz: 1800, sweepTo: 600, delay });
  tone(bus, { freq: 660, duration: 0.18, type: 'triangle', gain: 0.1, sweepTo: 440, delay });
};
/** A kit chosen: a soft knock. */
const select: Voice = (bus, delay) => tone(bus, { freq: 520, duration: 0.08, type: 'sine', gain: 0.1, delay });
```

and add `reset, select` to `VOICES`.

`index.ts`:
- delete the `LAYERS` import;
- replace `liftOffSound` with:

```ts
/** The sound a kit makes as it leaves the ground, once the count is done. */
const liftOffSound = (outcome: Outcome): string =>
  outcome.verdict === 'exact' ? 'float' : outcome.verdict === 'short' ? 'strain' : 'whoosh';
```

- in `handleEvents`, the `released` case becomes:

```ts
          case 'released': {
            const flight = driver.flight;
            if (!flight) break;
            const counted = flight.lifted.flat();
            const beat = flight.count / Math.max(1, counted.length);
            counted.forEach((_, step) => sounds.play('count', { delay: step * beat, step }));
            event.outcomes.forEach((outcome, kit) => sounds.play(liftOffSound(outcome), { delay: flight.count + kit * 0.15 }));
            break;
          }
```

  the `landed` case becomes `if (event.outcomes.some((outcome) => outcome.verdict !== 'exact')) sounds.play('land');`, and add `case 'reset': sounds.play('reset'); break;` and `case 'selected': sounds.play('select'); break;`;
- the `answer` test hook clips with kits:

```ts
          answer.pop.forEach((index) => act({ kind: 'tied', index }));
          answer.clip.forEach((index) => act({ kind: 'tray', index, kit: 0 }));
          answer.friend.forEach((index) => act({ kind: 'tray', index, kit: 1 }));
          act({ kind: 'letGo' });
          settle();
```

- the `feedback` test hook becomes `feedback: () => (driver.feedback ? driver.feedback.map(feedbackLine).join(' / ') : null),`.

- [ ] **Step 5: Run to see them pass**

Run: `npx vitest run games/balloon/src/driver.test.ts games/balloon/src/logic games/balloon/src/audio`
Expected: PASS. (The view still fails to compile until Task 4.)

- [ ] **Step 6: Commit**

```bash
git add games/balloon/src
git commit -m "feat(balloon): the driver picks a kit, starts over, and lands every kit"
```

---

### Task 4: The view — two kits, start over, and lift during the count

**Files:**
- Replace: `games/balloon/src/view/geometry.ts`, `geometry.test.ts`, `flight.ts`, `flight.test.ts`, `scene.ts`
- Modify: `games/balloon/src/view/art.ts`, `art.test.ts`, `hud.ts`, `scene.test.ts`

**Interfaces:**
- Consumes: Tasks 2–3.
- Produces from `geometry.ts`: `LAYOUT` (gains `pairX`, `ledgeGap`, `reset`, `kitReach`; loses `rightCliffEdgeX`, `layerHeight`); `homeOf(def, kit)`; `ledgeSpot(def, kit = 0)`; `bunchCount(state, kit = 0)`; `dropKit(point, def): number | null` replacing `inDropZone`; `hitTest` that also returns `select` and `reset`. Removes `layerY`.
- Produces from `flight.ts`: `flightPose(outcome, t, home, spot): Pose`.
- Produces from `art.ts`: `drawResetButton(ctx, enabled)`, `drawSelectRing(ctx, feet)`. Removes `drawWindLayers`.
- Produces from `hud.ts`: `drawGauge(ctx, outcome, centre?, small = false)`.
- Produces from `scene.ts`: `Drag.from` is `{ kind: 'tray'; index }` or `{ kind: 'clipped'; kit; slot }`; `COUNT_RISE`.

- [ ] **Step 1: Write the tests**

```ts
// games/balloon/src/view/geometry.test.ts
import { describe, it, expect } from 'vitest';
import { DESIGN } from '@bundle/core';
import { createRescue } from '../logic/rescue.js';
import { RESCUES } from '../logic/levels.data.js';
import type { RescueDef } from '../logic/rescue-def.js';
import {
  balloonRadius,
  bunchCount,
  bunchPoint,
  dropKit,
  HOME,
  hitTest,
  homeOf,
  inTray,
  LAYOUT,
  ledgeSpot,
  limpPoint,
  pegPoint,
  trayPoint,
} from './geometry.js';

const def: RescueDef = { id: 'g', line: '', weight: 8, tray: [5, 3, 6, 2] };
const pair: RescueDef = { id: 'p', line: '', weight: 4, friend: 5, tray: [3, 1, 2, 3] };

describe('geometry', () => {
  it('makes a bigger number a bigger balloon', () => {
    for (let value = 1; value < 10; value += 1) expect(balloonRadius(value + 1)).toBeGreaterThan(balloonRadius(value));
  });

  it('keeps every tray balloon apart and on screen, in every rescue', () => {
    for (const rescue of RESCUES) {
      const points = rescue.tray.map((_, index) => trayPoint(rescue, index));
      points.forEach((point, index) => {
        const radius = balloonRadius(rescue.tray[index]!);
        expect(point.x - radius, rescue.id).toBeGreaterThanOrEqual(0);
        expect(point.x + radius, rescue.id).toBeLessThanOrEqual(LAYOUT.button.left);
        const next = points[index + 1];
        if (next) expect(next.x - point.x, rescue.id).toBeGreaterThanOrEqual(radius + balloonRadius(rescue.tray[index + 1]!) - 12);
      });
    }
  });

  it('keeps the peg beside the kit', () => {
    expect(pegPoint(HOME).x - HOME.x).toBeGreaterThan(30);
  });

  it('stands one kit at home, and two kits well apart', () => {
    expect(homeOf(def, 0)).toEqual(HOME);
    expect(homeOf(pair, 1).x - homeOf(pair, 0).x).toBeGreaterThanOrEqual(300);
  });

  it('lands every kit on the ledge, on screen, side by side', () => {
    for (const rescue of RESCUES) {
      expect(ledgeSpot(rescue).y).toBeLessThan(HOME.y);
      expect(ledgeSpot(rescue).x).toBeGreaterThan(0);
      expect(ledgeSpot(rescue).x).toBeLessThan(DESIGN.width);
    }
    expect(Math.abs(ledgeSpot(pair, 0).x - ledgeSpot(pair, 1).x)).toBeGreaterThanOrEqual(90);
    expect(ledgeSpot(pair, 1).x).toBeGreaterThan(0);
  });

  it('finds the tray balloon under a finger, and skips one already taken', () => {
    const rescue = createRescue(def);
    expect(hitTest(trayPoint(def, 2), rescue.state)).toEqual({ kind: 'tray', index: 2 });
    rescue.clip(2);
    expect(hitTest(trayPoint(def, 2), rescue.state)).toBeNull();
  });

  it('clips the balloon under the finger even where a squeezed tray lets tap circles overlap', () => {
    for (const rescue of RESCUES) {
      const state = createRescue(rescue).state;
      rescue.tray.forEach((value, index) => {
        const centre = trayPoint(rescue, index);
        const reach = balloonRadius(value) * 0.8;
        for (let step = 0; step < 8; step += 1) {
          const angle = (step / 8) * Math.PI * 2;
          const point = { x: centre.x + Math.cos(angle) * reach, y: centre.y + Math.sin(angle) * reach };
          expect(hitTest(point, state), `${rescue.id} balloon ${index}`).toEqual({ kind: 'tray', index });
        }
      });
    }
  });

  it('finds a clipped balloon on the harness', () => {
    const rescue = createRescue(def);
    rescue.clip(0);
    rescue.clip(1);
    expect(hitTest(bunchPoint(1, 2, HOME), rescue.state)).toEqual({ kind: 'clipped', kit: 0, slot: 1 });
  });

  it('finds a tied balloon, which a tap pops', () => {
    const rescue = createRescue({ id: 't', line: '', weight: 7, tray: [2], tied: [6, 3, 1] });
    rescue.clip(0);
    expect(hitTest(bunchPoint(1, 4, HOME), rescue.state)).toEqual({ kind: 'tied', index: 1 });
    expect(hitTest(bunchPoint(3, 4, HOME), rescue.state)).toEqual({ kind: 'clipped', kit: 0, slot: 0 });
  });

  it('finds a popped balloon where its scrap hangs, so a tap can blow it back up', () => {
    const rescue = createRescue({ id: 't', line: '', weight: 7, tray: [], tied: [6, 3, 1] });
    rescue.togglePop(1);
    const scrap = limpPoint(bunchPoint(1, 3, HOME));
    expect(hitTest(scrap, rescue.state)).toEqual({ kind: 'tied', index: 1 });
    expect(hitTest({ x: scrap.x, y: scrap.y + 22 }, rescue.state)).toEqual({ kind: 'tied', index: 1 });
  });

  it('lays a limited harness out by its hooks, and finds its balloons there', () => {
    const limited: RescueDef = { id: 'h', line: '', weight: 12, hooks: 2, tray: [4, 8] };
    const rescue = createRescue(limited);
    rescue.clip(1);
    expect(bunchCount(rescue.state)).toBe(2);
    expect(hitTest(bunchPoint(0, 2, HOME), rescue.state)).toEqual({ kind: 'clipped', kit: 0, slot: 0 });
    expect(bunchCount(createRescue(def).state)).toBe(0);
  });

  it('finds a balloon on the second kit', () => {
    const rescue = createRescue(pair);
    rescue.clip(0, 1);
    expect(hitTest(bunchPoint(0, 1, homeOf(pair, 1)), rescue.state)).toEqual({ kind: 'clipped', kit: 1, slot: 0 });
  });

  it('selects a kit tapped in Two at Once, and does nothing for a lone kit', () => {
    const second = homeOf(pair, 1);
    expect(hitTest({ x: second.x, y: second.y - 55 }, createRescue(pair).state)).toEqual({ kind: 'select', kit: 1 });
    expect(hitTest({ x: HOME.x, y: HOME.y - 55 }, createRescue(def).state)).toBeNull();
  });

  it('finds the button and the start-over button', () => {
    const { left, top, width, height } = LAYOUT.button;
    expect(hitTest({ x: left + width / 2, y: top + height / 2 }, createRescue(def).state)).toEqual({ kind: 'letGo' });
    expect(hitTest({ x: LAYOUT.reset.x, y: LAYOUT.reset.y }, createRescue(def).state)).toEqual({ kind: 'reset' });
  });

  it('finds nothing in the open sky', () => {
    expect(hitTest({ x: 700, y: 120 }, createRescue(def).state)).toBeNull();
  });

  it('takes a drop near a kit, the nearer of two, and not one in the tray or on the button', () => {
    expect(dropKit({ x: HOME.x, y: HOME.y - 260 }, def)).toBe(0);
    expect(dropKit({ x: HOME.x + 150, y: HOME.y - 80 }, def)).toBe(0);
    expect(dropKit(trayPoint(def, 0), def)).toBeNull();
    expect(dropKit({ x: LAYOUT.button.left + 40, y: LAYOUT.button.top + 40 }, def)).toBeNull();
    expect(dropKit({ x: 1050, y: 200 }, def)).toBeNull();
    expect(dropKit({ x: homeOf(pair, 1).x, y: 330 }, pair)).toBe(1);
    expect(dropKit({ x: homeOf(pair, 0).x, y: 330 }, pair)).toBe(0);
  });

  it('knows a drop over the tray strip', () => {
    expect(inTray({ x: 400, y: LAYOUT.trayY })).toBe(true);
    expect(inTray({ x: 400, y: HOME.y - 200 })).toBe(false);
  });
});
```

```ts
// games/balloon/src/view/flight.test.ts
import { describe, it, expect } from 'vitest';
import { judge } from '../logic/outcome.js';
import { flightPose } from './flight.js';
import { HOME, LAYOUT } from './geometry.js';

const spot = { x: 140, y: LAYOUT.ledgeY };

describe('the flight', () => {
  it('starts at home every time', () => {
    for (const outcome of [judge(6, 8), judge(8, 8), judge(11, 8)]) expect(flightPose(outcome, 0, HOME, spot).at).toEqual(HOME);
  });

  it('ends on the ledge when it was just right', () => {
    const landed = flightPose(judge(8, 8), 1, HOME, spot);
    expect(landed.at).toEqual(spot);
    expect(landed.mood).toBe('happy');
  });

  it('is carried left onto the cliff by the breeze at the ledge\'s height', () => {
    const pose = flightPose(judge(8, 8), 0.8, HOME, spot);
    expect(pose.at.x).toBeLessThan(HOME.x);
    expect(pose.at.y).toBeLessThanOrEqual(LAYOUT.ledgeY);
  });

  it('never really leaves the ground when it was too little', () => {
    for (let t = 0; t <= 1; t += 0.05) {
      const pose = flightPose(judge(6, 8), t, HOME, spot);
      expect(HOME.y - pose.at.y).toBeLessThanOrEqual(45);
      expect(pose.mood).toBe('strain');
    }
    expect(flightPose(judge(6, 8), 1, HOME, spot).at).toEqual(HOME);
  });

  it('goes off the top when it was too much, and comes home by parachute', () => {
    expect(flightPose(judge(11, 8), 0.4, HOME, spot).at.y).toBeLessThan(0);
    const landed = flightPose(judge(11, 8), 1, HOME, spot);
    expect(landed.at).toEqual(HOME);
    expect(landed.parachute).toBe(true);
  });

  it('flies from wherever the kit stands', () => {
    const second = { x: 600, y: HOME.y };
    expect(flightPose(judge(8, 8), 0, second, spot).at).toEqual(second);
    expect(flightPose(judge(8, 8), 1, second, spot).at).toEqual(spot);
    expect(flightPose(judge(11, 8), 1, second, spot).at).toEqual(second);
  });

  it('holds still outside 0..1', () => {
    expect(flightPose(judge(8, 8), 1.5, HOME, spot).at).toEqual(spot);
    expect(flightPose(judge(8, 8), -1, HOME, spot).at).toEqual(HOME);
  });
});
```

`art.test.ts`: in the imports, replace `drawWindLayers` with `drawResetButton` and `drawSelectRing`; in `'draws every piece…'` replace `drawWindLayers(ctx, bounds, 2, 1.5);` with `drawResetButton(ctx, true); drawResetButton(ctx, false); drawSelectRing(ctx, { x: 300, y: 560 });`; and replace `'numbers the layers, and only the ledge\'s layer blows towards it'` with:

```ts
  it('marks the start-over button with its arrow', () => {
    const { ctx, texts } = recordingContext();
    drawResetButton(ctx, true);
    expect(texts).toContain('↺');
  });
```

`scene.test.ts`: replace `'draws the wind layers in Windy Ridge, and no layers anywhere else'` with:

```ts
  it('draws both kits in Two at Once, and gives each its own gauge', () => {
    const driver = createDriver({ book: {}, startLevel: 'two-at-once-1' });
    driver.act({ kind: 'tray', index: 0 }); // 3 on the 4
    driver.act({ kind: 'select', kit: 1 });
    driver.act({ kind: 'tray', index: 3 }); // 3 on the 5
    driver.act({ kind: 'letGo' });
    while (driver.phase === 'flying') driver.step(FRAME);
    const { texts } = render(driver);
    expect(texts).toEqual(expect.arrayContaining(['4', '5', '3 / 4', '1 more!', '3 / 5', '2 more!']));
  });

  it('lifts the kit as the count climbs towards its weight', () => {
    const driver = createDriver({ book: {}, startLevel: 'whoosh-1' });
    driver.act({ kind: 'tray', index: 1 }); // 4
    driver.act({ kind: 'tray', index: 2 }); // 3: 7, the weight
    driver.act({ kind: 'letGo' });
    const count = driver.flight!.count;
    const scene = createScene();
    while (driver.flight && driver.flight.t < count * 0.9) {
      scene.observe(driver.step(FRAME));
      scene.update(FRAME, driver.model());
    }
    const recording = recordingContext();
    scene.render(recording.ctx, SCREEN);
    expect(recording.translations.some((at) => at.x === HOME.x && at.y < HOME.y - 30)).toBe(true);
  });

  it('draws the start-over button', () => {
    expect(render(createDriver({ book: {}, startLevel: 'whoosh-1' })).texts).toContain('↺');
  });
```

with `import { HOME } from './geometry.js';`. In `'draws a dragged balloon under the finger…'` nothing changes (a tray drag).

- [ ] **Step 2: Run to see them fail**

Run: `npx vitest run games/balloon/src/view`
Expected: FAIL — `homeOf`, `dropKit`, `drawResetButton`, `drawSelectRing` and the new `flightPose` signature do not exist.

- [ ] **Step 3: Replace `geometry.ts`**

```ts
// games/balloon/src/view/geometry.ts
import type { Point } from '@bundle/core';
import type { Intent } from '../intent.js';
import { DEFAULT_HOOKS, hooksOf, kitsOf, type RescueDef } from '../logic/rescue-def.js';
import { clippedOn, hooksUsed, trayTaken, type RescueState } from '../logic/rescue.js';

/** Where everything sits, in design coordinates. */
export const LAYOUT = {
  /** The top bar: rescue number left, chapter centre, stars right. */
  hudY: 46,
  /** The story line, under the chapter. */
  lineY: 104,
  /** Where the kits' feet stand. */
  groundY: 560,
  homeX: 300,
  /** Two at Once: where the two kits stand. */
  pairX: [250, 600],
  /** The top of the ledge, up and to the left. */
  ledgeY: 262,
  /** That cliff's edge. */
  cliffEdgeX: 220,
  /** How far apart two kits stand once they are on the ledge. */
  ledgeGap: 95,
  /** Centre line of the tray strip along the bottom. */
  trayY: 690,
  trayLeft: 50,
  trayRight: 890,
  button: { left: 912, top: 626, width: 210, height: 116 },
  /** ↺ Start over: a smaller round button above "Let go!". */
  reset: { x: 1017, y: 574, radius: 36 },
  /** From the feet up to the ring the balloon strings tie to. */
  harnessHeight: 118,
  /** How far below its balloon's place a popped scrap hangs. */
  limpDrop: 40,
  /** How far from a bunch a dragged balloon can be dropped and still clip on. */
  dropReach: 290,
  /** How near the middle of a kit a tap must be to select it. */
  kitReach: 56,
} as const;

export const HOME: Point = { x: LAYOUT.homeX, y: LAYOUT.groundY };

/** A 1 is small and a 10 is big; a 6 and a 7 are nearly the same, so read the number. */
export const balloonRadius = (value: number): number => 20 + (Math.min(10, Math.max(1, value)) - 1) * 2.8;

/** Where a kit stands: home for a lone kit, side by side for two. */
export const homeOf = (def: RescueDef, kit: number): Point =>
  kitsOf(def) > 1 ? { x: LAYOUT.pairX[kit] ?? LAYOUT.homeX, y: LAYOUT.groundY } : HOME;

/** Where a kit stands on the ledge once rescued: the second beside the first. */
export const ledgeSpot = (_def: RescueDef, kit = 0): Point => ({
  x: LAYOUT.cliffEdgeX - 80 - kit * LAYOUT.ledgeGap,
  y: LAYOUT.ledgeY,
});

/** Where the rope from a tied bunch is pegged down, beside the kit. */
export const pegPoint = (feet: Point): Point => ({ x: feet.x + 50, y: feet.y + 6 });

export const harnessPoint = (at: Point): Point => ({ x: at.x, y: at.y - LAYOUT.harnessHeight });

/** Where the balloon on harness slot `slot` of `count` floats, for a kit standing at `at`. */
export function bunchPoint(slot: number, count: number, at: Point): Point {
  const spread = Math.min(64, 320 / Math.max(1, count));
  const offset = slot - (count - 1) / 2;
  return { x: at.x + offset * spread, y: at.y - LAYOUT.harnessHeight - 104 - (slot % 2) * 46 };
}

/** Where a popped balloon's scrap hangs, below the place the balloon was. */
export const limpPoint = (at: Point): Point => ({ x: at.x, y: at.y + LAYOUT.limpDrop });

/**
 * How many places a kit's bunch is laid out for. A limited harness is laid out
 * for all its hooks from the start, so the free ones can be drawn as empty clips
 * and the limit is seen rather than discovered.
 */
export const bunchCount = (state: RescueState, kit = 0): number =>
  hooksOf(state.def) < DEFAULT_HOOKS ? hooksOf(state.def) : hooksUsed(state, kit);

/**
 * Tray balloons are packed by their own widths rather than spaced evenly, so a
 * row of big ones still fits and a pair of small ones does not drift apart. A
 * short tray is spread a little, never more than half again.
 */
export function trayPoint(def: RescueDef, index: number): Point {
  const widths = def.tray.map((value) => 2 * balloonRadius(value) + 10);
  const total = widths.reduce((sum, width) => sum + width, 0);
  const room = LAYOUT.trayRight - LAYOUT.trayLeft;
  const scale = Math.min(1.5, room / Math.max(1, total));
  const before = widths.slice(0, index).reduce((sum, width) => sum + width, 0);
  const start = LAYOUT.trayLeft + (room - total * scale) / 2;
  return { x: start + scale * (before + (widths[index] ?? 0) / 2), y: LAYOUT.trayY - 10 };
}

/** The kit a dragged balloon dropped here clips to: the nearer bunch within reach, above the tray. */
export function dropKit(point: Point, def: RescueDef): number | null {
  if (point.y >= LAYOUT.trayY - 80) return null;
  let best: { kit: number; distance: number } | null = null;
  for (let kit = 0; kit < kitsOf(def); kit += 1) {
    const home = homeOf(def, kit);
    const distance = Math.hypot(point.x - home.x, point.y - (home.y - LAYOUT.harnessHeight - 120));
    if (distance <= LAYOUT.dropReach && (best === null || distance < best.distance)) best = { kit, distance };
  }
  return best?.kit ?? null;
}

/** Over the tray strip, where a clipped balloon dropped comes off. */
export const inTray = (point: Point): boolean =>
  point.y >= LAYOUT.trayY - 80 && point.x >= LAYOUT.trayLeft - 20 && point.x <= LAYOUT.trayRight + 20;

const near = (point: Point, centre: Point, radius: number): boolean =>
  (point.x - centre.x) ** 2 + (point.y - centre.y) ** 2 <= radius * radius;

/**
 * What a tap at `point` means while building. Generous circles, because a
 * six-year-old's finger is not a mouse; the bunches are searched before the
 * kits and the tray because they are drawn on top.
 */
export function hitTest(point: Point, state: RescueState): Intent | null {
  const { left, top, width, height } = LAYOUT.button;
  if (point.x >= left && point.x <= left + width && point.y >= top && point.y <= top + height) return { kind: 'letGo' };
  if (near(point, LAYOUT.reset, LAYOUT.reset.radius + 6)) return { kind: 'reset' };

  const def = state.def;
  for (let kit = kitsOf(def) - 1; kit >= 0; kit -= 1) {
    const home = homeOf(def, kit);
    const tied = kit === 0 ? state.tied : [];
    const clipped = clippedOn(state, kit);
    const count = bunchCount(state, kit);
    for (let slot = tied.length + clipped.length - 1; slot >= 0; slot -= 1) {
      const balloon = tied[slot];
      const value = balloon?.value ?? clipped[slot - tied.length]?.value ?? 1;
      const place = bunchPoint(slot, count, home);
      // A popped balloon is tapped where its scrap hangs, not where it used to float.
      const hit = balloon?.popped ? near(point, limpPoint(place), 36) : near(point, place, balloonRadius(value) + 8);
      if (!hit) continue;
      return balloon ? { kind: 'tied', index: slot } : { kind: 'clipped', kit, slot: slot - tied.length };
    }
  }

  if (kitsOf(def) > 1) {
    for (let kit = 0; kit < kitsOf(def); kit += 1) {
      const home = homeOf(def, kit);
      if (near(point, { x: home.x, y: home.y - 55 }, LAYOUT.kitReach)) return { kind: 'select', kit };
    }
  }

  // A squeezed tray lets neighbouring tap circles overlap, so the nearest
  // centre wins rather than whichever balloon happens to come first.
  const candidates: Array<{ intent: Intent; distance: number }> = [];
  def.tray.forEach((value, index) => {
    if (trayTaken(state, index)) return;
    const centre = trayPoint(def, index);
    const distance = Math.hypot(point.x - centre.x, point.y - centre.y);
    if (distance <= balloonRadius(value) + 10) candidates.push({ intent: { kind: 'tray', index }, distance });
  });
  candidates.sort((a, b) => a.distance - b.distance);
  return candidates[0]?.intent ?? null;
}
```

- [ ] **Step 4: Replace `flight.ts`**

```ts
// games/balloon/src/view/flight.ts
import type { Point } from '@bundle/core';
import type { Outcome } from '../logic/outcome.js';
import { LAYOUT } from './geometry.js';

export type Mood = 'calm' | 'strain' | 'wheee' | 'happy';

export interface Pose {
  at: Point;
  parachute: boolean;
  mood: Mood;
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));
const ease = (t: number): number => t * t * (3 - 2 * t);
const lerp = (from: number, to: number, t: number): number => from + (to - from) * t;
/** How far through the stretch from `from` to `to` the clock is, 0..1. */
const during = (t: number, from: number, to: number): number => clamp01((t - from) / (to - from));

/**
 * Where a kit is, `t` of the way through its flight, given where it stands and
 * where it would land. A function of the outcome and nothing else, so the flight
 * is drawn from state rather than simulated — a flight can never disagree with
 * the verdict it shows.
 */
export function flightPose(outcome: Outcome, rawT: number, home: Point, spot: Point): Pose {
  const t = clamp01(rawT);

  if (outcome.verdict === 'short') {
    // A strain and a hop: how nearly there it was shows in how high the hop is.
    const through = clamp01(t / 0.8);
    const height = through >= 1 ? 0 : Math.sin(Math.PI * through) * (8 + 32 * clamp01(outcome.have / outcome.need));
    return { at: { x: home.x, y: home.y - height }, parachute: false, mood: 'strain' };
  }

  if (outcome.verdict === 'over') {
    // Whoosh past the ledge and off the top, then a parachute home.
    if (t < 0.45) {
      const up = ease(during(t, 0, 0.35));
      return { at: { x: home.x + Math.sin(t * 14) * 6, y: lerp(home.y, -200, up) }, parachute: false, mood: 'wheee' };
    }
    const down = ease(during(t, 0.45, 1));
    return { at: { x: home.x, y: lerp(-150, home.y, down) }, parachute: true, mood: 'calm' };
  }

  // Just right: up to the ledge's height, where the breeze carries the kit
  // across onto the cliff.
  const hover = LAYOUT.ledgeY - 14;
  const rise = ease(during(t, 0, 0.62));
  const carry = ease(during(t, 0.64, 1));
  return {
    at: { x: lerp(home.x, spot.x, carry), y: lerp(lerp(home.y, hover, rise), spot.y, carry) },
    parachute: false,
    mood: t >= 1 ? 'happy' : 'calm',
  };
}
```

- [ ] **Step 5: Update the art and the gauge**

In `art.ts`: delete `drawWindLayers` and the `LAYERS` / `layerY` imports, and add:

```ts
/** The ring at a kit's feet that says a tapped balloon will go to this one. */
export function drawSelectRing(ctx: CanvasRenderingContext2D, feet: Point): void {
  ctx.save();
  ctx.strokeStyle = 'rgba(255,206,80,0.95)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.ellipse(feet.x, feet.y + 4, 60, 16, 0, 0, TAU);
  ctx.stroke();
  ctx.restore();
}

/** ↺ Start over: puts the rescue back as it opened. Dimmed when there is nothing to undo. */
export function drawResetButton(ctx: CanvasRenderingContext2D, enabled: boolean): void {
  const { x, y, radius } = LAYOUT.reset;
  ctx.save();
  ctx.globalAlpha = enabled ? 1 : 0.45;
  ctx.fillStyle = enabled ? '#5a9fd6' : '#b9c2cc';
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, TAU);
  ctx.fill();
  ctx.font = hand(700, 40);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('↺', x, y + 2);
  ctx.restore();
}
```

In `hud.ts` replace `drawGauge` with:

```ts
/**
 * After a wrong try: what a kit had over what it needed, and the gap in words.
 * Beside a lone kit, where the child is already looking; above each kit, smaller,
 * when there are two.
 */
export function drawGauge(
  ctx: CanvasRenderingContext2D,
  outcome: Outcome,
  centre: Point = { x: HOME.x + 340, y: HOME.y - 250 },
  small = false,
): void {
  const width = small ? 210 : 300;
  const height = small ? 100 : 140;
  ctx.save();
  ctx.fillStyle =
    outcome.verdict === 'exact' ? 'rgba(92,184,92,0.95)' : outcome.verdict === 'short' ? 'rgba(90,150,220,0.95)' : 'rgba(240,123,95,0.95)';
  ctx.beginPath();
  ctx.roundRect?.(centre.x - width / 2, centre.y - height / 2, width, height, 24);
  ctx.fill();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = hand(700, small ? 22 : 30);
  ctx.fillText(gaugeText(outcome), centre.x, centre.y - (small ? 20 : 28));
  ctx.fillStyle = '#ffffff';
  ctx.font = hand(700, small ? 34 : 46);
  ctx.fillText(feedbackLine(outcome), centre.x, centre.y + (small ? 16 : 22));
  ctx.restore();
}
```

- [ ] **Step 6: Replace `scene.ts`**

```ts
// games/balloon/src/view/scene.ts
import { drawArrivingBanner, fitToScreen, visibleBounds, type Point, type Size } from '@bundle/core';
import type { DriverEvent, SceneModel } from '../driver.js';
import { kitsOf, weightsOf } from '../logic/rescue-def.js';
import { answerLines, canLetGo, canStartOver, clippedOn, liftedSlots, trayTaken, type RescueState } from '../logic/rescue.js';
import {
  drawBalloon,
  drawBreeze,
  drawButton,
  drawCliff,
  drawEmptyClip,
  drawFox,
  drawGround,
  drawParachute,
  drawPopBurst,
  drawResetButton,
  drawRope,
  drawSelectRing,
  drawSky,
  drawString,
  drawTrayShelf,
} from './art.js';
import { flightPose, type Pose } from './flight.js';
import { bunchCount, bunchPoint, harnessPoint, homeOf, LAYOUT, ledgeSpot, limpPoint, trayPoint } from './geometry.js';
import { drawCount, drawFinished, drawGauge, drawSolved, drawStars, drawTopBar } from './hud.js';
import { TIMING } from './timing.js';

export interface Scene {
  update(dt: number, model: SceneModel): void;
  /** What just happened, so the scene can react. State stays the driver's. */
  observe(events: readonly DriverEvent[]): void;
  render(ctx: CanvasRenderingContext2D, screen: Size): void;
  toDesign(point: Point, screen: Size): Point;
  /** A balloon being dragged, drawn under the finger; null when nothing is. */
  setDrag(drag: Drag | null): void;
}

/** A balloon being dragged: where it came from, its value, and where the finger is. */
export interface Drag {
  from: { kind: 'tray'; index: number } | { kind: 'clipped'; kit: number; slot: number };
  value: number;
  at: Point;
}

/** How far a kit has risen by the end of the count when its total reaches its weight. */
export const COUNT_RISE = 44;

interface Burst {
  at: Point;
  value: number;
  life: number;
}

const sum = (values: readonly number[]): number => values.reduce((total, value) => total + value, 0);

/** The count, kit by kit: the balloon lit now, and each kit's running total. */
interface CountNow {
  kit: number;
  index: number;
  totals: number[];
  done: boolean[];
}

function countNow(model: SceneModel): CountNow | null {
  const flight = model.flight;
  if (model.phase !== 'flying' || !flight || flight.t >= flight.count) return null;
  const all = flight.lifted.flatMap((values, kit) => values.map((value, index) => ({ kit, index, value })));
  if (all.length === 0) return null;
  const step = Math.min(all.length - 1, Math.floor(flight.t / (flight.count / all.length)));
  const totals = flight.lifted.map(() => 0);
  for (const entry of all.slice(0, step + 1)) totals[entry.kit] = (totals[entry.kit] ?? 0) + entry.value;
  const current = all[step]!;
  const done = flight.lifted.map((values, kit) =>
    kit < current.kit || (kit === current.kit && current.index === values.length - 1),
  );
  return { kit: current.kit, index: current.index, totals, done };
}

/** How high the count has lifted a kit: in proportion to its total over its weight. */
const countLift = (total: number, weight: number): number => COUNT_RISE * Math.min(1, total / Math.max(1, weight));

/** Where a kit is and how it looks, from the model alone. */
function poseOf(model: SceneModel, kit: number): Pose {
  const def = model.rescue.def;
  const home = homeOf(def, kit);
  const spot = ledgeSpot(def, kit);
  if (model.phase === 'rescued' || model.phase === 'finished') return { at: spot, parachute: false, mood: 'happy' };

  const weight = weightsOf(def)[kit] ?? def.weight;
  const flight = model.flight;
  if (model.phase === 'flying' && flight) {
    if (flight.t < flight.count) {
      const total = countNow(model)?.totals[kit] ?? 0;
      return { at: { x: home.x, y: home.y - countLift(total, weight) }, parachute: false, mood: 'calm' };
    }
    const outcome = flight.outcomes[kit];
    if (!outcome) return { at: home, parachute: false, mood: 'calm' };
    const flyT = (flight.t - flight.count) / flight.fly;
    const pose = flightPose(outcome, flyT, home, spot);
    // Carry on from where the count left the kit, rather than snapping back to the ground.
    const carried = countLift(sum(flight.lifted[kit] ?? []), weight) * Math.max(0, 1 - flyT / 0.25);
    return { ...pose, at: { x: pose.at.x, y: pose.at.y - carried } };
  }
  const verdict = model.feedback?.[kit]?.verdict;
  return { at: home, parachute: false, mood: verdict === 'short' ? 'strain' : 'calm' };
}

function drawBunch(
  ctx: CanvasRenderingContext2D,
  state: RescueState,
  kit: number,
  at: Point,
  lit: number,
  showFree: boolean,
  hide: number,
): void {
  const count = bunchCount(state, kit);
  const ring = harnessPoint(at);
  const tied = kit === 0 ? state.tied : [];
  const values = [...tied.map((balloon) => balloon.value), ...clippedOn(state, kit).map((taken) => taken.value)];
  values.forEach((value, slot) => {
    if (slot === hide) return;
    const point = bunchPoint(slot, count, at);
    const limp = tied[slot]?.popped ?? false;
    drawString(ctx, ring, limp ? { x: point.x, y: limpPoint(point).y - 14 } : point);
    drawBalloon(ctx, point, value, { limp, glow: slot === lit ? 1 : 0 });
  });
  if (!showFree) return;
  for (let slot = values.length; slot < count; slot += 1) drawEmptyClip(ctx, ring, bunchPoint(slot, count, at));
}

export function createScene(): Scene {
  let model: SceneModel | null = null;
  let banner: { title: string; life: number } | null = null;
  let rescuedFor = 0;
  let clock = 0;
  let drag: Drag | null = null;
  const bursts: Burst[] = [];

  return {
    observe(events) {
      for (const event of events) {
        if (event.type === 'chapter') banner = { title: event.chapter.title, life: 0 };
        if (event.type === 'popped' && model) {
          const at = bunchPoint(event.index, bunchCount(model.rescue, 0), homeOf(model.rescue.def, 0));
          bursts.push({ at, value: event.value, life: 0 });
        }
        if (event.type === 'rescued') rescuedFor = 0;
      }
    },

    update(dt, next) {
      model = next;
      clock += dt;
      if (next.phase === 'rescued') rescuedFor += dt;
      if (banner) {
        banner.life += dt;
        if (banner.life > TIMING.chapterAnnounceSeconds) banner = null;
      }
      for (const burst of bursts) burst.life += dt;
      while (bursts.length > 0 && bursts[0]!.life > TIMING.popSeconds) bursts.shift();
    },

    render(ctx, screen) {
      const current = model;
      if (!current) return;
      const transform = fitToScreen(screen);
      const bounds = visibleBounds(screen, transform);
      const state = current.rescue;
      const def = state.def;
      const kits = kitsOf(def);
      const weights = weightsOf(def);
      const building = current.phase === 'building';
      const count = countNow(current);

      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.translate(transform.offsetX, transform.offsetY);
      ctx.scale(transform.scale, transform.scale);

      drawSky(ctx, bounds);
      drawCliff(ctx, bounds, 'left', LAYOUT.cliffEdgeX);
      drawBreeze(ctx, bounds, clock);
      drawGround(ctx, bounds);

      for (let kit = 0; kit < kits; kit += 1) {
        const home = homeOf(def, kit);
        const pose = poseOf(current, kit);
        if (building && kit === 0 && state.tied.length > 0) drawRope(ctx, home);
        if (building && kits > 1 && kit === current.selected) drawSelectRing(ctx, home);
        if (pose.parachute) {
          drawParachute(ctx, pose.at);
        } else if (current.phase === 'rescued' || current.phase === 'finished') {
          // Safe on the ledge, the kit lets the bunch go: it rises away rather
          // than sitting over the top bar, which is where it would be otherwise.
          const rise = rescuedFor * TIMING.releaseRise;
          if (rise < TIMING.releaseGone) drawBunch(ctx, state, kit, { x: pose.at.x, y: pose.at.y - rise }, -1, false, -1);
        } else {
          const lit = count && count.kit === kit ? liftedSlots(state, kit)[count.index] ?? -1 : -1;
          const tiedHere = kit === 0 ? state.tied.length : 0;
          const hide = drag?.from.kind === 'clipped' && drag.from.kit === kit ? tiedHere + drag.from.slot : -1;
          drawBunch(ctx, state, kit, pose.at, lit, building, hide);
        }
        drawFox(ctx, pose.at, { weight: weights[kit] ?? def.weight, mood: pose.mood, bob: clock * 0.8 });
      }
      for (const burst of bursts) drawPopBurst(ctx, burst.at, burst.value, burst.life / TIMING.popSeconds);

      drawTrayShelf(ctx);
      def.tray.forEach((value, index) => {
        const lifted = drag?.from.kind === 'tray' && drag.from.index === index;
        if (!trayTaken(state, index) && !lifted) drawBalloon(ctx, trayPoint(def, index), value);
      });
      drawButton(ctx, building && canLetGo(state));
      drawResetButton(ctx, building && canStartOver(state));
      if (drag && building) drawBalloon(ctx, drag.at, drag.value);

      drawTopBar(ctx, {
        title: current.chapter.title,
        number: current.number,
        count: current.chapter.rescues.length,
        line: def.line,
        totalStars: current.totalStars,
      });

      if (count) {
        for (let kit = 0; kit < kits; kit += 1) {
          const total = count.totals[kit] ?? 0;
          if (total === 0) continue;
          const home = homeOf(def, kit);
          const at = kits > 1 ? { x: home.x, y: 190 } : { x: HOME_COUNT.x, y: HOME_COUNT.y };
          drawCount(ctx, count.done[kit] ? `${total}!` : `${total}…`, at);
        }
      }
      if (building && current.feedback) {
        if (kits > 1) {
          current.feedback.forEach((outcome, kit) => drawGauge(ctx, outcome, { x: homeOf(def, kit).x, y: 185 }, true));
        } else if (current.feedback[0]) {
          drawGauge(ctx, current.feedback[0]);
        }
      }
      if (current.phase === 'rescued') {
        drawSolved(ctx, answerLines(state), rescuedFor / TIMING.solvedSeconds);
        if (rescuedFor >= TIMING.starsDelaySeconds) {
          drawStars(ctx, current.earned ?? 0, (rescuedFor - TIMING.starsDelaySeconds) / TIMING.starSeconds);
        }
      }
      if (banner) {
        drawArrivingBanner(ctx, banner.title, banner.life / TIMING.chapterAnnounceSeconds, TIMING.chapterSettleFraction, LAYOUT.hudY);
      }
      if (current.phase === 'finished') drawFinished(ctx, current.totalStars, current.maxStars);

      ctx.restore();
    },

    toDesign(point, screen) {
      return fitToScreen(screen).toDesign(point);
    },

    setDrag(next) {
      drag = next;
    },
  };
}

/** Where a lone kit's count is written: up and to the right of it. */
const HOME_COUNT: Point = { x: LAYOUT.homeX + 230, y: LAYOUT.groundY - 320 };
```

- [ ] **Step 7: Run to see them pass**

Run: `npx vitest run games/balloon/src/view && npm run typecheck`
Expected: view tests PASS. Typecheck may still flag `input.ts` until Task 5; nothing else.

- [ ] **Step 8: Commit**

```bash
git add games/balloon/src/view
git commit -m "feat(balloon): two kits on screen, start over, and the kit lifts as the count climbs"
```

---

### Task 5: Input — dropping on a kit, selecting one, and starting over

**Files:**
- Modify: `games/balloon/src/view/input.ts`, `games/balloon/src/view/input.test.ts`

**Interfaces:**
- Consumes: `dropKit`, `inTray`, `hitTest` (Task 4); `Drag` (Task 4); `clippedOn` (Task 2).

- [ ] **Step 1: Write the tests**

In `input.test.ts`:
- `setup` takes the rescue definition as a fifth parameter, `rescueDef: RescueDef = def`, and creates the rescue from it;
- import `homeOf` from `./geometry.js`;
- `'clips a balloon dragged up out of the tray'` now expects `[{ kind: 'tray', index: 1, kit: 0 }]`;
- `'takes a clipped balloon off when it is dragged down into the tray'` now expects `[{ kind: 'clipped', kit: 0, slot: 1 }]`;
- add:

```ts
  const pairDef: RescueDef = { id: 'p', line: '', weight: 4, friend: 5, tray: [3, 1, 2, 3] };

  it('clips a dropped balloon to whichever kit it lands nearest', () => {
    const { canvas, intents, input } = setup(1152, 768, 'building', () => {}, pairDef);
    const at = trayPoint(pairDef, 0);
    const second = homeOf(pairDef, 1);
    pointer(canvas, 'pointerdown', at.x, at.y);
    pointer(canvas, 'pointermove', second.x, 330);
    pointer(canvas, 'pointerup', second.x, 330);
    expect(intents).toEqual([{ kind: 'tray', index: 0, kit: 1 }]);
    input.dispose();
  });

  it('selects a kit with a tap', () => {
    const { canvas, intents, input } = setup(1152, 768, 'building', () => {}, pairDef);
    const second = homeOf(pairDef, 1);
    pointer(canvas, 'pointerdown', second.x, second.y - 55);
    pointer(canvas, 'pointerup', second.x, second.y - 55);
    expect(intents).toEqual([{ kind: 'select', kit: 1 }]);
    input.dispose();
  });

  it('takes a balloon off the second kit when it is dragged into the tray', () => {
    const { canvas, intents, input } = setup(1152, 768, 'building', (rescue) => rescue.clip(0, 1), pairDef);
    const at = bunchPoint(0, 1, homeOf(pairDef, 1));
    pointer(canvas, 'pointerdown', at.x, at.y);
    pointer(canvas, 'pointermove', 500, LAYOUT.trayY);
    pointer(canvas, 'pointerup', 500, LAYOUT.trayY);
    expect(intents).toEqual([{ kind: 'clipped', kit: 1, slot: 0 }]);
    input.dispose();
  });

  it('presses start over', () => {
    const { canvas, intents, input } = setup();
    pointer(canvas, 'pointerdown', LAYOUT.reset.x, LAYOUT.reset.y);
    pointer(canvas, 'pointerup', LAYOUT.reset.x, LAYOUT.reset.y);
    expect(intents).toEqual([{ kind: 'reset' }]);
    input.dispose();
  });
```

- [ ] **Step 2: Run to see them fail**

Run: `npx vitest run games/balloon/src/view/input.test.ts`
Expected: FAIL — drops carry no kit, and `input.ts` still imports `inDropZone`.

- [ ] **Step 3: Implement**

In `input.ts`:
- import `{ dropKit, hitTest, inTray } from './geometry.js'` and `{ clippedOn, type RescueState } from '../logic/rescue.js'`;
- in `dragFrom`, the clipped branch becomes:

```ts
    if (intent?.kind === 'clipped') {
      const value = clippedOn(rescue, intent.kit)[intent.slot]?.value;
      return value === undefined ? null : { from: { kind: 'clipped', kit: intent.kit, slot: intent.slot }, value, at };
    }
```

- in `onPointerUp`, the tray branch becomes:

```ts
    if (down.intent.kind === 'tray') {
      if (!dragged) {
        emit(down.intent);
        return;
      }
      const kit = dropKit(at, rescue.def);
      if (kit !== null) emit({ kind: 'tray', index: down.intent.index, kit });
      return;
    }
```

- [ ] **Step 4: Run everything**

Run: `npm test && npm run typecheck`
Expected: PASS across the bundle, typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add games/balloon/src/view
git commit -m "feat(balloon): drop on a kit, tap to choose one, and start over"
```

---

### Task 6: Play it, and write it down

**Files:**
- Modify: `README.md` (the Balloon Rescue section)

- [ ] **Step 1: Play it in the browser**

Check by eye:
- `?game=balloon&level=pop-1` — pop two, let go, press ↺: everything blown back up, the gauge gone, stars still counting the try.
- `?game=balloon&level=two-at-once-1` — the left kit ringed; tapping balloons clips to it; tapping the right kit moves the ring; dragging a balloon onto either kit clips there; a wrong split shows a gauge over each kit; a right split lands both on the ledge, side by side, with two sums.
- `?game=balloon&level=whoosh-1` — during the count the kit rises with each balloon, nearly floating at 7, and the flight continues from there without a jump.

Fix anything wrong in the file that owns it, with a test where the mistake can be pinned by one.

- [ ] **Step 2: Update the README**

In the Balloon Rescue section, after the paragraph on tapping and dragging add:

```markdown
**↺ Start over** puts the rescue back as it opened — every popped balloon
blown back up, every clipped one back in the tray — keeping the tries. A
popped balloon shows no number, so after a wrong pop a child cannot always tell
which to undo.
```

and in the chapter list replace the Windy Ridge clause with `Two at Once (two kits share one tray, and every balloon is used)`.

- [ ] **Step 3: Final verification**

Run: `npm test && npm run typecheck && npm run build`
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add README.md games/balloon
git commit -m "docs(balloon): start over and Two at Once in the README"
```
