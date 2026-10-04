# Balloon Rescue Playtest Revisions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild Windy Ridge as wind layers (rise exactly lift − weight layers), add a breeze that carries a rescued kit onto the ledge, make dragging move the balloon under the finger, and show popped balloons without a number.

**Architecture:** The rescue's sideways half — puffs, wind push, ledge distance — is removed from the logic and replaced by one optional field, `layer`: the target lift becomes `weight + layer`, and the flight reads how high the kit rose from `lift − weight`. The view gains wind-layer bands, a ledge breeze, and a drag the input owns and the scene draws.

**Tech Stack:** TypeScript (strict, `noUncheckedIndexedAccess`), Vitest, canvas 2D. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-29-balloon-rescue-design.md` — the Windy Ridge, Wind on the ledge, Pop! and Controls sections, and "Revisions after the first playtest (2026-10-01)".

## Global Constraints

- **Three wind layers at most** (`LAYERS = 3`); a layer rescue's `weight + layer` never passes 20.
- **The target is `weight + layer`**; a rescue without `layer` has a target of its weight.
- **In Windy Ridge the tray (with anything tied) always holds a bunch that makes exactly the weight** — the bait.
- **A popped balloon draws no number.** Tapping it still blows it back up.
- **Tapping keeps working exactly as before**; dragging is added, never replaces it.
- **No running total while building**, as before. The gauge in a layer rescue reads `have / weight + layer`.
- **The minus sign is `−` (U+2212).**
- `src/logic/` stays pure; `src/view/` reads state and never writes it.
- Run `npm test` and `npm run typecheck` before every commit. Both must be clean.

## Review Focus

1. **A drag that starts on a tray balloon and ends on the "Let go!" button.** It should neither clip nor press the button: the drop is outside the drop zone. Pinned in Task 5.
2. **A drag of a popped tied balloon.** Tied balloons are tapped, not dragged: a drag on one does nothing visible and emits nothing. Pinned in Task 5.
3. **Saved stars from before this change** for `windy-ridge-*` ids. The ids are unchanged, so old stars still count; a child who had them keeps them. Nothing to change — noted so a reviewer does not "fix" it by renaming ids.
4. **Lift exactly the weight in a layer rescue.** The kit lifts off and settles back with no parachute, and the gauge says how many more. Pinned in Task 3.
5. **Pointer cancelled mid-drag** (an iPad system gesture). The dragged balloon must stop being drawn. Pinned in Task 5.

---

### Task 1: Wind layers in the logic

**Files:**
- Modify (replace whole file): `games/balloon/src/logic/rescue-def.ts`, `games/balloon/src/logic/outcome.ts`, `games/balloon/src/logic/solver.ts`
- Modify: `games/balloon/src/logic/rescue.ts`, `games/balloon/src/logic/levels.data.ts`
- Modify tests: `rescue-def.test.ts`, `outcome.test.ts`, `rescue.test.ts`, `solver.test.ts`, `levels.test.ts`, `guards.test.ts` (all in `games/balloon/src/logic/`)

**Interfaces:**
- Produces from `rescue-def.ts`: `LAYERS = 3`; `RescueDef.layer?: number`; `layerOf(def): number` (0 when absent); `targetOf(def): number` (= weight + layer). Removes `WindDef`, `acrossNeed`, `PUFF_MIN`, `PUFF_MAX`, `RescueDef.wind`.
- Produces from `outcome.ts`: `interface Outcome { verdict: Verdict; have: number; need: number; weight: number; layer: number }`; `judge(lift, weight, layer = 0): Outcome`. Removes `axis`.
- Produces from `rescue.ts`: the same API minus `puff`, `unpuff`, `puffTotal`, `puffTaken`, `RescueState.puffs`, and the `puffed`/`unpuffed` events.
- Produces from `solver.ts`: `interface Answer { clip: number[]; pop: number[] }`.

This task leaves the view and driver not compiling until Task 2; run only the logic tests until then.

- [ ] **Step 1: Rewrite the logic tests**

`rescue-def.test.ts` — replace the whole file:

```ts
// games/balloon/src/logic/rescue-def.test.ts
import { describe, it, expect } from 'vitest';
import { hooksOf, layerOf, problemsWith, targetOf, tiedOf, type RescueDef } from './rescue-def.js';

const plain: RescueDef = { id: 'x', line: 'x', weight: 8, tray: [5, 3] };

describe('a rescue definition', () => {
  it('has six hooks and nothing tied unless it says otherwise', () => {
    expect(hooksOf(plain)).toBe(6);
    expect(tiedOf(plain)).toEqual([]);
    expect(hooksOf({ ...plain, hooks: 2 })).toBe(2);
  });

  it('asks for its weight, plus a layer of lift for every wind layer up', () => {
    expect(layerOf(plain)).toBe(0);
    expect(targetOf(plain)).toBe(8);
    expect(targetOf({ ...plain, weight: 7, layer: 3 })).toBe(10);
  });

  it('finds nothing wrong with a sound rescue', () => {
    expect(problemsWith(plain)).toEqual([]);
    expect(problemsWith({ ...plain, layer: 3 })).toEqual([]);
  });

  it('rejects numbers outside the ranges the game draws', () => {
    expect(problemsWith({ ...plain, weight: 21 })).not.toEqual([]);
    expect(problemsWith({ ...plain, tray: [11] })).not.toEqual([]);
    expect(problemsWith({ ...plain, tray: [0] })).not.toEqual([]);
    expect(problemsWith({ ...plain, hooks: 7 })).not.toEqual([]);
  });

  it('rejects a layer that is not one of the three, and a target past twenty', () => {
    expect(problemsWith({ ...plain, layer: 0 })).not.toEqual([]);
    expect(problemsWith({ ...plain, layer: 4 })).not.toEqual([]);
    expect(problemsWith({ ...plain, weight: 18, layer: 3 })).not.toEqual([]);
  });

  it('rejects more tied balloons than hooks', () => {
    expect(problemsWith({ ...plain, hooks: 2, tied: [1, 1, 1] })).not.toEqual([]);
  });
});
```

`outcome.test.ts` — replace the whole file:

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

  it('asks for the weight, plus the layers when the ledge is up in the wind', () => {
    expect(judge(8, 8)).toEqual({ verdict: 'exact', have: 8, need: 8, weight: 8, layer: 0 });
    expect(judge(10, 7, 3)).toEqual({ verdict: 'exact', have: 10, need: 10, weight: 7, layer: 3 });
    expect(judge(7, 7, 3).verdict).toBe('short');
  });

  it('says how far off it was, in the words the child reads', () => {
    expect(feedbackLine(judge(6, 8))).toBe('2 more!');
    expect(feedbackLine(judge(11, 8))).toBe('3 too many!');
    expect(feedbackLine(judge(9, 7, 3))).toBe('1 more!');
    expect(feedbackLine(judge(8, 8))).toBe('Just right!');
  });

  it('writes the gauge as what you had over what you needed, the layers as a sum', () => {
    expect(gaugeText(judge(6, 8))).toBe('6 / 8');
    expect(gaugeText(judge(9, 7, 3))).toBe('9 / 7 + 3');
  });
});
```

`rescue.test.ts` — three edits:

Replace the expectation in `'counts a wrong try and leaves the bunch exactly as it was'`:

```ts
    expect(event).toEqual({
      type: 'released',
      outcome: { verdict: 'over', have: 11, need: 8, weight: 8, layer: 0 },
      tries: 1,
    });
```

Replace the test `'judges the wind: its push plus the puffs must reach the ledge'` with:

```ts
  it('asks for weight plus layers when the ledge is up in the wind', () => {
    const def: RescueDef = { id: 'w', line: '', weight: 7, tray: [5, 3, 2, 4], layer: 3 };
    const floatsOnly = createRescue(def);
    floatsOnly.clip(0);
    floatsOnly.clip(2); // 5 + 2: exactly the weight, the old habit
    expect(floatsOnly.letGo()[0]).toEqual({
      type: 'released',
      outcome: { verdict: 'short', have: 7, need: 10, weight: 7, layer: 3 },
      tries: 1,
    });

    const right = createRescue(def);
    right.clip(0);
    right.clip(1);
    right.clip(2);
    expect(right.letGo()[0]).toMatchObject({ outcome: { verdict: 'exact' } });
  });
```

Replace the test `'writes the sideways sum with the wind in it, either way it blows'` with:

```ts
  it('writes the bunch, then the weight and the layers, when the ledge is up in the wind', () => {
    const rescue = createRescue({ id: 'w', line: '', weight: 7, tray: [5, 3, 2], layer: 3 });
    rescue.clip(0);
    rescue.clip(1);
    rescue.clip(2);
    expect(answerLines(rescue.state)).toEqual(['5 + 3 + 2 = 10', '7 + 3 = 10']);
  });
```

And in `'ignores slots and tray places that do not exist'` delete the line `expect(rescue.puff(0)).toEqual([]);`.

`solver.test.ts` — three edits:

In `'pops tied balloons when it must'`: `expect(solve(def)).toEqual([{ clip: [], pop: [1] }]);`

Replace `'only accepts puffs that land on the ledge'` with:

```ts
  it('aims at weight plus layers', () => {
    const def: RescueDef = { id: 'w', line: '', weight: 7, tray: [5, 4, 3, 2], layer: 3 };
    const answers = solve(def);
    expect(answers.length).toBeGreaterThan(0);
    for (const answer of answers) expect(totalAt(def.tray, answer.clip)).toBe(10);
  });
```

(add `totalAt` to the import from `./solver.js`), and in `'gives answers that really do rescue'` delete the line `answer.puffs.forEach((index) => rescue.puff(index));`.

`guards.test.ts` — replace the file's imports and two bots:

```ts
// games/balloon/src/logic/guards.test.ts  (top of file through randomStars)
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
```

and in `'a bot that works the sum out…'` delete `answer.puffs.forEach((index) => rescue.puff(index));`.

`levels.test.ts` — imports become:

```ts
import { DEFAULT_HOOKS, hooksOf, layerOf, LAYERS, problemsWith, targetOf, tiedOf, type RescueDef } from './rescue-def.js';
```

In `'asks for a weight in its chapter\'s range'` use `targetOf(rescue)` for both bounds and rename it `'asks for a target in its chapter\'s range'`.

Delete `'needs between 3 and 10 steps of puffs whenever there is wind'`.

In `'can be answered by one matching balloon only in the very first rescue'`: `const matches = (rescue: RescueDef) => tiedOf(rescue).length === 0 && rescue.tray.includes(targetOf(rescue));`

Replace the two Windy Ridge tests with:

```ts
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
```

In `'every rescue in The Big Rescue needs two ideas at once'` replace `Boolean(rescue.wind)` with `layerOf(rescue) > 0`.

- [ ] **Step 2: Run the logic tests and watch them fail**

Run: `npx vitest run games/balloon/src/logic`
Expected: FAIL — `layerOf`, `targetOf` and `LAYERS` are not exported, and outcomes still carry `axis`.

- [ ] **Step 3: Replace `rescue-def.ts`**

```ts
// games/balloon/src/logic/rescue-def.ts
export const BALLOON_MIN = 1;
export const BALLOON_MAX = 10;
export const WEIGHT_MAX = 20;
export const DEFAULT_HOOKS = 6;
/** Wind layers over Windy Ridge. Three, so a kit on the top one is still on screen. */
export const LAYERS = 3;

/** One rescue is one question. */
export interface RescueDef {
  id: string;
  /** What is happening, told as a story rather than as the mechanic. */
  line: string;
  weight: number;
  /** Balloons waiting to be clipped on. The tray is the level design. */
  tray: readonly number[];
  /** Balloons already on the harness when the rescue opens. Tapping one pops it. */
  tied?: readonly number[];
  hooks?: number;
  /**
   * Windy Ridge: the ledge is this many wind layers up. The kit rises lift minus
   * weight layers, so the lift it needs is the weight plus this.
   */
  layer?: number;
}

export interface ChapterDef {
  id: string;
  title: string;
  /** The lift this chapter's rescues may ask for: weight, plus any layers. */
  targets: readonly [number, number];
  rescues: readonly RescueDef[];
}

export const hooksOf = (def: RescueDef): number => def.hooks ?? DEFAULT_HOOKS;
export const tiedOf = (def: RescueDef): readonly number[] => def.tied ?? [];
export const layerOf = (def: RescueDef): number => def.layer ?? 0;
/** The lift that rescues: the weight, plus one for every layer up. */
export const targetOf = (def: RescueDef): number => def.weight + layerOf(def);

const whole = (value: number, low: number, high: number): boolean =>
  Number.isInteger(value) && value >= low && value <= high;

/** Everything wrong with a rescue's numbers; empty when it is sound. */
export function problemsWith(def: RescueDef): string[] {
  const problems: string[] = [];
  if (!whole(def.weight, 1, WEIGHT_MAX)) problems.push(`weight ${def.weight}`);
  for (const value of [...def.tray, ...tiedOf(def)]) {
    if (!whole(value, BALLOON_MIN, BALLOON_MAX)) problems.push(`balloon ${value}`);
  }
  if (!whole(hooksOf(def), 1, DEFAULT_HOOKS)) problems.push(`hooks ${hooksOf(def)}`);
  if (tiedOf(def).length > hooksOf(def)) problems.push('more tied balloons than hooks');
  if (def.layer !== undefined && !whole(def.layer, 1, LAYERS)) problems.push(`layer ${def.layer}`);
  if (targetOf(def) > WEIGHT_MAX) problems.push(`target ${targetOf(def)}`);
  return problems;
}
```

- [ ] **Step 4: Replace `outcome.ts`**

```ts
// games/balloon/src/logic/outcome.ts
export type Verdict = 'short' | 'exact' | 'over';

/**
 * What letting go did. The weight and layers are kept beside the target so the
 * gauge can write it as the sum it is, and the flight can tell how high the kit
 * rose: lift minus weight.
 */
export interface Outcome {
  verdict: Verdict;
  have: number;
  need: number;
  weight: number;
  layer: number;
}

export const verdictOf = (have: number, need: number): Verdict =>
  have < need ? 'short' : have > need ? 'over' : 'exact';

export function judge(lift: number, weight: number, layer = 0): Outcome {
  const need = weight + layer;
  return { verdict: verdictOf(lift, need), have: lift, need, weight, layer };
}

/** The gap in words: the teaching half of a wrong try. */
export function feedbackLine(outcome: Outcome): string {
  if (outcome.verdict === 'exact') return 'Just right!';
  const gap = Math.abs(outcome.need - outcome.have);
  return outcome.verdict === 'short' ? `${gap} more!` : `${gap} too many!`;
}

export const gaugeText = (outcome: Outcome): string =>
  outcome.layer > 0
    ? `${outcome.have} / ${outcome.weight} + ${outcome.layer}`
    : `${outcome.have} / ${outcome.need}`;
```

- [ ] **Step 5: Edit `rescue.ts`**

- Imports: `import { hooksOf, layerOf, targetOf, tiedOf, type RescueDef } from './rescue-def.js';`
- `RescueState`: delete the `puffs: Taken[];` field, and `puffs: [],` from `createRescue`'s initial state.
- `RescueEvent`: delete the `puffed` and `unpuffed` members.
- `Rescue`: delete `puff` and `unpuff`; delete their implementations in `createRescue`.
- Delete `puffTotal` and `puffTaken`.
- `outcomeOf` becomes:

```ts
export const outcomeOf = (state: RescueState): Outcome =>
  judge(liftOf(state), state.def.weight, layerOf(state.def));
```

- `answerLines` becomes:

```ts
/**
 * The sum the rescue made, written out for the moment it lands. That beat is
 * the teaching: the child sees their bunch turned into arithmetic. A pop is
 * written as taking away, and a climb into the wind as the weight plus layers.
 */
export function answerLines(state: RescueState): string[] {
  const popped = state.tied.filter((balloon) => balloon.popped).map((balloon) => balloon.value);
  const lifted = liftedValues(state);
  const target = targetOf(state.def);
  const lines: string[] = [];

  if (popped.length > 0) {
    const whole = total(state.tied.map((balloon) => balloon.value));
    const terms = [String(whole), ...popped.map((value) => `${MINUS} ${value}`), ...state.clipped.map((taken) => `+ ${taken.value}`)];
    lines.push(`${terms.join(' ')} = ${target}`);
  } else if (lifted.length > 1) {
    lines.push(`${lifted.join(' + ')} = ${target}`);
  } else {
    lines.push(String(target));
  }

  const layer = layerOf(state.def);
  if (layer > 0) lines.push(`${state.def.weight} + ${layer} = ${target}`);
  return lines;
}
```

- [ ] **Step 6: Replace `solver.ts`**

```ts
// games/balloon/src/logic/solver.ts
import { hooksOf, targetOf, tiedOf, type RescueDef } from './rescue-def.js';

/** One way through a rescue: which tray balloons to clip, and which tied ones to pop. */
export interface Answer {
  clip: number[];
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
 * Brute force over clips and pops. Proof, not play: the tests use it to show
 * every rescue is answerable and to check what each chapter is for.
 */
export function solve(def: RescueDef): Answer[] {
  const tied = tiedOf(def);
  const tiedTotal = totalAt(tied, tied.map((_, index) => index));
  const answers: Answer[] = [];
  for (const pop of subsetsOf(tied.length)) {
    for (const clip of subsetsOf(def.tray.length)) {
      if (tied.length + clip.length > hooksOf(def)) continue;
      if (tiedTotal - totalAt(tied, pop) + totalAt(def.tray, clip) === targetOf(def)) answers.push({ clip, pop });
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

- [ ] **Step 7: Rewrite Windy Ridge and The Big Rescue in `levels.data.ts`**

Replace the `windy-ridge` chapter (comment included) with:

```ts
  // Rise exactly the right number of wind layers: lift minus weight. The bunch
  // that makes exactly the weight — the old habit — is always there, and only
  // gets the kit off the ground. The first comes already floating.
  chapter('windy-ridge', 'Windy Ridge', [4, 17], [
    { line: 'The wind is helping!', weight: 5, tray: [1, 2, 4], tied: [3, 2], layer: 2 },
    { line: 'The top wind blows home', weight: 7, tray: [5, 4, 3, 2], layer: 3 },
    { line: 'Just one layer up', weight: 6, tray: [5, 1, 3, 4], layer: 1 },
    { line: 'Catch the middle wind', weight: 9, tray: [8, 6, 5, 3, 1], layer: 2 },
    { line: 'All the way to the top wind', weight: 12, tray: [10, 7, 5, 2, 3], layer: 3 },
  ]),
```

and replace the `big-rescue` chapter with:

```ts
  // Two ideas in every rescue.
  chapter('big-rescue', 'The Big Rescue', [5, 20], [
    { line: 'Two hooks, and the wind up high', weight: 13, hooks: 2, tray: [10, 5, 6, 7, 4, 3], layer: 2 },
    { line: 'A heavy load and too much lift', weight: 13, tray: [3], tied: [10, 6] },
    { line: 'Big load, little harness', weight: 18, hooks: 3, tray: [10, 9, 8, 6, 5, 3, 2] },
    { line: 'Pop, then up one wind', weight: 12, tray: [], tied: [7, 6, 4, 1], layer: 1 },
    { line: 'The last kit to rescue!', weight: 15, hooks: 2, tray: [10, 9, 8, 7, 6, 4, 3], layer: 2 },
  ]),
```

Every number above was checked against the curriculum rules before this plan was written.

- [ ] **Step 8: Run the logic tests and see them pass**

Run: `npx vitest run games/balloon/src/logic`
Expected: PASS. (The rest of the package does not compile until Task 2.)

- [ ] **Step 9: Commit**

```bash
git add games/balloon/src/logic
git commit -m "feat(balloon): wind layers — rise exactly lift minus weight"
```

---

### Task 2: Driver, module and sound without puffs

**Files:**
- Modify: `games/balloon/src/intent.ts`, `games/balloon/src/driver.ts`, `games/balloon/src/driver.test.ts`, `games/balloon/src/index.ts`, `games/balloon/src/audio/balloon-sounds.ts`, `games/balloon/src/view/timing.ts`

**Interfaces:**
- Consumes: Task 1's `Outcome` (no `axis`), `LAYERS`.
- Produces: `Intent` without `puff`/`puffSlot`; `flySeconds(outcome)` with `TIMING.flight.blown` replacing `across`; `SOUND_EVENTS` without `'puff'`.

- [ ] **Step 1: Update `driver.test.ts`**

In `'flies after "Let go!", then comes back with the gap to fix'`:

```ts
    expect(events).toContainEqual({ type: 'landed', outcome: { verdict: 'over', have: 5, need: 3, weight: 3, layer: 0 } });
```

In `'finishes after the last rescue, and starts over from there'`, replace the comment and the two puff lines so the setup reads:

```ts
    const driver = createDriver({ book: {}, startLevel: 'big-rescue-5' });
    // 10 + 7: weight 15, two layers up.
    driver.act({ kind: 'tray', index: 0 });
    driver.act({ kind: 'tray', index: 3 });
    driver.act({ kind: 'letGo' });
```

Add, after `'counts the balloons before the flight, one beat each'`:

```ts
  it('gives a kit blown the wrong way time to drift and parachute home', () => {
    const driver = createDriver({ book: {}, startLevel: 'windy-ridge-3' });
    driver.act({ kind: 'tray', index: 0 }); // 5
    driver.act({ kind: 'tray', index: 3 }); // 4: 9 is three layers up, not one
    driver.act({ kind: 'letGo' });
    expect(driver.flight!.fly).toBe(TIMING.flight.blown);
  });
```

with `import { TIMING } from './view/timing.js';` at the top.

- [ ] **Step 2: Run to see it fail**

Run: `npx vitest run games/balloon/src/driver.test.ts`
Expected: FAIL — `TIMING.flight.blown` is undefined, and `driver.ts` still refers to `puff`.

- [ ] **Step 3: Implement**

`intent.ts`: delete the `puff` and `puffSlot` members of `Intent`.

`driver.ts`: delete the `case 'puff':` and `case 'puffSlot':` branches in `build`.

`view/timing.ts`: in `TIMING.flight`, replace the `across` entry with:

```ts
    /** Up to the layer it reached, blown the wrong way, and the parachute down. */
    blown: 4.0,
```

and replace `flySeconds` with:

```ts
export const flySeconds = (outcome: Outcome): number => {
  if (outcome.verdict === 'exact') return TIMING.flight.exact;
  const rise = outcome.have - outcome.weight;
  if (outcome.layer > 0 && rise >= 1 && rise <= LAYERS) return TIMING.flight.blown;
  return outcome.verdict === 'short' ? TIMING.flight.short : TIMING.flight.over;
};
```

with `import { LAYERS } from '../logic/rescue-def.js';`.

`audio/balloon-sounds.ts`: remove `'puff'` from `SOUND_EVENTS`, delete the `puff` voice, and remove `puff` from `VOICES`.

`index.ts`:
- delete the `case 'puffed':` / `case 'unpuffed':` branch;
- delete `answer.puffs.forEach(...)` in the `answer` test hook;
- replace `liftOffSound` with:

```ts
/** The sound the kit makes as it leaves the ground, once the count is done. */
const liftOffSound = (outcome: Outcome): string => {
  if (outcome.have < outcome.weight) return 'strain';
  const rise = outcome.have - outcome.weight;
  if (outcome.verdict === 'over' && (outcome.layer === 0 || rise > LAYERS)) return 'whoosh';
  return 'float';
};
```

with `import { LAYERS } from './logic/rescue-def.js';`.

- [ ] **Step 4: Run to see it pass**

Run: `npx vitest run games/balloon/src/driver.test.ts games/balloon/src/logic games/balloon/src/audio`
Expected: PASS. (The view still refers to puffs until Tasks 3–4.)

- [ ] **Step 5: Commit**

```bash
git add games/balloon/src
git commit -m "feat(balloon): driver, module and sounds without puffs"
```

---

### Task 3: Geometry and flight for layers and the breeze

**Files:**
- Modify (replace whole file): `games/balloon/src/view/geometry.ts`, `games/balloon/src/view/flight.ts`, `games/balloon/src/view/flight.test.ts`
- Modify: `games/balloon/src/view/geometry.test.ts`

**Interfaces:**
- Produces from `geometry.ts`: `LAYOUT` (gains `rightCliffEdgeX`, `layerHeight`, `dropReach`; loses `stepWidth`, `puffSlot`); `layerY(layer): number`; `inDropZone(point): boolean`; `inTray(point): boolean`; everything else as before minus `PUFF_RADIUS`, `puffPoint`, `puffTrayPoint`, `WORLD_RIGHT`.
- Produces from `flight.ts`: `flightPose(def, outcome, t)` as before.

- [ ] **Step 1: Write the tests**

In `geometry.test.ts`:
- imports become `import { balloonRadius, bunchCount, bunchPoint, HOME, hitTest, inDropZone, inTray, LAYOUT, layerY, ledgeSpot, pegPoint, trayPoint } from './geometry.js';` and add `import { layerOf } from '../logic/rescue-def.js';`;
- in `'keeps every tray balloon apart and on screen, in every rescue'` delete the `rescue.wind?.puffs.forEach(...)` block;
- delete `'gives each puff in the tray room for its gusts, so none overlaps the next'`;
- rename `'keeps the peg clear of the first step post'` to `'keeps the peg beside the kit'` and make its body `expect(pegPoint(HOME).x - HOME.x).toBeGreaterThan(30);`;
- add:

```ts
  it('puts a Windy Ridge ledge on the right, at the height of its layer', () => {
    for (const rescue of RESCUES) {
      if (layerOf(rescue) === 0) continue;
      expect(ledgeSpot(rescue).y, rescue.id).toBe(layerY(layerOf(rescue)));
      expect(ledgeSpot(rescue).x, rescue.id).toBeGreaterThan(LAYOUT.rightCliffEdgeX);
    }
  });

  it('keeps the top layer\'s kit clear of the story line', () => {
    expect(layerY(3) - 130).toBeGreaterThan(LAYOUT.lineY);
  });

  it('takes a drop near the kit, and not one in the tray or on the button', () => {
    expect(inDropZone({ x: HOME.x, y: HOME.y - 260 })).toBe(true);
    expect(inDropZone({ x: HOME.x + 150, y: HOME.y - 80 })).toBe(true);
    expect(inDropZone(trayPoint({ id: 'd', line: '', weight: 3, tray: [3] }, 0))).toBe(false);
    expect(inDropZone({ x: LAYOUT.button.left + 40, y: LAYOUT.button.top + 40 })).toBe(false);
    expect(inDropZone({ x: 1050, y: 200 })).toBe(false);
  });

  it('knows a drop over the tray strip', () => {
    expect(inTray({ x: 400, y: LAYOUT.trayY })).toBe(true);
    expect(inTray({ x: 400, y: HOME.y - 200 })).toBe(false);
  });
```

Replace `flight.test.ts` entirely:

```ts
// games/balloon/src/view/flight.test.ts
import { describe, it, expect } from 'vitest';
import { judge } from '../logic/outcome.js';
import type { RescueDef } from '../logic/rescue-def.js';
import { flightPose } from './flight.js';
import { HOME, LAYOUT, layerY, ledgeSpot } from './geometry.js';

const still: RescueDef = { id: 's', line: '', weight: 8, tray: [] };
const windy: RescueDef = { id: 'w', line: '', weight: 7, tray: [], layer: 2 };

describe('the flight', () => {
  it('starts at home every time', () => {
    for (const outcome of [judge(6, 8), judge(8, 8), judge(11, 8)]) expect(flightPose(still, outcome, 0).at).toEqual(HOME);
    for (const lift of [5, 7, 8, 9, 12]) expect(flightPose(windy, judge(lift, 7, 2), 0).at).toEqual(HOME);
  });

  it('ends on the ledge when it was just right', () => {
    expect(flightPose(still, judge(8, 8), 1).at).toEqual(ledgeSpot(still));
    expect(flightPose(windy, judge(9, 7, 2), 1).at).toEqual(ledgeSpot(windy));
    expect(flightPose(still, judge(8, 8), 1).mood).toBe('happy');
  });

  it('is carried left onto the cliff by the breeze at the ledge\'s height', () => {
    const pose = flightPose(still, judge(8, 8), 0.8);
    expect(pose.at.x).toBeLessThan(HOME.x);
    expect(pose.at.y).toBeLessThanOrEqual(LAYOUT.ledgeY);
  });

  it('never really leaves the ground when it was too little', () => {
    for (let t = 0; t <= 1; t += 0.05) {
      const pose = flightPose(still, judge(6, 8), t);
      expect(HOME.y - pose.at.y).toBeLessThanOrEqual(45);
      expect(pose.mood).toBe('strain');
    }
    expect(flightPose(still, judge(6, 8), 1).at).toEqual(HOME);
  });

  it('goes off the top when it was too much, and comes home by parachute', () => {
    expect(flightPose(still, judge(11, 8), 0.4).at.y).toBeLessThan(0);
    const landed = flightPose(still, judge(11, 8), 1);
    expect(landed.at).toEqual(HOME);
    expect(landed.parachute).toBe(true);
  });

  it('rises to the layer it reached, is blown away from the ledge, and parachutes home', () => {
    const oneUp = judge(8, 7, 2);
    const mid = flightPose(windy, oneUp, 0.66);
    expect(mid.at.y).toBeCloseTo(layerY(1) - 14, 5);
    expect(mid.at.x).toBeLessThan(HOME.x);
    const landed = flightPose(windy, oneUp, 1);
    expect(landed.at).toEqual(HOME);
    expect(landed.parachute).toBe(true);
  });

  it('whooshes off the top from past the last layer', () => {
    expect(flightPose(windy, judge(12, 7, 2), 0.4).at.y).toBeLessThan(0);
  });

  it('lifts off and settles back, no parachute, on exactly the weight', () => {
    for (let t = 0; t <= 1; t += 0.05) {
      const pose = flightPose(windy, judge(7, 7, 2), t);
      expect(HOME.y - pose.at.y).toBeLessThanOrEqual(70);
      expect(pose.parachute).toBe(false);
    }
    expect(flightPose(windy, judge(7, 7, 2), 1).at).toEqual(HOME);
  });

  it('holds still outside 0..1', () => {
    expect(flightPose(still, judge(8, 8), 1.5).at).toEqual(ledgeSpot(still));
    expect(flightPose(still, judge(8, 8), -1).at).toEqual(HOME);
  });
});
```

- [ ] **Step 2: Run to see them fail**

Run: `npx vitest run games/balloon/src/view/geometry.test.ts games/balloon/src/view/flight.test.ts`
Expected: FAIL — `layerY`, `inDropZone` and `inTray` do not exist.

- [ ] **Step 3: Replace `geometry.ts`**

```ts
// games/balloon/src/view/geometry.ts
import type { Point } from '@bundle/core';
import type { Intent } from '../intent.js';
import { DEFAULT_HOOKS, hooksOf, layerOf, type RescueDef } from '../logic/rescue-def.js';
import { trayTaken, type RescueState } from '../logic/rescue.js';

/** Where everything sits, in design coordinates. */
export const LAYOUT = {
  /** The top bar: rescue number left, chapter centre, stars right. */
  hudY: 46,
  /** The story line, under the chapter. */
  lineY: 104,
  /** Where the kit's feet stand. */
  groundY: 560,
  homeX: 300,
  /** The top of the ledge, in the chapters where it is up and to the left. */
  ledgeY: 262,
  /** That left cliff's edge. */
  cliffEdgeX: 220,
  /** Windy Ridge: the right cliff's edge, and how tall one wind layer is. */
  rightCliffEdgeX: 780,
  layerHeight: 95,
  /** Centre line of the tray strip along the bottom. */
  trayY: 690,
  trayLeft: 50,
  trayRight: 890,
  button: { left: 912, top: 626, width: 210, height: 116 },
  /** From the feet up to the ring the balloon strings tie to. */
  harnessHeight: 118,
  /** How far from the bunch a dragged balloon can be dropped and still clip on. */
  dropReach: 290,
} as const;

export const HOME: Point = { x: LAYOUT.homeX, y: LAYOUT.groundY };

/** A 1 is small and a 10 is big; a 6 and a 7 are nearly the same, so read the number. */
export const balloonRadius = (value: number): number => 20 + (Math.min(10, Math.max(1, value)) - 1) * 2.8;

/** Where a kit's feet are once it has risen `layer` wind layers. */
export const layerY = (layer: number): number => LAYOUT.groundY - layer * LAYOUT.layerHeight;

export const ledgeSpot = (def: RescueDef): Point =>
  layerOf(def) > 0
    ? { x: LAYOUT.rightCliffEdgeX + 70, y: layerY(layerOf(def)) }
    : { x: LAYOUT.cliffEdgeX - 80, y: LAYOUT.ledgeY };

/** Where the rope from a tied bunch is pegged down, beside the kit. */
export const pegPoint = (feet: Point): Point => ({ x: feet.x + 50, y: feet.y + 6 });

export const harnessPoint = (at: Point): Point => ({ x: at.x, y: at.y - LAYOUT.harnessHeight });

/** Where the balloon on harness slot `slot` of `count` floats, for a kit standing at `at`. */
export function bunchPoint(slot: number, count: number, at: Point): Point {
  const spread = Math.min(64, 320 / Math.max(1, count));
  const offset = slot - (count - 1) / 2;
  return { x: at.x + offset * spread, y: at.y - LAYOUT.harnessHeight - 104 - (slot % 2) * 46 };
}

/**
 * How many places the bunch is laid out for. A limited harness is laid out for
 * all its hooks from the start, so the free ones can be drawn as empty clips and
 * the limit is seen rather than discovered.
 */
export const bunchCount = (state: RescueState): number => {
  const used = state.tied.length + state.clipped.length;
  return hooksOf(state.def) < DEFAULT_HOOKS ? hooksOf(state.def) : used;
};

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

/** Near enough the bunch that a dragged balloon dropped here clips on: around the kit, above the tray. */
export const inDropZone = (point: Point): boolean =>
  point.y < LAYOUT.trayY - 80 &&
  Math.hypot(point.x - HOME.x, point.y - (HOME.y - LAYOUT.harnessHeight - 120)) <= LAYOUT.dropReach;

/** Over the tray strip, where a clipped balloon dropped comes off. */
export const inTray = (point: Point): boolean =>
  point.y >= LAYOUT.trayY - 80 && point.x >= LAYOUT.trayLeft - 20 && point.x <= LAYOUT.trayRight + 20;

const near = (point: Point, centre: Point, radius: number): boolean =>
  (point.x - centre.x) ** 2 + (point.y - centre.y) ** 2 <= radius * radius;

/**
 * What a tap at `point` means while building. Generous circles, because a
 * six-year-old's finger is not a mouse; the harness is searched first because
 * it is drawn on top.
 */
export function hitTest(point: Point, state: RescueState): Intent | null {
  const { left, top, width, height } = LAYOUT.button;
  if (point.x >= left && point.x <= left + width && point.y >= top && point.y <= top + height) return { kind: 'letGo' };

  const used = state.tied.length + state.clipped.length;
  const count = bunchCount(state);
  for (let slot = used - 1; slot >= 0; slot -= 1) {
    const tied = state.tied[slot];
    const clipped = state.clipped[slot - state.tied.length];
    const value = tied?.value ?? clipped?.value ?? 1;
    if (!near(point, bunchPoint(slot, count, HOME), balloonRadius(value) + 8)) continue;
    return tied ? { kind: 'tied', index: slot } : { kind: 'clipped', slot: slot - state.tied.length };
  }

  // A squeezed tray lets neighbouring tap circles overlap, so the nearest
  // centre wins rather than whichever balloon happens to come first.
  const def = state.def;
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
import { LAYERS, layerOf, type RescueDef } from '../logic/rescue-def.js';
import { HOME, LAYOUT, layerY, ledgeSpot } from './geometry.js';

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

/** Where a kit blown the wrong way has got to when the parachute opens. */
const BLOWN_X = HOME.x - 200;

/** A strain and a hop: how nearly there it was shows in how high the hop is. */
function hop(share: number, t: number): Pose {
  const through = clamp01(t / 0.8);
  const height = through >= 1 ? 0 : Math.sin(Math.PI * through) * (8 + 32 * clamp01(share));
  return { at: { x: HOME.x, y: HOME.y - height }, parachute: false, mood: 'strain' };
}

/** Whoosh past everything and off the top, then a parachute home. */
function whoosh(t: number): Pose {
  if (t < 0.45) {
    const up = ease(during(t, 0, 0.35));
    return { at: { x: HOME.x + Math.sin(t * 14) * 6, y: lerp(HOME.y, -200, up) }, parachute: false, mood: 'wheee' };
  }
  const down = ease(during(t, 0.45, 1));
  return { at: { x: HOME.x, y: lerp(-150, HOME.y, down) }, parachute: true, mood: 'calm' };
}

/**
 * Where the kit is, `t` of the way through its flight. A function of the
 * outcome and nothing else, so the flight is drawn from state rather than
 * simulated — a flight can never disagree with the verdict it shows.
 */
export function flightPose(def: RescueDef, outcome: Outcome, rawT: number): Pose {
  const t = clamp01(rawT);
  if (layerOf(def) > 0) return layeredPose(def, outcome, t);
  if (outcome.verdict === 'short') return hop(outcome.have / outcome.need, t);
  if (outcome.verdict === 'over') return whoosh(t);

  // Just right: up to the ledge's height, where the breeze carries the kit
  // across onto the cliff.
  const spot = ledgeSpot(def);
  const hover = LAYOUT.ledgeY - 14;
  const rise = ease(during(t, 0, 0.62));
  const carry = ease(during(t, 0.64, 1));
  return {
    at: { x: lerp(HOME.x, spot.x, carry), y: lerp(lerp(HOME.y, hover, rise), spot.y, carry) },
    parachute: false,
    mood: t >= 1 ? 'happy' : 'calm',
  };
}

/**
 * Windy Ridge. The kit rises lift minus weight layers, and the layer it reaches
 * decides where the wind takes it: towards the ledge from the right layer, away
 * from it from any other.
 */
function layeredPose(def: RescueDef, outcome: Outcome, t: number): Pose {
  if (outcome.have < outcome.weight) return hop(outcome.have / outcome.weight, t);
  const rise = outcome.have - outcome.weight;
  if (rise > LAYERS) return whoosh(t);
  if (rise === 0) {
    // Floating, but no higher than the still air by the ground.
    const through = clamp01(t / 0.85);
    const lift = through >= 1 ? 0 : Math.sin(Math.PI * through) * 60;
    return { at: { x: HOME.x, y: HOME.y - lift }, parachute: false, mood: 'calm' };
  }

  const height = layerY(rise) - 14;
  if (outcome.verdict === 'exact') {
    const spot = ledgeSpot(def);
    const up = ease(during(t, 0, 0.42));
    const across = ease(during(t, 0.44, 0.88));
    const settle = ease(during(t, 0.88, 1));
    return {
      at: { x: lerp(HOME.x, spot.x, across), y: lerp(lerp(HOME.y, height, up), spot.y, settle) },
      parachute: false,
      mood: t >= 1 ? 'happy' : 'calm',
    };
  }
  if (t < 0.7) {
    const up = ease(during(t, 0, 0.35));
    const blown = ease(during(t, 0.37, 0.65));
    return { at: { x: lerp(HOME.x, BLOWN_X, blown), y: lerp(HOME.y, height, up) }, parachute: false, mood: 'strain' };
  }
  const back = ease(during(t, 0.7, 1));
  return { at: { x: lerp(BLOWN_X, HOME.x, back), y: lerp(height, HOME.y, back) }, parachute: true, mood: 'calm' };
}
```

- [ ] **Step 5: Run to see them pass**

Run: `npx vitest run games/balloon/src/view/geometry.test.ts games/balloon/src/view/flight.test.ts`
Expected: PASS. (`scene.ts` and `art.ts` are fixed in Task 4.)

- [ ] **Step 6: Commit**

```bash
git add games/balloon/src/view/geometry.ts games/balloon/src/view/geometry.test.ts games/balloon/src/view/flight.ts games/balloon/src/view/flight.test.ts
git commit -m "feat(balloon): layers and a breeze in the geometry and the flight"
```

---

### Task 4: Wind layers, the breeze and numberless pops on screen

**Files:**
- Modify: `games/balloon/src/view/art.ts`, `games/balloon/src/view/art.test.ts`, `games/balloon/src/view/scene.ts`, `games/balloon/src/view/scene.test.ts`

**Interfaces:**
- Produces from `art.ts`: `drawCliff(ctx, bounds, side, edgeX, topY = LAYOUT.ledgeY)`; `drawBreeze(ctx, bounds, time)`; `drawWindLayers(ctx, bounds, target, time)`; `drawBalloon` with `limp` drawing no number. Removes `drawStepMarks`, `drawWindSock`, `drawPuff`.
- Produces from `scene.ts`: `interface Drag { from: { kind: 'tray'; index: number } | { kind: 'clipped'; slot: number }; value: number; at: Point }`; `Scene.setDrag(drag: Drag | null): void`. Task 5 uses both.

- [ ] **Step 1: Write the tests**

`art.test.ts`:
- imports: replace `drawPuff`, `drawStepMarks`, `drawWindSock` with `drawBreeze`, `drawWindLayers`;
- in `'draws every piece…'` replace the `drawStepMarks`, both `drawWindSock` and the `drawPuff` calls with `drawBreeze(ctx, bounds, 1.5); drawWindLayers(ctx, bounds, 2, 1.5); drawCliff(ctx, bounds, 'right', 780, 370);`;
- `'writes the number on a balloon, a puff and the kit\'s weight tag'` → `'writes the number on a balloon and the kit\'s weight tag'`, without the `drawPuff` line and with `['7', '12']`;
- replace `'still shows a popped balloon\'s number, so it can be put back'` with:

```ts
  it('shows no number on a popped balloon, which no longer lifts anything', () => {
    const { ctx, texts } = recordingContext();
    drawBalloon(ctx, { x: 0, y: 0 }, 4, { limp: true });
    expect(texts).not.toContain('4');
  });
```

- replace `'says which way the wind blows, and how hard'` with:

```ts
  it('numbers the layers, and only the ledge\'s layer blows towards it', () => {
    const { ctx, texts } = recordingContext();
    drawWindLayers(ctx, { left: 0, top: 0, right: 1152, bottom: 768 }, 2, 0);
    expect(texts).toEqual(expect.arrayContaining(['1', '2', '3']));
    expect(texts.filter((text) => text === '→')).toHaveLength(1);
    expect(texts.filter((text) => text === '←')).toHaveLength(2);
  });
```

`scene.test.ts`:
- replace `'draws the wind, the steps and the puffs in Windy Ridge'` with:

```ts
  it('draws the wind layers in Windy Ridge, and no layers anywhere else', () => {
    const windy = render(createDriver({ book: {}, startLevel: 'windy-ridge-2' }));
    expect(windy.texts.filter((text) => text === '→')).toHaveLength(1);
    expect(windy.texts.filter((text) => text === '←')).toHaveLength(2);
    const plain = render(createDriver({ book: {}, startLevel: 'whoosh-1' }));
    expect(plain.texts).not.toContain('→');
  });

  it('shows a popped balloon without its number', () => {
    const driver = createDriver({ book: {}, startLevel: 'pop-1' });
    driver.act({ kind: 'tied', index: 1 }); // the 3
    expect(render(driver).texts).not.toContain('3');
  });

  it('draws a dragged balloon under the finger, and not in its old place', () => {
    const driver = createDriver({ book: {}, startLevel: 'whoosh-1' });
    const scene = createScene();
    scene.observe(driver.step(FRAME));
    scene.update(FRAME, driver.model());
    scene.setDrag({ from: { kind: 'tray', index: 0 }, value: 6, at: { x: 500, y: 300 } });
    const recording = recordingContext();
    scene.render(recording.ctx, SCREEN);
    expect(recording.translations).toContainEqual({ x: 500, y: 300 });
    expect(recording.texts.filter((text) => text === '6')).toHaveLength(1);
    scene.setDrag(null);
    const after = recordingContext();
    scene.render(after.ctx, SCREEN);
    expect(after.translations).not.toContainEqual({ x: 500, y: 300 });
  });
```

- [ ] **Step 2: Run to see them fail**

Run: `npx vitest run games/balloon/src/view`
Expected: FAIL — `drawBreeze`, `drawWindLayers` and `setDrag` do not exist, and a popped balloon still writes its number.

- [ ] **Step 3: Implement the art**

In `art.ts`:
- imports: `import { LAYERS } from '../logic/rescue-def.js';` and `import { balloonRadius, LAYOUT, layerY, pegPoint } from './geometry.js';` (drop `PUFF_RADIUS`);
- `drawCliff` gains `topY = LAYOUT.ledgeY` as a fifth parameter and uses it for `const top = topY;`;
- delete `drawStepMarks`, `drawWindSock` and `drawPuff`;
- in `drawBalloon`'s `limp` branch, delete the `label(...)` line and change its comment to: `// Popped: a scrap on its hook with no number, because it lifts nothing. A tap blows it back up.`;
- add:

```ts
/** Streaks of moving air across a band, drifting with `time`; `direction` 1 blows right. */
function drawStreaks(ctx: CanvasRenderingContext2D, bounds: Bounds, y: number, direction: number, time: number, alpha: number): void {
  const span = bounds.right - bounds.left;
  ctx.save();
  ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  for (let index = 0; index < 9; index += 1) {
    const x = bounds.left + ((((index * 137 + time * 160 * direction) % span) + span) % span);
    const dy = (index % 3) * 18 - 18;
    ctx.beginPath();
    ctx.moveTo(x, y + dy);
    ctx.lineTo(x + 70, y + dy);
    ctx.stroke();
  }
  ctx.restore();
}

/** The breeze at the ledge's height that carries a rescued kit across onto the cliff. */
export function drawBreeze(ctx: CanvasRenderingContext2D, bounds: Bounds, time: number): void {
  drawStreaks(ctx, bounds, LAYOUT.ledgeY - 60, -1, time, 0.75);
  const span = bounds.right - bounds.left;
  ctx.save();
  ctx.fillStyle = '#8cc56a';
  for (let index = 0; index < 3; index += 1) {
    const x = bounds.right - ((((index * 311 + time * 120) % span) + span) % span);
    ctx.beginPath();
    ctx.ellipse(x, LAYOUT.ledgeY - 70 + Math.sin(time * 3 + index) * 10, 9, 5, 0.6, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Windy Ridge's wind layers, numbered up the left edge. The one at the ledge's
 * height blows towards it; every other blows away.
 */
export function drawWindLayers(ctx: CanvasRenderingContext2D, bounds: Bounds, target: number, time: number): void {
  for (let layer = 1; layer <= LAYERS; layer += 1) {
    const y = layerY(layer) - 60;
    const towards = layer === target;
    ctx.save();
    ctx.fillStyle = towards ? 'rgba(255,240,170,0.35)' : 'rgba(255,255,255,0.18)';
    ctx.fillRect(bounds.left, y - 34, bounds.right - bounds.left, 68);
    ctx.restore();
    drawStreaks(ctx, bounds, y, towards ? 1 : -1, time, towards ? 0.9 : 0.6);
    label(ctx, String(layer), 40, y, 36, 'center');
    label(ctx, towards ? '→' : '←', 84, y, 34, 'center');
  }
}
```

- [ ] **Step 4: Implement the scene**

In `scene.ts`:
- imports: drop `puffTaken`, `drawPuff`, `drawStepMarks`, `drawWindSock`, `puffPoint`, `puffTrayPoint`; add `drawBreeze`, `drawWindLayers` from `./art.js`, and `import { layerOf } from '../logic/rescue-def.js';`;
- add, after the `Scene` interface's other members, `setDrag(drag: Drag | null): void;`, and export:

```ts
/** A balloon being dragged: where it came from, its value, and where the finger is. */
export interface Drag {
  from: { kind: 'tray'; index: number } | { kind: 'clipped'; slot: number };
  value: number;
  at: Point;
}
```

- `drawBunch` gains a `hide: number` parameter (a bunch slot not to draw, or −1) and skips that slot's string and balloon;
- in `createScene`, add `let drag: Drag | null = null;`, and `setDrag(next) { drag = next; },` to the returned object;
- in `render`, replace the cliff/sock/ground/steps block with:

```ts
      drawSky(ctx, bounds);
      const layer = layerOf(def);
      if (layer > 0) {
        drawCliff(ctx, bounds, 'right', LAYOUT.rightCliffEdgeX, ledgeSpot(def).y);
        drawWindLayers(ctx, bounds, layer, clock);
      } else {
        drawCliff(ctx, bounds, 'left', LAYOUT.cliffEdgeX);
        drawBreeze(ctx, bounds, clock);
      }
      drawGround(ctx, bounds);
```

  (rename the scene's `bob` variable to `clock`, and pass `bob: clock` to `drawFox`);
- delete the `state.puffs.forEach(...)` line and the `def.wind?.puffs.forEach(...)` block;
- compute `const hiddenSlot = drag?.from.kind === 'clipped' ? state.tied.length + drag.from.slot : -1;` and pass it as `drawBunch`'s new last argument in the building branch (pass `-1` in the rescued branch);
- in the tray loop, skip `index` when `drag?.from.kind === 'tray' && drag.from.index === index`;
- after drawing the tray and button, draw the dragged balloon on top: `if (drag && building) drawBalloon(ctx, drag.at, drag.value);`.

- [ ] **Step 5: Run to see them pass**

Run: `npx vitest run games/balloon && npm run typecheck`
Expected: PASS everywhere except `input.ts`, which still mentions `puff` — fix that in Task 5 Step 3 if typecheck flags it now, by changing `const fromTray = down.intent.kind === 'tray' || down.intent.kind === 'puff';` to `const fromTray = down.intent.kind === 'tray';`.

- [ ] **Step 6: Commit**

```bash
git add games/balloon/src/view
git commit -m "feat(balloon): wind layers, a ledge breeze, and pops without numbers"
```

---

### Task 5: Dragging that follows the finger

**Files:**
- Modify (replace whole file): `games/balloon/src/view/input.ts`
- Modify: `games/balloon/src/view/input.test.ts`

**Interfaces:**
- Consumes: `Scene.setDrag`, `Drag` (Task 4); `hitTest`, `inDropZone`, `inTray` (Task 3).
- Produces: `createInput(canvas, scene, emit, current)` — same signature as before.

- [ ] **Step 1: Write the tests**

In `input.test.ts`, add a `setup` that records drags — replace the existing `setup` with:

```ts
const setup = (width = 1152, height = 768, phase: Phase = 'building', prepare: (rescue: Rescue) => void = () => {}) => {
  const canvas = canvasOf(width, height);
  const intents: Intent[] = [];
  const drags: Array<Drag | null> = [];
  const rescue = createRescue(def);
  prepare(rescue);
  const scene = { ...createScene(), setDrag: (drag: Drag | null) => void drags.push(drag) };
  const input = createInput(canvas, scene, (intent) => intents.push(intent), () => ({ phase, rescue: rescue.state }));
  return { canvas, intents, drags, input, rescue };
};
```

with `import { createRescue, type Rescue } from '../logic/rescue.js';`, `import { createScene, type Drag } from './scene.js';` and `import { bunchPoint, HOME, LAYOUT, trayPoint } from './geometry.js';`. Then add:

```ts
  it('shows the balloon under the finger while it is dragged, and stops when it is dropped', () => {
    const { canvas, drags, input } = setup();
    const at = trayPoint(def, 2);
    pointer(canvas, 'pointerdown', at.x, at.y);
    pointer(canvas, 'pointermove', at.x + 30, at.y - 120);
    expect(drags.at(-1)).toEqual({ from: { kind: 'tray', index: 2 }, value: 6, at: { x: at.x + 30, y: at.y - 120 } });
    pointer(canvas, 'pointerup', at.x + 30, at.y - 120);
    expect(drags.at(-1)).toBeNull();
    input.dispose();
  });

  it('does not show a drag for a finger that has barely moved', () => {
    const { canvas, drags, input } = setup();
    const at = trayPoint(def, 2);
    pointer(canvas, 'pointerdown', at.x, at.y);
    pointer(canvas, 'pointermove', at.x + 4, at.y);
    expect(drags.filter(Boolean)).toEqual([]);
    input.dispose();
  });

  it('does not clip a balloon dropped on the button', () => {
    const { canvas, intents, input } = setup();
    const at = trayPoint(def, 3);
    pointer(canvas, 'pointerdown', at.x, at.y);
    pointer(canvas, 'pointerup', LAYOUT.button.left + 40, LAYOUT.button.top + 40);
    expect(intents).toEqual([]);
    input.dispose();
  });

  it('takes a clipped balloon off when it is dragged down into the tray', () => {
    const { canvas, intents, input } = setup(1152, 768, 'building', (rescue) => {
      rescue.clip(0);
      rescue.clip(1);
    });
    const at = bunchPoint(1, 2, HOME);
    pointer(canvas, 'pointerdown', at.x, at.y);
    pointer(canvas, 'pointermove', 500, LAYOUT.trayY);
    pointer(canvas, 'pointerup', 500, LAYOUT.trayY);
    expect(intents).toEqual([{ kind: 'clipped', slot: 1 }]);
    input.dispose();
  });

  it('leaves a clipped balloon on when it is dragged and dropped back in the sky', () => {
    const { canvas, intents, input } = setup(1152, 768, 'building', (rescue) => rescue.clip(0));
    const at = bunchPoint(0, 1, HOME);
    pointer(canvas, 'pointerdown', at.x, at.y);
    pointer(canvas, 'pointerup', at.x + 120, at.y + 60);
    expect(intents).toEqual([]);
    input.dispose();
  });

  it('does not drag a tied balloon: a tied one is popped by a tap', () => {
    const tiedDef: RescueDef = { id: 't', line: '', weight: 7, tray: [], tied: [6, 3, 1] };
    const canvas = canvasOf(1152, 768);
    const intents: Intent[] = [];
    const drags: Array<Drag | null> = [];
    const rescue = createRescue(tiedDef);
    const scene = { ...createScene(), setDrag: (drag: Drag | null) => void drags.push(drag) };
    const input = createInput(canvas, scene, (intent) => intents.push(intent), () => ({ phase: 'building', rescue: rescue.state }));
    const at = bunchPoint(1, 3, HOME);
    pointer(canvas, 'pointerdown', at.x, at.y);
    pointer(canvas, 'pointermove', at.x + 100, at.y + 200);
    pointer(canvas, 'pointerup', at.x + 100, at.y + 200);
    expect(drags.filter(Boolean)).toEqual([]);
    expect(intents).toEqual([]);
    input.dispose();
  });

  it('stops drawing the drag when the pointer is cancelled', () => {
    const { canvas, drags, input } = setup();
    const at = trayPoint(def, 0);
    pointer(canvas, 'pointerdown', at.x, at.y);
    pointer(canvas, 'pointermove', at.x, at.y - 200);
    pointer(canvas, 'pointercancel', at.x, at.y - 200);
    expect(drags.at(-1)).toBeNull();
    input.dispose();
  });
```

- [ ] **Step 2: Run to see them fail**

Run: `npx vitest run games/balloon/src/view/input.test.ts`
Expected: FAIL — nothing listens for `pointermove`, so no drag is ever set, and a clipped balloon dragged into the tray is not taken off.

- [ ] **Step 3: Replace `input.ts`**

```ts
// games/balloon/src/view/input.ts
import { DESIGN, type Point, type Size } from '@bundle/core';
import type { Phase } from '../driver.js';
import type { Intent } from '../intent.js';
import type { RescueState } from '../logic/rescue.js';
import { hitTest, inDropZone, inTray } from './geometry.js';
import type { Drag, Scene } from './scene.js';

export interface InputHandle {
  dispose(): void;
}

/** Further than this and a press has become a drag. */
const DRAG_PIXELS = 16;

/**
 * Tap is the main gesture, because six-year-olds drag imprecisely, and it always
 * works. A tray balloon can also be dragged: it follows the finger, clips on if
 * dropped near the kit, and goes back to its place anywhere else. A clipped
 * balloon dragged down into the tray comes off. Tied balloons are tapped, never
 * dragged. Everything else acts when the finger lifts on the thing it went down
 * on, so a slipped finger does nothing.
 */
export function createInput(
  canvas: HTMLCanvasElement,
  scene: Scene,
  emit: (intent: Intent) => void,
  current: () => { phase: Phase; rescue: RescueState },
): InputHandle {
  let pressed: { intent: Intent | null; at: Point; dragging: boolean } | null = null;

  const screenSize = (): Size => ({
    width: canvas.clientWidth || DESIGN.width,
    height: canvas.clientHeight || DESIGN.height,
  });

  const designPoint = (event: PointerEvent): Point => {
    const bounds = canvas.getBoundingClientRect();
    return scene.toDesign({ x: event.clientX - bounds.left, y: event.clientY - bounds.top }, screenSize());
  };

  const same = (a: Intent | null, b: Intent | null): boolean => JSON.stringify(a) === JSON.stringify(b);

  /** What a press on `intent` would drag, if it can be dragged at all. */
  const dragFrom = (intent: Intent | null, rescue: RescueState, at: Point): Drag | null => {
    if (intent?.kind === 'tray') {
      const value = rescue.def.tray[intent.index];
      return value === undefined ? null : { from: { kind: 'tray', index: intent.index }, value, at };
    }
    if (intent?.kind === 'clipped') {
      const value = rescue.clipped[intent.slot]?.value;
      return value === undefined ? null : { from: { kind: 'clipped', slot: intent.slot }, value, at };
    }
    return null;
  };

  const endDrag = (): void => {
    if (pressed?.dragging) scene.setDrag(null);
  };

  const onPointerDown = (event: PointerEvent): void => {
    canvas.setPointerCapture?.(event.pointerId);
    const { phase, rescue } = current();
    // A finger that went down mid-flight belongs to nothing; lifting it after
    // landing must not count as the tap that moves on.
    if (phase === 'flying') {
      pressed = null;
      return;
    }
    const at = designPoint(event);
    pressed = { intent: phase === 'building' ? hitTest(at, rescue) : null, at, dragging: false };
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (!pressed) return;
    const { phase, rescue } = current();
    if (phase !== 'building') return;
    const at = designPoint(event);
    if (!pressed.dragging && Math.hypot(at.x - pressed.at.x, at.y - pressed.at.y) < DRAG_PIXELS) return;
    const drag = dragFrom(pressed.intent, rescue, at);
    if (!drag) return;
    pressed.dragging = true;
    scene.setDrag(drag);
  };

  const onPointerUp = (event: PointerEvent): void => {
    endDrag();
    const down = pressed;
    pressed = null;
    canvas.releasePointerCapture?.(event.pointerId);
    if (!down) return;
    const { phase, rescue } = current();
    if (phase === 'rescued' || phase === 'finished') {
      emit({ kind: 'next' });
      return;
    }
    if (phase !== 'building' || !down.intent) return;

    const at = designPoint(event);
    const dragged = Math.hypot(at.x - down.at.x, at.y - down.at.y) >= DRAG_PIXELS;
    if (down.intent.kind === 'tray') {
      if (!dragged || inDropZone(at)) emit(down.intent);
      return;
    }
    if (down.intent.kind === 'clipped' && dragged) {
      if (inTray(at)) emit(down.intent);
      return;
    }
    if (same(hitTest(at, rescue), down.intent)) emit(down.intent);
  };

  const onPointerCancel = (): void => {
    endDrag();
    pressed = null;
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== ' ' && event.key !== 'Enter') return;
    const { phase } = current();
    if (phase === 'building') emit({ kind: 'letGo' });
    else if (phase === 'rescued' || phase === 'finished') emit({ kind: 'next' });
  };

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerCancel);
  globalThis.addEventListener?.('keydown', onKeyDown);

  return {
    dispose() {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerCancel);
      globalThis.removeEventListener?.('keydown', onKeyDown);
    },
  };
}
```

- [ ] **Step 4: Run everything**

Run: `npm test && npm run typecheck`
Expected: PASS across the bundle, typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add games/balloon/src/view
git commit -m "feat(balloon): dragging that follows the finger"
```

---

### Task 6: Play it, and write it down

**Files:**
- Modify: `README.md` (the Balloon Rescue section)

- [ ] **Step 1: Play it in the browser**

Run the dev server and check by eye:
- `?game=balloon` — drag a balloon from the tray onto the kit: it follows the finger and clips; drag a clipped one into the tray: it comes off; a short drag dropped in the tray leaves it where it was; tapping still works.
- First Flight, just right: the breeze streaks and leaves blow left at the ledge's height, and the kit is carried onto the cliff.
- `&level=pop-1` — a popped balloon is a numberless scrap; tapping it brings the number back.
- `&level=windy-ridge-2` — layers 1–3 up the left, only the layer level with the ledge points `→`; 5 + 2 lifts off and settles back with "3 more!" and the gauge `7 / 7 + 3`; 5 + 3 + 2 rises to the third layer and lands, with `5 + 3 + 2 = 10` and `7 + 3 = 10`; one layer too high or low is blown left and parachutes home.

Fix anything wrong in the file that owns it, with a test where the mistake can be pinned by one.

- [ ] **Step 2: Update the README**

In the Balloon Rescue section, replace the sentence about tapping with:

```markdown
**Tap a balloon to clip it on; tap it again to send it back.** Or drag it: it
follows the finger, clips on when dropped near the kit, and comes off when a
clipped one is dragged down into the tray. "Let go!" is the only way to find
out, and a wrong try leaves the bunch as it was, with the gap in words — "2
more!", "3 too many!".
```

and in the chapter list replace the Windy Ridge clause with: `Windy Ridge (wind layers: the kit rises lift minus weight layers, so a ledge three layers up takes the weight plus three)`.

- [ ] **Step 3: Final verification**

Run: `npm test && npm run typecheck && npm run build`
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add README.md games/balloon
git commit -m "docs(balloon): wind layers and dragging in the README"
```
