# Balloon Rescue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Balloon Rescue, the bundle's fourth game: a fox kit is stuck on the ground, the child clips numbered balloons to its harness until the lift is exactly its weight, and lets go — too little and it strains, too much and it whooshes into the clouds, exactly right and it floats up to the ledge.

**Architecture:** A pure logic layer owns one rescue at a time — what is tied, clipped, popped and puffed, and what "Let go!" makes of it — plus the chapter data and a brute-force solver that proves every rescue answerable. A driver strings rescues together, runs the count-and-flight beat on a clock, and records stars. A canvas layer maps all of it onto the 1152x768 design space and never writes back.

**Tech Stack:** TypeScript (strict, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`), Vite, Vitest, canvas 2D, Web Audio via `@bundle/core`'s shared bus. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-29-balloon-rescue-design.md` — read it before Task 1 and keep it open; this plan argues from it.

## Global Constraints

- **Design space 1152x768** landscape, as the other three games. Gameplay stays inside it; scenery paints past it.
- **Balloons are worth 1 to 10**, and a balloon's drawn size grows with its value. **Puffs are worth 1 to 5.** **Weights are 1 to 20.**
- **Six hooks** unless a rescue says fewer (Tiny Harness and later: two or three). A tied balloon uses a hook, popped or not.
- **No running total while building.** Nothing on screen adds up the clipped balloons before "Let go!".
- **Stars:** right on the first try 3, the second 2, any later 1. The stored best never goes down.
- **A wrong try leaves the bunch exactly as it was.** A popped balloon can always be re-inflated. Nothing can leave a rescue unfinishable.
- **Up is judged before across.** In wind, across counts the wind's own push: `wind + puffs` must equal `ledge`.
- **The minus sign is `−` (U+2212), not a hyphen.**
- **`src/logic/` is pure**: no DOM, no timers, no audio, no `Math.random`.
- **`src/view/` reads state and never writes it.**
- **No chapter title or story line repeats one of Seesaw Park's.**
- Run `npm test` and `npm run typecheck` before every commit. Both must be clean.

## Review Focus

1. **Taps during the flight.** A child taps balloons, or "Let go!" again, while the kit is in the air: nothing changes and no try is counted. Pinned in Task 7 (driver) and Task 12 (module).
2. **"Let go!" with nothing on the harness.** Nothing happens and no try is counted. Pinned in Task 3.
3. **Old or damaged saved stars** (not an object, strings, ids that no longer exist): the game opens at the first rescue instead of throwing. Pinned in Task 7 (`readBook`).
4. **An unknown `?level=`**: the game opens where the child left off. Pinned in Task 7 (`startIndex`).
5. **A screen that is not 3:2** (a phone, a wide monitor): a tap still lands on the balloon under the finger. Pinned in Task 11.

---

### Task 1: The package, registered and mounting

**Files:**
- Create: `games/balloon/package.json`, `games/balloon/tsconfig.json`, `games/balloon/src/vite-env.d.ts`
- Create: `games/balloon/src/index.ts`, `games/balloon/src/index.test.ts`, `games/balloon/src/test-host.ts`
- Modify: `tsconfig.json`, `vitest.config.ts`, `apps/shell/vite.config.ts`, `apps/shell/src/catalog.ts`, `apps/shell/src/shell.test.ts`

**Interfaces:**
- Consumes: `GameHost`, `GameModule`, `GameSession` from `@bundle/core`.
- Produces: `balloonGame` (id `'balloon'`, title `'Balloon Rescue'`) from `@bundle/balloon`; `createTestHost()` from `games/balloon/src/test-host.ts`. Task 12 replaces `index.ts`'s body.

- [ ] **Step 1: Write the failing test**

```ts
// games/balloon/src/index.test.ts
// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { installCanvasStub } from '@bundle/core';
import { balloonGame } from './index.js';
import { createTestHost } from './test-host.js';

let restoreCanvas: () => void;
beforeAll(() => {
  restoreCanvas = installCanvasStub();
});
afterAll(() => restoreCanvas());

describe('balloonGame', () => {
  it('names itself for the catalog', () => {
    expect(balloonGame.id).toBe('balloon');
    expect(balloonGame.title).toBe('Balloon Rescue');
  });

  it('mounts a canvas and takes it away again', async () => {
    const container = document.createElement('div');
    const session = await balloonGame.mount(container, createTestHost());
    expect(container.querySelector('canvas')).not.toBeNull();
    session.unmount();
    expect(container.querySelector('canvas')).toBeNull();
  });
});
```

And in `apps/shell/src/shell.test.ts` change the named list:

```ts
    expect(playable.map((tile) => tile.id)).toEqual(['seesaw', 'sky', 'bramble', 'balloon']);
```

- [ ] **Step 2: Run to see it fail**

Run: `npx vitest run games/balloon apps/shell`
Expected: FAIL — `./index.js` cannot be resolved, and the shell lists three games.

- [ ] **Step 3: Create the package**

```json
// games/balloon/package.json
{
  "name": "@bundle/balloon",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "src/index.ts"
}
```

```json
// games/balloon/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src"]
}
```

```ts
// games/balloon/src/vite-env.d.ts
/// <reference types="vite/client" />
```

```ts
// games/balloon/src/test-host.ts
import {
  createAudioBus,
  createContentManifest,
  createProfileStore,
  createSettings,
  type GameHost,
  type Settings,
} from '@bundle/core';
import { fakeContext } from '../../../packages/core/src/audio/fake-context.js';

export interface TestHost extends GameHost {
  /** The writable settings, so tests can change them mid-session. */
  settings: Settings;
  exited: number;
}

const memoryBackend = () => {
  const map = new Map<string, string>();
  return { getItem: (key: string) => map.get(key) ?? null, setItem: (key: string, value: string) => void map.set(key, value) };
};

/** A GameHost wired to fakes. */
export function createTestHost(): TestHost {
  const store = createProfileStore(memoryBackend());
  const host: TestHost = {
    audio: createAudioBus(() => fakeContext() as unknown as AudioContext),
    storage: store.namespace('balloon'),
    settings: createSettings(store.namespace('shell')),
    content: createContentManifest('all'),
    exit: () => {
      host.exited += 1;
    },
    exited: 0,
  };
  return host;
}
```

```ts
// games/balloon/src/index.ts  (a placeholder body; Task 12 replaces it)
import type { GameModule, GameSession } from '@bundle/core';

export interface BalloonOptions {
  /** A rescue or chapter id, so `?game=balloon&level=pop-1` opens straight into Pop!. */
  startLevel?: string;
}

export const balloonGame: GameModule<BalloonOptions> = {
  id: 'balloon',
  title: 'Balloon Rescue',
  async mount(container): Promise<GameSession> {
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;';
    container.appendChild(canvas);
    return {
      pause: () => {},
      resume: () => {},
      unmount: () => canvas.remove(),
    };
  },
};

export default balloonGame;
```

- [ ] **Step 4: Register it in the four places every game touches**

`tsconfig.json` → `paths`, after `@bundle/bramble`:

```json
      "@bundle/balloon": ["games/balloon/src/index.ts"]
```

`vitest.config.ts` → `alias`, after `@bundle/bramble`:

```ts
      '@bundle/balloon': resolvePath('./games/balloon/src/index.ts'),
```

`apps/shell/vite.config.ts` → `alias`, after `@bundle/bramble`:

```ts
      '@bundle/balloon': resolvePath('../../games/balloon/src/index.ts'),
```

`apps/shell/src/catalog.ts`: add `import { balloonGame } from '@bundle/balloon';` beside the other game imports, and **replace the Market Stall row** — its blurb, "Make it add up", is the skill Balloon Rescue now teaches, the same reason Bramble Dash replaced Sorting Station. Put the new row straight after Bramble Dash's so the built games sit together:

```ts
  { id: 'balloon', title: 'Balloon Rescue', blurb: 'Lift them just right', colors: ['#f7a8b8', '#7cc3ea'], module: balloonGame },
```

and delete:

```ts
  { id: 'coins', title: 'Market Stall', blurb: 'Make it add up', colors: ['#f2b950', '#d98b3f'] },
```

The catalog stays ten tiles.

- [ ] **Step 5: Run to see it pass**

Run: `npx vitest run games/balloon apps/shell && npm run typecheck`
Expected: PASS, and a clean typecheck.

- [ ] **Step 6: Commit**

```bash
git add games/balloon tsconfig.json vitest.config.ts apps/shell/vite.config.ts apps/shell/src/catalog.ts apps/shell/src/shell.test.ts
git commit -m "feat(balloon): the Balloon Rescue package, registered and mounting"
```

---

### Task 2: What a rescue is, and what letting go means

**Files:**
- Create: `games/balloon/src/logic/rescue-def.ts`, `games/balloon/src/logic/rescue-def.test.ts`
- Create: `games/balloon/src/logic/outcome.ts`, `games/balloon/src/logic/outcome.test.ts`
- Create: `games/balloon/src/logic/stars.ts`, `games/balloon/src/logic/stars.test.ts`

**Interfaces:**
- Produces from `rescue-def.ts`: `BALLOON_MIN = 1`, `BALLOON_MAX = 10`, `PUFF_MIN = 1`, `PUFF_MAX = 5`, `WEIGHT_MAX = 20`, `DEFAULT_HOOKS = 6`; `interface WindDef { ledge: number; wind: number; puffs: readonly number[] }`; `interface RescueDef { id: string; line: string; weight: number; tray: readonly number[]; tied?: readonly number[]; hooks?: number; wind?: WindDef }`; `interface ChapterDef { id: string; title: string; targets: readonly [number, number]; rescues: readonly RescueDef[] }`; `hooksOf(def): number`; `tiedOf(def): readonly number[]`; `acrossNeed(wind): number`; `problemsWith(def): string[]`.
- Produces from `outcome.ts`: `type Verdict = 'short' | 'exact' | 'over'`; `interface Outcome { verdict: Verdict; axis: 'up' | 'across'; have: number; need: number }`; `verdictOf(have, need): Verdict`; `judge(lift, weight, across?: { have: number; need: number }): Outcome`; `feedbackLine(outcome): string`; `gaugeText(outcome): string`.
- Produces from `stars.ts`: `type StarBook = Record<string, number>`; `starsFor(tries): 1 | 2 | 3`; `recordStars(book, id, stars): StarBook`.

- [ ] **Step 1: Write the failing tests**

```ts
// games/balloon/src/logic/rescue-def.test.ts
import { describe, it, expect } from 'vitest';
import { acrossNeed, hooksOf, problemsWith, tiedOf, type RescueDef } from './rescue-def.js';

const plain: RescueDef = { id: 'x', line: 'x', weight: 8, tray: [5, 3] };

describe('a rescue definition', () => {
  it('has six hooks and nothing tied unless it says otherwise', () => {
    expect(hooksOf(plain)).toBe(6);
    expect(tiedOf(plain)).toEqual([]);
    expect(hooksOf({ ...plain, hooks: 2 })).toBe(2);
  });

  it('counts the wind towards the ledge, and against it', () => {
    expect(acrossNeed({ ledge: 7, wind: 3, puffs: [] })).toBe(4);
    expect(acrossNeed({ ledge: 5, wind: -2, puffs: [] })).toBe(7);
  });

  it('finds nothing wrong with a sound rescue', () => {
    expect(problemsWith(plain)).toEqual([]);
  });

  it('rejects numbers outside the ranges the game draws', () => {
    expect(problemsWith({ ...plain, weight: 21 })).not.toEqual([]);
    expect(problemsWith({ ...plain, tray: [11] })).not.toEqual([]);
    expect(problemsWith({ ...plain, tray: [0] })).not.toEqual([]);
    expect(problemsWith({ ...plain, wind: { ledge: 7, wind: 3, puffs: [6] } })).not.toEqual([]);
    expect(problemsWith({ ...plain, hooks: 7 })).not.toEqual([]);
  });

  it('rejects more tied balloons than hooks, and a wind that does the whole job', () => {
    expect(problemsWith({ ...plain, hooks: 2, tied: [1, 1, 1] })).not.toEqual([]);
    expect(problemsWith({ ...plain, wind: { ledge: 3, wind: 3, puffs: [1] } })).not.toEqual([]);
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

  it('judges up before across', () => {
    expect(judge(6, 8, { have: 7, need: 7 })).toEqual({ verdict: 'short', axis: 'up', have: 6, need: 8 });
    expect(judge(8, 8, { have: 5, need: 7 })).toEqual({ verdict: 'short', axis: 'across', have: 5, need: 7 });
    expect(judge(8, 8, { have: 7, need: 7 }).verdict).toBe('exact');
    expect(judge(8, 8).axis).toBe('up');
  });

  it('says how far off it was, in the words the child reads', () => {
    expect(feedbackLine(judge(6, 8))).toBe('2 more!');
    expect(feedbackLine(judge(11, 8))).toBe('3 too many!');
    expect(feedbackLine(judge(8, 8, { have: 6, need: 7 }))).toBe('1 more puff!');
    expect(feedbackLine(judge(8, 8, { have: 4, need: 7 }))).toBe('3 more puffs!');
    expect(feedbackLine(judge(8, 8, { have: 9, need: 7 }))).toBe('2 puffs too many!');
    expect(feedbackLine(judge(8, 8))).toBe('Just right!');
  });

  it('writes the gauge as what you had over what you needed', () => {
    expect(gaugeText(judge(6, 8))).toBe('6 / 8');
  });
});
```

```ts
// games/balloon/src/logic/stars.test.ts
import { describe, it, expect } from 'vitest';
import { recordStars, starsFor } from './stars.js';

describe('stars', () => {
  it('rewards working it out before letting go', () => {
    expect(starsFor(1)).toBe(3);
    expect(starsFor(2)).toBe(2);
    expect(starsFor(3)).toBe(1);
    expect(starsFor(9)).toBe(1);
  });

  it('keeps the best, and never takes stars away', () => {
    const book = recordStars({}, 'a', 2);
    expect(book).toEqual({ a: 2 });
    expect(recordStars(book, 'a', 1)).toEqual({ a: 2 });
    expect(recordStars(book, 'a', 3)).toEqual({ a: 3 });
  });

  it('does not change the book it was given', () => {
    const book = { a: 1 };
    recordStars(book, 'a', 3);
    expect(book).toEqual({ a: 1 });
  });
});
```

- [ ] **Step 2: Run to see them fail**

Run: `npx vitest run games/balloon/src/logic`
Expected: FAIL — the modules do not exist.

- [ ] **Step 3: Implement**

```ts
// games/balloon/src/logic/rescue-def.ts
export const BALLOON_MIN = 1;
export const BALLOON_MAX = 10;
export const PUFF_MIN = 1;
export const PUFF_MAX = 5;
export const WEIGHT_MAX = 20;
export const DEFAULT_HOOKS = 6;

/**
 * The sideways half of a rescue. The ledge is `ledge` steps to the right; the
 * wind pushes `wind` steps by itself (negative blows away from the ledge), and
 * the puffs have to make up the rest.
 */
export interface WindDef {
  ledge: number;
  wind: number;
  puffs: readonly number[];
}

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
  wind?: WindDef;
}

export interface ChapterDef {
  id: string;
  title: string;
  /** The weights this chapter's rescues may ask for. */
  targets: readonly [number, number];
  rescues: readonly RescueDef[];
}

export const hooksOf = (def: RescueDef): number => def.hooks ?? DEFAULT_HOOKS;
export const tiedOf = (def: RescueDef): readonly number[] => def.tied ?? [];
/** How many steps the puffs must supply. */
export const acrossNeed = (wind: WindDef): number => wind.ledge - wind.wind;

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
  if (def.wind) {
    for (const value of def.wind.puffs) {
      if (!whole(value, PUFF_MIN, PUFF_MAX)) problems.push(`puff ${value}`);
    }
    if (!whole(def.wind.ledge, 1, 10)) problems.push(`ledge ${def.wind.ledge}`);
    if (acrossNeed(def.wind) < 1) problems.push('the wind reaches the ledge by itself');
  }
  return problems;
}
```

```ts
// games/balloon/src/logic/outcome.ts
export type Verdict = 'short' | 'exact' | 'over';

/**
 * What letting go did. `axis` says which question the verdict answers: up is
 * judged first, and across only once up is right, so the gauge only ever talks
 * about one thing.
 */
export interface Outcome {
  verdict: Verdict;
  axis: 'up' | 'across';
  have: number;
  need: number;
}

export const verdictOf = (have: number, need: number): Verdict =>
  have < need ? 'short' : have > need ? 'over' : 'exact';

export function judge(lift: number, weight: number, across?: { have: number; need: number }): Outcome {
  const up = verdictOf(lift, weight);
  if (up !== 'exact' || !across) return { verdict: up, axis: 'up', have: lift, need: weight };
  return { verdict: verdictOf(across.have, across.need), axis: 'across', have: across.have, need: across.need };
}

/** The gap in words: the teaching half of a wrong try. */
export function feedbackLine(outcome: Outcome): string {
  if (outcome.verdict === 'exact') return 'Just right!';
  const gap = Math.abs(outcome.need - outcome.have);
  if (outcome.axis === 'up') return outcome.verdict === 'short' ? `${gap} more!` : `${gap} too many!`;
  const puffs = gap === 1 ? 'puff' : 'puffs';
  return outcome.verdict === 'short' ? `${gap} more ${puffs}!` : `${gap} ${puffs} too many!`;
}

export const gaugeText = (outcome: Outcome): string => `${outcome.have} / ${outcome.need}`;
```

```ts
// games/balloon/src/logic/stars.ts
/** Best stars per rescue id, as kept in the host's storage. */
export type StarBook = Record<string, number>;

/** A rescue is never failed, only rescued more or less cleanly. */
export const starsFor = (tries: number): 1 | 2 | 3 => (tries <= 1 ? 3 : tries === 2 ? 2 : 1);

export const recordStars = (book: StarBook, id: string, stars: number): StarBook => ({
  ...book,
  [id]: Math.max(book[id] ?? 0, stars),
});
```

- [ ] **Step 4: Run to see them pass**

Run: `npx vitest run games/balloon/src/logic && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add games/balloon/src/logic
git commit -m "feat(balloon): what a rescue is, what letting go means, and stars"
```

---

### Task 3: The rescue itself

**Files:**
- Create: `games/balloon/src/logic/rescue.ts`, `games/balloon/src/logic/rescue.test.ts`

**Interfaces:**
- Consumes: `RescueDef`, `hooksOf`, `tiedOf` (Task 2); `judge`, `Outcome` (Task 2).
- Produces: `interface Taken { value: number; from: number }`; `interface TiedBalloon { value: number; popped: boolean }`; `interface RescueState { readonly def: RescueDef; tied: TiedBalloon[]; clipped: Taken[]; puffs: Taken[]; tries: number; rescued: boolean }`; `type RescueEvent` (below); `interface Rescue { readonly state: RescueState; clip(trayIndex): RescueEvent[]; unclip(slot): RescueEvent[]; togglePop(tiedIndex): RescueEvent[]; puff(puffIndex): RescueEvent[]; unpuff(slot): RescueEvent[]; letGo(): RescueEvent[] }`; `createRescue(def): Rescue`; helpers `liftOf`, `puffTotal`, `hooksUsed`, `trayTaken`, `puffTaken`, `canLetGo`, `liftedValues`, `liftedSlots`, `outcomeOf`, `answerLines`.

`clipped[slot].from` is the tray index the balloon came from, so the tray keeps its gaps where balloons were taken and a balloon sent back returns to its own place.

- [ ] **Step 1: Write the failing test**

```ts
// games/balloon/src/logic/rescue.test.ts
import { describe, it, expect } from 'vitest';
import {
  answerLines,
  canLetGo,
  createRescue,
  hooksUsed,
  liftedSlots,
  liftOf,
  trayTaken,
} from './rescue.js';
import type { RescueDef } from './rescue-def.js';

const eight: RescueDef = { id: 'eight', line: '', weight: 8, tray: [5, 3, 6, 2] };

describe('a rescue', () => {
  it('clips a tray balloon to the harness and adds its lift', () => {
    const rescue = createRescue(eight);
    expect(rescue.clip(0)).toEqual([{ type: 'clipped', value: 5 }]);
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
    expect(rescue.unclip(0)).toEqual([{ type: 'unclipped', value: 6 }]);
    expect(trayTaken(rescue.state, 2)).toBe(false);
    expect(rescue.state.clipped).toEqual([{ value: 5, from: 0 }]);
  });

  it('ignores slots and tray places that do not exist', () => {
    const rescue = createRescue(eight);
    expect(rescue.clip(9)).toEqual([]);
    expect(rescue.clip(-1)).toEqual([]);
    expect(rescue.unclip(0)).toEqual([]);
    expect(rescue.unclip(-1)).toEqual([]);
    expect(rescue.togglePop(0)).toEqual([]);
    expect(rescue.puff(0)).toEqual([]);
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
    expect(liftOf(rescue.state)).toBe(10);
  });

  it('does nothing on "Let go!" with nothing on the harness', () => {
    const rescue = createRescue(eight);
    expect(canLetGo(rescue.state)).toBe(false);
    expect(rescue.letGo()).toEqual([]);
    expect(rescue.state.tries).toBe(0);
  });

  it('counts a wrong try and leaves the bunch exactly as it was', () => {
    const rescue = createRescue(eight);
    rescue.clip(0);
    rescue.clip(2);
    const [event] = rescue.letGo();
    expect(event).toEqual({ type: 'released', outcome: { verdict: 'over', axis: 'up', have: 11, need: 8 }, tries: 1 });
    expect(rescue.state.clipped).toEqual([{ value: 5, from: 0 }, { value: 6, from: 2 }]);
    expect(rescue.state.rescued).toBe(false);
  });

  it('is rescued by an exact lift, and then will not change', () => {
    const rescue = createRescue(eight);
    rescue.clip(0);
    rescue.clip(1);
    const [event] = rescue.letGo();
    expect(event?.type === 'released' && event.outcome.verdict).toBe('exact');
    expect(rescue.state.rescued).toBe(true);
    expect(rescue.clip(3)).toEqual([]);
    expect(rescue.unclip(0)).toEqual([]);
    expect(rescue.letGo()).toEqual([]);
  });

  it('judges the wind: its push plus the puffs must reach the ledge', () => {
    const def: RescueDef = { id: 'w', line: '', weight: 4, tray: [], tied: [3, 1], wind: { ledge: 7, wind: 3, puffs: [5, 4, 2] } };
    const short = createRescue(def);
    short.puff(2);
    expect(short.letGo()[0]).toEqual({ type: 'released', outcome: { verdict: 'short', axis: 'across', have: 5, need: 7 }, tries: 1 });

    const right = createRescue(def);
    right.puff(1);
    expect(right.letGo()[0]).toMatchObject({ outcome: { verdict: 'exact' } });
  });

  it('knows which bunch slots are still lifting', () => {
    const rescue = createRescue({ id: 't', line: '', weight: 7, tray: [2], tied: [6, 3, 1] });
    rescue.togglePop(1);
    rescue.clip(0);
    expect(liftedSlots(rescue.state)).toEqual([0, 2, 3]);
  });
});

describe('the finished sum', () => {
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

  it('writes the sideways sum with the wind in it, either way it blows', () => {
    const helping = createRescue({ id: 'w', line: '', weight: 4, tray: [], tied: [3, 1], wind: { ledge: 7, wind: 3, puffs: [4] } });
    helping.puff(0);
    expect(answerLines(helping.state)).toEqual(['3 + 1 = 4', '3 + 4 = 7']);

    const against = createRescue({ id: 'w', line: '', weight: 6, tray: [], tied: [3, 3], wind: { ledge: 5, wind: -2, puffs: [5, 2] } });
    against.puff(0);
    against.puff(1);
    expect(answerLines(against.state)[1]).toBe('5 + 2 − 2 = 5');
  });

  it('says just the number when one balloon did it', () => {
    const rescue = createRescue({ id: 'one', line: '', weight: 3, tray: [3, 5] });
    rescue.clip(0);
    expect(answerLines(rescue.state)).toEqual(['3']);
  });
});
```

- [ ] **Step 2: Run to see it fail**

Run: `npx vitest run games/balloon/src/logic/rescue.test.ts`
Expected: FAIL — `./rescue.js` does not exist.

- [ ] **Step 3: Implement**

```ts
// games/balloon/src/logic/rescue.ts
import { judge, type Outcome } from './outcome.js';
import { hooksOf, tiedOf, type RescueDef } from './rescue-def.js';

/** A balloon or puff taken from a tray, remembering where it came from. */
export interface Taken {
  value: number;
  from: number;
}

export interface TiedBalloon {
  value: number;
  popped: boolean;
}

export interface RescueState {
  readonly def: RescueDef;
  tied: TiedBalloon[];
  clipped: Taken[];
  puffs: Taken[];
  tries: number;
  rescued: boolean;
}

export type RescueEvent =
  | { type: 'clipped'; value: number }
  | { type: 'unclipped'; value: number }
  | { type: 'full' }
  | { type: 'popped'; index: number; value: number }
  | { type: 'reinflated'; index: number; value: number }
  | { type: 'puffed'; value: number }
  | { type: 'unpuffed'; value: number }
  | { type: 'released'; outcome: Outcome; tries: number };

export interface Rescue {
  readonly state: RescueState;
  clip(trayIndex: number): RescueEvent[];
  unclip(slot: number): RescueEvent[];
  togglePop(tiedIndex: number): RescueEvent[];
  puff(puffIndex: number): RescueEvent[];
  unpuff(slot: number): RescueEvent[];
  letGo(): RescueEvent[];
}

const MINUS = '−';
const total = (values: readonly number[]): number => values.reduce((sum, value) => sum + value, 0);

/** Every value still lifting, tied first, in the order they hang on the harness. */
export const liftedValues = (state: RescueState): number[] => [
  ...state.tied.filter((balloon) => !balloon.popped).map((balloon) => balloon.value),
  ...state.clipped.map((taken) => taken.value),
];

/** The bunch slots of those same balloons: tied first, then clipped. */
export const liftedSlots = (state: RescueState): number[] => [
  ...state.tied.flatMap((balloon, index) => (balloon.popped ? [] : [index])),
  ...state.clipped.map((_, index) => state.tied.length + index),
];

export const liftOf = (state: RescueState): number => total(liftedValues(state));
export const puffTotal = (state: RescueState): number => total(state.puffs.map((taken) => taken.value));
/** A popped balloon still hangs on its hook. */
export const hooksUsed = (state: RescueState): number => state.tied.length + state.clipped.length;
export const trayTaken = (state: RescueState, index: number): boolean =>
  state.clipped.some((taken) => taken.from === index);
export const puffTaken = (state: RescueState, index: number): boolean =>
  state.puffs.some((taken) => taken.from === index);
export const canLetGo = (state: RescueState): boolean => !state.rescued && hooksUsed(state) > 0;

export function outcomeOf(state: RescueState): Outcome {
  const wind = state.def.wind;
  return judge(
    liftOf(state),
    state.def.weight,
    wind ? { have: wind.wind + puffTotal(state), need: wind.ledge } : undefined,
  );
}

/**
 * The sum the rescue made, written out for the moment it lands. That beat is
 * the teaching: the child sees their bunch turned into arithmetic. A pop is
 * written as taking away, because that is what it was.
 */
export function answerLines(state: RescueState): string[] {
  const popped = state.tied.filter((balloon) => balloon.popped).map((balloon) => balloon.value);
  const lifted = liftedValues(state);
  const lines: string[] = [];

  if (popped.length > 0) {
    const whole = total(state.tied.map((balloon) => balloon.value));
    const terms = [String(whole), ...popped.map((value) => `${MINUS} ${value}`), ...state.clipped.map((taken) => `+ ${taken.value}`)];
    lines.push(`${terms.join(' ')} = ${state.def.weight}`);
  } else if (lifted.length > 1) {
    lines.push(`${lifted.join(' + ')} = ${state.def.weight}`);
  } else {
    lines.push(String(state.def.weight));
  }

  const wind = state.def.wind;
  if (wind) {
    const puffs = state.puffs.map((taken) => taken.value);
    const terms =
      wind.wind > 0
        ? [String(wind.wind), ...puffs.map((value) => `+ ${value}`)]
        : wind.wind < 0
          ? [puffs.join(' + '), `${MINUS} ${-wind.wind}`]
          : [puffs.join(' + ')];
    lines.push(`${terms.join(' ')} = ${wind.ledge}`);
  }
  return lines;
}

export function createRescue(def: RescueDef): Rescue {
  const state: RescueState = {
    def,
    tied: tiedOf(def).map((value) => ({ value, popped: false })),
    clipped: [],
    puffs: [],
    tries: 0,
    rescued: false,
  };

  return {
    state,

    clip(index) {
      const value = def.tray[index];
      if (state.rescued || value === undefined || trayTaken(state, index)) return [];
      if (hooksUsed(state) >= hooksOf(def)) return [{ type: 'full' }];
      state.clipped.push({ value, from: index });
      return [{ type: 'clipped', value }];
    },

    unclip(slot) {
      const taken = state.clipped[slot];
      if (state.rescued || !taken) return [];
      state.clipped.splice(slot, 1);
      return [{ type: 'unclipped', value: taken.value }];
    },

    togglePop(index) {
      const balloon = state.tied[index];
      if (state.rescued || !balloon) return [];
      balloon.popped = !balloon.popped;
      return [{ type: balloon.popped ? 'popped' : 'reinflated', index, value: balloon.value }];
    },

    puff(index) {
      const value = def.wind?.puffs[index];
      if (state.rescued || value === undefined || puffTaken(state, index)) return [];
      state.puffs.push({ value, from: index });
      return [{ type: 'puffed', value }];
    },

    unpuff(slot) {
      const taken = state.puffs[slot];
      if (state.rescued || !taken) return [];
      state.puffs.splice(slot, 1);
      return [{ type: 'unpuffed', value: taken.value }];
    },

    letGo() {
      if (!canLetGo(state)) return [];
      state.tries += 1;
      const outcome = outcomeOf(state);
      if (outcome.verdict === 'exact') state.rescued = true;
      return [{ type: 'released', outcome, tries: state.tries }];
    },
  };
}
```

- [ ] **Step 4: Run to see it pass**

Run: `npx vitest run games/balloon/src/logic && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add games/balloon/src/logic/rescue.ts games/balloon/src/logic/rescue.test.ts
git commit -m "feat(balloon): the rescue — clip, pop, puff, and let go"
```

---

### Task 4: The solver

**Files:**
- Create: `games/balloon/src/logic/solver.ts`, `games/balloon/src/logic/solver.test.ts`

**Interfaces:**
- Consumes: `RescueDef`, `hooksOf`, `tiedOf` (Task 2).
- Produces: `interface Answer { clip: number[]; pop: number[]; puffs: number[] }` (tray, tied and puff indices); `subsetsOf(size): number[][]`; `totalAt(values, indices): number`; `solve(def): Answer[]`; `needsPop(def): boolean`.

- [ ] **Step 1: Write the failing test**

```ts
// games/balloon/src/logic/solver.test.ts
import { describe, it, expect } from 'vitest';
import { createRescue } from './rescue.js';
import { needsPop, solve, subsetsOf } from './solver.js';
import type { RescueDef } from './rescue-def.js';

describe('the solver', () => {
  it('lists every subset once', () => {
    expect(subsetsOf(0)).toEqual([[]]);
    expect(subsetsOf(3)).toHaveLength(8);
  });

  it('finds every bunch that makes the weight', () => {
    const answers = solve({ id: 'a', line: '', weight: 7, tray: [6, 4, 3, 1] });
    expect(answers.map((answer) => answer.clip)).toEqual(
      expect.arrayContaining([
        [0, 3],
        [1, 2],
      ]),
    );
    expect(answers).toHaveLength(2);
  });

  it('respects the hook limit', () => {
    const def: RescueDef = { id: 'h', line: '', weight: 12, hooks: 2, tray: [4, 4, 4, 8] };
    expect(solve(def).every((answer) => answer.clip.length <= 2)).toBe(true);
    expect(solve({ ...def, tray: [4, 4, 4] })).toEqual([]);
  });

  it('pops tied balloons when it must', () => {
    const def: RescueDef = { id: 'p', line: '', weight: 7, tray: [], tied: [6, 3, 1] };
    expect(solve(def)).toEqual([{ clip: [], pop: [1], puffs: [] }]);
    expect(needsPop(def)).toBe(true);
    expect(needsPop({ id: 'n', line: '', weight: 3, tray: [3] })).toBe(false);
  });

  it('only accepts puffs that land on the ledge', () => {
    const def: RescueDef = { id: 'w', line: '', weight: 4, tray: [], tied: [3, 1], wind: { ledge: 7, wind: 3, puffs: [5, 4, 2] } };
    expect(solve(def)).toEqual([{ clip: [], pop: [], puffs: [1] }]);
  });

  it('gives answers that really do rescue', () => {
    const def: RescueDef = { id: 'x', line: '', weight: 10, tray: [2], tied: [9, 5, 3] };
    for (const answer of solve(def)) {
      const rescue = createRescue(def);
      answer.pop.forEach((index) => rescue.togglePop(index));
      answer.clip.forEach((index) => rescue.clip(index));
      answer.puffs.forEach((index) => rescue.puff(index));
      rescue.letGo();
      expect(rescue.state.rescued).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run to see it fail**

Run: `npx vitest run games/balloon/src/logic/solver.test.ts`
Expected: FAIL — `./solver.js` does not exist.

- [ ] **Step 3: Implement**

```ts
// games/balloon/src/logic/solver.ts
import { hooksOf, tiedOf, type RescueDef } from './rescue-def.js';

/** One way through a rescue: which tray balloons to clip, tied ones to pop, puffs to add. */
export interface Answer {
  clip: number[];
  pop: number[];
  puffs: number[];
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
 * Brute force over clips, pops and puffs. Proof, not play: the tests use it to
 * show every rescue is answerable and to check what each chapter is for.
 */
export function solve(def: RescueDef): Answer[] {
  const tied = tiedOf(def);
  const tiedTotal = totalAt(tied, tied.map((_, index) => index));
  const wind = def.wind;
  const puffSets = wind
    ? subsetsOf(wind.puffs.length).filter((set) => wind.wind + totalAt(wind.puffs, set) === wind.ledge)
    : [[]];

  const answers: Answer[] = [];
  for (const pop of subsetsOf(tied.length)) {
    for (const clip of subsetsOf(def.tray.length)) {
      if (tied.length + clip.length > hooksOf(def)) continue;
      if (tiedTotal - totalAt(tied, pop) + totalAt(def.tray, clip) !== def.weight) continue;
      for (const puffs of puffSets) answers.push({ clip, pop, puffs });
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

- [ ] **Step 4: Run to see it pass**

Run: `npx vitest run games/balloon/src/logic && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add games/balloon/src/logic/solver.ts games/balloon/src/logic/solver.test.ts
git commit -m "feat(balloon): a solver that proves a rescue answerable"
```

---

### Task 5: The chapters, and the rules that make them a curriculum

**Files:**
- Create: `games/balloon/src/logic/levels.data.ts`, `games/balloon/src/logic/levels.test.ts`

**Interfaces:**
- Consumes: `ChapterDef`, `RescueDef`, `problemsWith`, `hooksOf`, `tiedOf`, `acrossNeed`, `DEFAULT_HOOKS` (Task 2); `solve`, `needsPop`, `subsetsOf`, `totalAt` (Task 4).
- Produces: `CHAPTERS: readonly ChapterDef[]`; `RESCUES: readonly RescueDef[]` (every rescue in order); `chapterOf(def): ChapterDef`; `numberInChapter(def): number` (1-based).

Rescue ids are `<chapter id>-<n>`, so `pop-1` is the first rescue of Pop!. Every number below was checked against every rule in the test before this plan was written; if one is changed, the test says which rule broke.

- [ ] **Step 1: Write the failing test**

```ts
// games/balloon/src/logic/levels.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { CHAPTERS, RESCUES, chapterOf, numberInChapter } from './levels.data.js';
import { acrossNeed, DEFAULT_HOOKS, hooksOf, problemsWith, tiedOf, type RescueDef } from './rescue-def.js';
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

  it('asks for a weight in its chapter\'s range', () => {
    for (const each of CHAPTERS) {
      for (const rescue of each.rescues) {
        expect(rescue.weight, rescue.id).toBeGreaterThanOrEqual(each.targets[0]);
        expect(rescue.weight, rescue.id).toBeLessThanOrEqual(each.targets[1]);
      }
    }
  });

  it('needs between 3 and 10 steps of puffs whenever there is wind', () => {
    for (const rescue of RESCUES) {
      if (!rescue.wind) continue;
      expect(acrossNeed(rescue.wind), rescue.id).toBeGreaterThanOrEqual(3);
      expect(acrossNeed(rescue.wind), rescue.id).toBeLessThanOrEqual(10);
    }
  });

  it('can be answered by one matching balloon only in the very first rescue', () => {
    const matches = (rescue: RescueDef) => tiedOf(rescue).length === 0 && rescue.tray.includes(rescue.weight);
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

  it('Windy Ridge is all wind, and its first rescues come with the lift already right', () => {
    const rescues = chapter('windy-ridge').rescues;
    for (const rescue of rescues) expect(rescue.wind, rescue.id).toBeDefined();
    for (const rescue of rescues.slice(0, 3)) {
      expect(totalAt(tiedOf(rescue), tiedOf(rescue).map((_, index) => index)), rescue.id).toBe(rescue.weight);
    }
  });

  it('Windy Ridge saves the wind blowing against you for last', () => {
    const rescues = chapter('windy-ridge').rescues;
    expect(rescues.at(-1)!.wind!.wind).toBeLessThan(0);
    for (const rescue of rescues.slice(0, -1)) expect(rescue.wind!.wind, rescue.id).toBeGreaterThan(0);
  });

  it('every rescue in The Big Rescue needs two ideas at once', () => {
    for (const rescue of chapter('big-rescue').rescues) {
      const ideas = [rescue.weight > 10, hooksOf(rescue) < DEFAULT_HOOKS, needsPop(rescue), Boolean(rescue.wind)];
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

- [ ] **Step 2: Run to see it fail**

Run: `npx vitest run games/balloon/src/logic/levels.test.ts`
Expected: FAIL — `./levels.data.js` does not exist.

- [ ] **Step 3: Write the data**

```ts
// games/balloon/src/logic/levels.data.ts
import type { ChapterDef, RescueDef } from './rescue-def.js';

type Draft = Omit<RescueDef, 'id'>;

/** Ids are `<chapter>-<n>`, so a URL can name a rescue: `?level=pop-1`. */
const chapter = (id: string, title: string, targets: readonly [number, number], drafts: readonly Draft[]): ChapterDef => ({
  id,
  title,
  targets,
  rescues: drafts.map((draft, index) => ({ id: `${id}-${index + 1}`, ...draft })),
});

/**
 * Eight chapters, each one idea introduced and then practised. The tray is the
 * level design: the balloon a size-only guess would grab first is almost never
 * part of the answer, and every rule this data has to keep is a test in
 * levels.test.ts.
 */
export const CHAPTERS: readonly ChapterDef[] = [
  // Exact lift floats. The first rescue is the only one a single matching
  // balloon can answer; it is there to show what "just right" looks like.
  chapter('first-flight', 'First Flight', [2, 6], [
    { line: 'Pip is stuck at the bottom of the hill', weight: 3, tray: [3, 5] },
    { line: 'The picnic is up on the cliff', weight: 4, tray: [3, 6, 1] },
    { line: 'Bo got left behind!', weight: 5, tray: [2, 6, 3] },
    { line: 'Tilly wants to fly up to the others', weight: 6, tray: [4, 8, 2, 1] },
  ]),
  // Going over sends you flying. Every tray holds a pair that overshoots by
  // a little, because a near miss is the one that has to be worked out.
  chapter('whoosh', 'Whoosh!', [5, 10], [
    { line: 'Careful, not too high!', weight: 7, tray: [6, 4, 3, 1] },
    { line: 'Just enough to reach the top', weight: 8, tray: [7, 5, 3, 2] },
    { line: 'Juno is scared of the clouds', weight: 6, tray: [5, 4, 2, 1] },
    { line: 'Up, but not up and away', weight: 9, tray: [8, 6, 3, 2] },
    { line: 'Pick exactly the right lift', weight: 10, tray: [9, 7, 4, 3, 1] },
  ]),
  // No pair makes the weight, so every answer is three balloons or more.
  chapter('big-bunches', 'Big Bunches', [6, 10], [
    { line: 'Two balloons are not enough this time', weight: 9, tray: [4, 4, 6, 1] },
    { line: 'Try a bigger bunch', weight: 7, tray: [2, 2, 3, 6] },
    { line: 'Three balloons, all together', weight: 10, tray: [3, 3, 4, 8] },
    { line: 'Little ones add up', weight: 8, tray: [3, 1, 4, 6] },
    { line: 'Every balloon helps', weight: 6, tray: [1, 2, 3, 7] },
  ]),
  // Past ten, with a 10-balloon to make ten and then a bit more.
  chapter('heavy-cargo', 'Heavy Cargo', [11, 20], [
    { line: 'Bo packed a heavy backpack', weight: 13, tray: [10, 8, 3, 2] },
    { line: 'Pip ate all the berries', weight: 12, tray: [10, 9, 2, 1, 4] },
    { line: 'Tilly is carrying the picnic basket', weight: 15, tray: [10, 7, 5, 6, 2] },
    { line: 'Two kits hugging tight', weight: 17, tray: [10, 9, 4, 3, 8] },
    { line: 'The heaviest rescue yet!', weight: 20, tray: [10, 9, 8, 6, 5, 2] },
  ]),
  // A right answer that needs too many hooks sits in every tray beside one
  // that fits, so the limit changes which answer is right.
  chapter('tiny-harness', 'Tiny Harness', [8, 16], [
    { line: 'This harness only has two hooks', weight: 12, hooks: 2, tray: [4, 4, 4, 8, 6, 5] },
    { line: 'Two balloons, no more', weight: 10, hooks: 2, tray: [3, 3, 4, 7, 2, 6] },
    { line: 'Make every hook count', weight: 15, hooks: 2, tray: [5, 5, 5, 9, 6, 8] },
    { line: 'Three hooks this time', weight: 14, hooks: 3, tray: [2, 3, 4, 5, 8, 7, 1] },
    { line: 'Big balloons save hooks', weight: 16, hooks: 3, tray: [4, 4, 4, 4, 9, 5, 2] },
  ]),
  // Taking away. The first has an empty tray, so popping is the only thing to
  // try; the last pops one and clips one.
  chapter('pop', 'Pop!', [5, 15], [
    { line: 'Juno grabbed too many balloons!', weight: 7, tray: [], tied: [6, 3, 1] },
    { line: 'Pop one to float just right', weight: 5, tray: [], tied: [4, 2, 3] },
    { line: 'Which ones should go?', weight: 9, tray: [], tied: [5, 4, 3, 2] },
    { line: 'Way too much lift again', weight: 12, tray: [], tied: [7, 5, 3, 2] },
    { line: 'Pop one, then add one', weight: 10, tray: [2], tied: [9, 5, 3] },
  ]),
  // Sideways: the wind gives some, the puffs make up the rest. The lift comes
  // ready for the first three so the only new thing is the sideways number.
  chapter('windy-ridge', 'Windy Ridge', [2, 10], [
    { line: 'The wind is helping!', weight: 4, tray: [], tied: [3, 1], wind: { ledge: 7, wind: 3, puffs: [5, 4, 2] } },
    { line: 'A few puffs more', weight: 5, tray: [], tied: [2, 3], wind: { ledge: 8, wind: 3, puffs: [4, 3, 2, 1] } },
    { line: 'Blow Pip across to the ledge', weight: 6, tray: [], tied: [4, 2], wind: { ledge: 6, wind: 1, puffs: [3, 3, 2, 4] } },
    { line: 'Up first, then across', weight: 8, tray: [5, 3, 6], wind: { ledge: 9, wind: 4, puffs: [5, 3, 2] } },
    { line: 'Oh no, the wind is blowing back!', weight: 6, tray: [], tied: [3, 3], wind: { ledge: 5, wind: -2, puffs: [5, 4, 3, 2] } },
  ]),
  // Two ideas in every rescue.
  chapter('big-rescue', 'The Big Rescue', [5, 20], [
    { line: 'Two hooks, and the wind against you', weight: 15, hooks: 2, tray: [10, 5, 6, 7, 4, 3], wind: { ledge: 4, wind: -2, puffs: [4, 3, 2, 1] } },
    { line: 'A heavy load and too much lift', weight: 13, tray: [3], tied: [10, 6] },
    { line: 'Big load, little harness', weight: 18, hooks: 3, tray: [10, 9, 8, 6, 5, 3, 2] },
    { line: 'Pop, puff and up!', weight: 12, tray: [], tied: [7, 6, 4, 1], wind: { ledge: 8, wind: 5, puffs: [4, 3, 2, 1] } },
    { line: 'The last kit to rescue!', weight: 17, hooks: 2, tray: [10, 9, 8, 7, 6, 4, 3], wind: { ledge: 6, wind: -1, puffs: [5, 2, 3, 4] } },
  ]),
];

export const RESCUES: readonly RescueDef[] = CHAPTERS.flatMap((each) => each.rescues);

const CHAPTER_BY_RESCUE = new Map<string, ChapterDef>(
  CHAPTERS.flatMap((each) => each.rescues.map((rescue) => [rescue.id, each] as const)),
);

export function chapterOf(def: RescueDef): ChapterDef {
  const found = CHAPTER_BY_RESCUE.get(def.id);
  if (!found) throw new Error(`no chapter holds ${def.id}`);
  return found;
}

export const numberInChapter = (def: RescueDef): number =>
  chapterOf(def).rescues.findIndex((rescue) => rescue.id === def.id) + 1;
```

- [ ] **Step 4: Run to see it pass**

Run: `npx vitest run games/balloon/src/logic && npm run typecheck`
Expected: PASS. If a curriculum rule fails, the message names the rescue id: fix the data, never the rule.

- [ ] **Step 5: Commit**

```bash
git add games/balloon/src/logic/levels.data.ts games/balloon/src/logic/levels.test.ts
git commit -m "feat(balloon): eight chapters, and the rules that make them a curriculum"
```

---

### Task 6: The tests that guard the design

**Files:**
- Create: `games/balloon/src/logic/guards.test.ts`

**Interfaces:**
- Consumes: `RESCUES`, `CHAPTERS` (Task 5); `createRescue`, `liftOf`, `puffTotal` (Task 3); `solve` (Task 4); `starsFor` (Task 2); `acrossNeed` (Task 2); `createRng` from `@bundle/core`.

These three bots are the spec's promise that the arithmetic is load-bearing. If a size-only bot does well, fix the levels, never the test.

- [ ] **Step 1: Write the test**

```ts
// games/balloon/src/logic/guards.test.ts
import { describe, it, expect } from 'vitest';
import { createRng } from '@bundle/core';
import { CHAPTERS, RESCUES } from './levels.data.js';
import { createRescue, liftOf, puffTotal, type Rescue } from './rescue.js';
import { acrossNeed, type RescueDef } from './rescue-def.js';
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
    if (liftOf(rescue.state) >= def.weight) break;
    if (rescue.clip(index).some((event) => event.type === 'full')) break;
  }
  if (def.wind) {
    for (const { index } of biggestFirst(def.wind.puffs)) {
      if (puffTotal(rescue.state) >= acrossNeed(def.wind)) break;
      rescue.puff(index);
    }
  }
  return exactOnLetGo(rescue);
};

/** Clips, pops and puffs at random and lets go, over and over. */
const randomStars = (def: RescueDef, seed: number): number => {
  const rng = createRng(seed);
  const rescue = createRescue(def);
  const wind = def.wind;
  for (let attempt = 0; attempt < 60 && !rescue.state.rescued; attempt += 1) {
    while (rescue.state.clipped.length > 0) rescue.unclip(0);
    while (rescue.state.puffs.length > 0) rescue.unpuff(0);
    rescue.state.tied.forEach((balloon, index) => {
      if (balloon.popped) rescue.togglePop(index);
      if (rng.next() < 0.5) rescue.togglePop(index);
    });
    def.tray.forEach((_, index) => {
      if (rng.next() < 0.5) rescue.clip(index);
    });
    wind?.puffs.forEach((_, index) => {
      if (rng.next() < 0.5) rescue.puff(index);
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
      answer.puffs.forEach((index) => rescue.puff(index));
      expect(exactOnLetGo(rescue), def.id).toBe(true);
      expect(starsFor(rescue.state.tries)).toBe(3);
    }
  });
});
```

- [ ] **Step 2: Run it**

Run: `npx vitest run games/balloon/src/logic/guards.test.ts`
Expected: PASS (the data was checked against these bots before the plan was written: the size-only bot is right first time on 0 of 35 rescues after chapter 1, and random play averages about 1.2 stars). If it fails, the levels have regressed.

- [ ] **Step 3: Commit**

```bash
git add games/balloon/src/logic/guards.test.ts
git commit -m "test(balloon): proof a size-only guess and random play both lose"
```

---

### Task 7: Progress and the driver

**Files:**
- Create: `games/balloon/src/logic/progress.ts`, `games/balloon/src/logic/progress.test.ts`
- Create: `games/balloon/src/intent.ts`
- Create: `games/balloon/src/view/timing.ts`
- Create: `games/balloon/src/driver.ts`, `games/balloon/src/driver.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 2–5.
- Produces from `progress.ts`: `readBook(raw: unknown): StarBook`; `resumeIndex(book): number`; `startIndex(book, startLevel?): number`; `totalStars(book): number`; `MAX_STARS: number`.
- Produces from `intent.ts`: `type Intent = { kind: 'tray'; index: number } | { kind: 'clipped'; slot: number } | { kind: 'tied'; index: number } | { kind: 'puff'; index: number } | { kind: 'puffSlot'; slot: number } | { kind: 'letGo' } | { kind: 'next' }`.
- Produces from `view/timing.ts`: `TIMING`; `countSeconds(balloons): number`; `flySeconds(outcome): number`.
- Produces from `driver.ts`: `type Phase = 'building' | 'flying' | 'rescued' | 'finished'`; `interface Flight { outcome: Outcome; t: number; count: number; fly: number; lifted: readonly number[] }`; `type DriverEvent`; `interface Driver { readonly phase; readonly rescue: Rescue; readonly flight: Flight | null; readonly feedback: Outcome | null; readonly earned: number | null; readonly book: StarBook; step(dt): DriverEvent[]; act(intent): DriverEvent[]; model(): SceneModel }`; `createDriver({ book, startLevel? }): Driver`. `SceneModel` is defined here and used by the scene in Task 10.

- [ ] **Step 1: Write the failing tests**

```ts
// games/balloon/src/logic/progress.test.ts
import { describe, it, expect } from 'vitest';
import { MAX_STARS, readBook, resumeIndex, startIndex, totalStars } from './progress.js';
import { RESCUES } from './levels.data.js';

const indexOf = (id: string) => RESCUES.findIndex((rescue) => rescue.id === id);

describe('progress', () => {
  it('opens a new player at the very first rescue', () => {
    expect(resumeIndex({})).toBe(0);
  });

  it('picks up at the first rescue without stars', () => {
    expect(resumeIndex({ 'first-flight-1': 3, 'first-flight-2': 1 })).toBe(2);
  });

  it('goes round again once everything has stars', () => {
    const all = Object.fromEntries(RESCUES.map((rescue) => [rescue.id, 3]));
    expect(resumeIndex(all)).toBe(0);
    expect(totalStars(all)).toBe(MAX_STARS);
  });

  it('opens a named rescue, or the first rescue of a named chapter', () => {
    expect(startIndex({}, 'pop-3')).toBe(indexOf('pop-3'));
    expect(startIndex({}, 'windy-ridge')).toBe(indexOf('windy-ridge-1'));
  });

  it('ignores a level it does not know and opens where the player left off', () => {
    expect(startIndex({ 'first-flight-1': 2 }, 'nonsense')).toBe(1);
  });

  it('survives saved stars that are damaged or out of date', () => {
    expect(readBook(null)).toEqual({});
    expect(readBook('3')).toEqual({});
    expect(readBook([3, 3])).toEqual({});
    expect(readBook({ 'first-flight-1': 'three', 'first-flight-2': 2, gone: 3, 'whoosh-1': 9 })).toEqual({
      'first-flight-2': 2,
      gone: 3,
    });
    expect(totalStars({ gone: 3 })).toBe(0);
  });
});
```

```ts
// games/balloon/src/driver.test.ts
import { describe, it, expect } from 'vitest';
import { createDriver, type Driver } from './driver.js';
import { RESCUES } from './logic/levels.data.js';

const FRAME = 1 / 60;

const settle = (driver: Driver) => {
  const events = [];
  for (let i = 0; i < 60 * 12 && driver.phase === 'flying'; i += 1) events.push(...driver.step(FRAME));
  return events;
};

describe('the driver', () => {
  it('announces the chapter it opens in', () => {
    const driver = createDriver({ book: {} });
    expect(driver.step(FRAME)).toEqual([{ type: 'chapter', chapter: expect.objectContaining({ id: 'first-flight' }) }]);
    expect(driver.step(FRAME)).toEqual([]);
  });

  it('flies after "Let go!", then comes back with the gap to fix', () => {
    const driver = createDriver({ book: {} });
    driver.act({ kind: 'tray', index: 1 }); // the 5, for a weight of 3
    driver.act({ kind: 'letGo' });
    expect(driver.phase).toBe('flying');
    const events = settle(driver);
    expect(events).toContainEqual({ type: 'landed', outcome: { verdict: 'over', axis: 'up', have: 5, need: 3 } });
    expect(driver.phase).toBe('building');
    expect(driver.feedback?.verdict).toBe('over');
    expect(driver.rescue.state.clipped).toHaveLength(1);
  });

  it('forgets the old verdict as soon as the bunch changes', () => {
    const driver = createDriver({ book: {} });
    driver.act({ kind: 'tray', index: 1 });
    driver.act({ kind: 'letGo' });
    settle(driver);
    driver.act({ kind: 'clipped', slot: 0 });
    expect(driver.feedback).toBeNull();
  });

  it('ignores every tap while the kit is in the air', () => {
    const driver = createDriver({ book: {} });
    driver.act({ kind: 'tray', index: 1 });
    driver.act({ kind: 'letGo' });
    driver.step(FRAME);
    expect(driver.act({ kind: 'tray', index: 0 })).toEqual([]);
    expect(driver.act({ kind: 'letGo' })).toEqual([]);
    expect(driver.rescue.state.tries).toBe(1);
    expect(driver.rescue.state.clipped).toHaveLength(1);
  });

  it('records stars for a rescue, and moves on when asked', () => {
    const driver = createDriver({ book: {} });
    driver.act({ kind: 'tray', index: 0 });
    driver.act({ kind: 'letGo' });
    const events = settle(driver);
    expect(events).toContainEqual({ type: 'rescued', id: 'first-flight-1', stars: 3, book: { 'first-flight-1': 3 } });
    expect(driver.phase).toBe('rescued');
    expect(driver.earned).toBe(3);
    expect(driver.act({ kind: 'tray', index: 0 })).toEqual([]);
    driver.act({ kind: 'next' });
    expect(driver.phase).toBe('building');
    expect(driver.rescue.state.def.id).toBe('first-flight-2');
  });

  it('announces a new chapter when one begins', () => {
    const lastOfFirst = RESCUES.findIndex((rescue) => rescue.id === 'first-flight-4');
    const driver = createDriver({ book: {}, startLevel: RESCUES[lastOfFirst]!.id });
    driver.step(FRAME);
    driver.act({ kind: 'tray', index: 0 }); // 4
    driver.act({ kind: 'tray', index: 2 }); // 2
    driver.act({ kind: 'letGo' });
    settle(driver);
    expect(driver.act({ kind: 'next' })).toEqual([{ type: 'chapter', chapter: expect.objectContaining({ id: 'whoosh' }) }]);
  });

  it('finishes after the last rescue, and starts over from there', () => {
    const driver = createDriver({ book: {}, startLevel: 'big-rescue-5' });
    // 10 + 7, and 5 + 2 across a wind of −1 to a ledge 6 steps away.
    driver.act({ kind: 'tray', index: 0 });
    driver.act({ kind: 'tray', index: 3 });
    driver.act({ kind: 'puff', index: 0 });
    driver.act({ kind: 'puff', index: 1 });
    driver.act({ kind: 'letGo' });
    settle(driver);
    expect(driver.phase).toBe('rescued');
    expect(driver.act({ kind: 'next' })).toEqual([{ type: 'finished' }]);
    expect(driver.phase).toBe('finished');
    driver.act({ kind: 'next' });
    expect(driver.rescue.state.def.id).toBe('first-flight-1');
  });

  it('counts the balloons before the flight, one beat each', () => {
    const driver = createDriver({ book: {}, startLevel: 'whoosh-1' });
    driver.act({ kind: 'tray', index: 1 });
    driver.act({ kind: 'tray', index: 2 });
    driver.act({ kind: 'letGo' });
    expect(driver.flight?.lifted).toEqual([4, 3]);
    expect(driver.flight!.count).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run to see them fail**

Run: `npx vitest run games/balloon/src/logic/progress.test.ts games/balloon/src/driver.test.ts`
Expected: FAIL — the modules do not exist.

- [ ] **Step 3: Implement progress, intent and timing**

```ts
// games/balloon/src/logic/progress.ts
import { CHAPTERS, RESCUES } from './levels.data.js';
import type { StarBook } from './stars.js';

/**
 * Whatever storage hands back, made safe. Storage is a convenience: an old save,
 * a damaged one or someone else's must never stop the game opening.
 */
export function readBook(raw: unknown): StarBook {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const book: StarBook = {};
  for (const [id, value] of Object.entries(raw)) {
    if (typeof value === 'number' && value >= 1 && value <= 3) book[id] = Math.floor(value);
  }
  return book;
}

/** The first rescue without stars; the beginning again once all have them. */
export function resumeIndex(book: StarBook): number {
  const index = RESCUES.findIndex((rescue) => (book[rescue.id] ?? 0) < 1);
  return index < 0 ? 0 : index;
}

/** A rescue id or chapter id from the URL, else where the player left off. */
export function startIndex(book: StarBook, startLevel?: string): number {
  if (startLevel) {
    const byRescue = RESCUES.findIndex((rescue) => rescue.id === startLevel);
    if (byRescue >= 0) return byRescue;
    const first = CHAPTERS.find((each) => each.id === startLevel)?.rescues[0];
    if (first) return RESCUES.indexOf(first);
  }
  return resumeIndex(book);
}

export const totalStars = (book: StarBook): number =>
  RESCUES.reduce((sum, rescue) => sum + (book[rescue.id] ?? 0), 0);

export const MAX_STARS = RESCUES.length * 3;
```

```ts
// games/balloon/src/intent.ts
/** Everything a tap can mean. Input produces these; the driver acts on them. */
export type Intent =
  | { kind: 'tray'; index: number }
  | { kind: 'clipped'; slot: number }
  | { kind: 'tied'; index: number }
  | { kind: 'puff'; index: number }
  | { kind: 'puffSlot'; slot: number }
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
    /** Up to the ledge and a step onto it. */
    exact: 2.8,
    /** Up past the ledge, a cloud, and the parachute down. */
    over: 3.8,
    /** Up, across to where the puffs reached, and the parachute down. */
    across: 4.0,
  },
  chapterAnnounceSeconds: 2.3,
  chapterSettleFraction: 0.26,
  popSeconds: 0.4,
  solvedSeconds: 1.2,
  starsDelaySeconds: 0.9,
  starSeconds: 0.35,
} as const;

export const countSeconds = (balloons: number): number =>
  Math.min(TIMING.countMax, balloons * TIMING.countPerBalloon);

export const flySeconds = (outcome: Outcome): number => {
  if (outcome.verdict === 'exact') return TIMING.flight.exact;
  if (outcome.axis === 'across') return TIMING.flight.across;
  return outcome.verdict === 'short' ? TIMING.flight.short : TIMING.flight.over;
};
```

- [ ] **Step 4: Implement the driver**

```ts
// games/balloon/src/driver.ts
import type { Intent } from './intent.js';
import { RESCUES, chapterOf, numberInChapter } from './logic/levels.data.js';
import type { Outcome } from './logic/outcome.js';
import { MAX_STARS, startIndex, totalStars } from './logic/progress.js';
import { createRescue, liftedValues, type Rescue, type RescueEvent, type RescueState } from './logic/rescue.js';
import type { ChapterDef } from './logic/rescue-def.js';
import { recordStars, starsFor, type StarBook } from './logic/stars.js';
import { countSeconds, flySeconds } from './view/timing.js';

export type Phase = 'building' | 'flying' | 'rescued' | 'finished';

/** One "Let go!": the count, then the flight. `t` runs across both. */
export interface Flight {
  outcome: Outcome;
  t: number;
  count: number;
  fly: number;
  lifted: readonly number[];
}

export type DriverEvent =
  | RescueEvent
  | { type: 'chapter'; chapter: ChapterDef }
  | { type: 'landed'; outcome: Outcome }
  | { type: 'rescued'; id: string; stars: number; book: StarBook }
  | { type: 'finished' };

/** Everything the scene draws from. */
export interface SceneModel {
  rescue: RescueState;
  chapter: ChapterDef;
  number: number;
  phase: Phase;
  flight: Flight | null;
  feedback: Outcome | null;
  earned: number | null;
  totalStars: number;
  maxStars: number;
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
  /** The last wrong try, until the bunch changes. */
  readonly feedback: Outcome | null;
  /** Stars for the rescue just finished. */
  readonly earned: number | null;
  readonly book: StarBook;
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
  let feedback: Outcome | null = null;
  let earned: number | null = null;
  let pending: DriverEvent[] = [{ type: 'chapter', chapter: chapterOf(rescue.state.def) }];

  const open = (next: number): DriverEvent[] => {
    const before = chapterOf(rescue.state.def);
    index = next;
    rescue = rescueAt(index);
    phase = 'building';
    flight = null;
    feedback = null;
    earned = null;
    const chapter = chapterOf(rescue.state.def);
    return chapter === before ? [] : [{ type: 'chapter', chapter }];
  };

  const build = (intent: Intent): RescueEvent[] => {
    switch (intent.kind) {
      case 'tray':
        return rescue.clip(intent.index);
      case 'clipped':
        return rescue.unclip(intent.slot);
      case 'tied':
        return rescue.togglePop(intent.index);
      case 'puff':
        return rescue.puff(intent.index);
      case 'puffSlot':
        return rescue.unpuff(intent.slot);
      case 'letGo':
        return rescue.letGo();
      case 'next':
        return [];
    }
  };

  return {
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

    act(intent) {
      if (phase === 'rescued' || phase === 'finished') {
        if (intent.kind !== 'next') return [];
        if (phase === 'finished') return open(0);
        if (index + 1 >= RESCUES.length) {
          phase = 'finished';
          return [{ type: 'finished' }];
        }
        return open(index + 1);
      }
      if (phase !== 'building') return [];

      const events = build(intent);
      if (events.length > 0) feedback = null;
      for (const event of events) {
        if (event.type !== 'released') continue;
        const lifted = liftedValues(rescue.state);
        flight = {
          outcome: event.outcome,
          t: 0,
          count: countSeconds(lifted.length),
          fly: flySeconds(event.outcome),
          lifted,
        };
        phase = 'flying';
      }
      return events;
    },

    step(dt) {
      const events = pending;
      pending = [];
      if (phase !== 'flying' || !flight) return events;

      flight.t += dt;
      if (flight.t < flight.count + flight.fly) return events;

      const outcome = flight.outcome;
      flight = null;
      events.push({ type: 'landed', outcome });
      if (outcome.verdict === 'exact') {
        const id = rescue.state.def.id;
        earned = starsFor(rescue.state.tries);
        book = recordStars(book, id, earned);
        phase = 'rescued';
        events.push({ type: 'rescued', id, stars: earned, book });
      } else {
        phase = 'building';
        feedback = outcome;
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
    }),
  };
}
```

- [ ] **Step 5: Run to see them pass**

Run: `npx vitest run games/balloon && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add games/balloon/src/logic/progress.ts games/balloon/src/logic/progress.test.ts games/balloon/src/intent.ts games/balloon/src/view/timing.ts games/balloon/src/driver.ts games/balloon/src/driver.test.ts
git commit -m "feat(balloon): progress, and a driver that strings rescues together"
```

---

### Task 8: Where everything sits, and how the kit flies

**Files:**
- Create: `games/balloon/src/view/geometry.ts`, `games/balloon/src/view/geometry.test.ts`
- Create: `games/balloon/src/view/flight.ts`, `games/balloon/src/view/flight.test.ts`

**Interfaces:**
- Consumes: `RescueDef`, `RescueState`, `trayTaken`, `puffTaken`, `Outcome`, `Intent`.
- Produces from `geometry.ts`: `LAYOUT`; `HOME: Point`; `balloonRadius(value)`; `PUFF_RADIUS`; `ledgeSpot(def): Point`; `harnessPoint(at): Point`; `bunchPoint(slot, count, at): Point`; `puffPoint(slot, at): Point`; `trayPoint(def, index): Point` (packed by width, so seven big balloons still fit beside four puffs); `puffTrayPoint(def, index): Point`; `hitTest(point, state): Intent | null`.
- Produces from `flight.ts`: `type Mood = 'calm' | 'strain' | 'wheee' | 'happy'`; `interface Pose { at: Point; parachute: boolean; mood: Mood }`; `flightPose(def, outcome, t): Pose` for `t` in 0..1.

- [ ] **Step 1: Write the failing tests**

```ts
// games/balloon/src/view/geometry.test.ts
import { describe, it, expect } from 'vitest';
import { DESIGN } from '@bundle/core';
import { createRescue } from '../logic/rescue.js';
import { RESCUES } from '../logic/levels.data.js';
import type { RescueDef } from '../logic/rescue-def.js';
import { balloonRadius, bunchPoint, HOME, hitTest, LAYOUT, ledgeSpot, puffTrayPoint, trayPoint } from './geometry.js';

const def: RescueDef = { id: 'g', line: '', weight: 8, tray: [5, 3, 6, 2] };

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
      rescue.wind?.puffs.forEach((_, index) => {
        expect(puffTrayPoint(rescue, index).x, rescue.id).toBeLessThan(LAYOUT.button.left);
      });
    }
  });

  it('puts the ledge on screen, above the ground', () => {
    for (const rescue of RESCUES) {
      const spot = ledgeSpot(rescue);
      expect(spot.x).toBeGreaterThan(0);
      expect(spot.x).toBeLessThan(DESIGN.width);
      expect(spot.y).toBeLessThan(HOME.y);
    }
  });

  it('finds the tray balloon under a finger, and skips one already taken', () => {
    const rescue = createRescue(def);
    expect(hitTest(trayPoint(def, 2), rescue.state)).toEqual({ kind: 'tray', index: 2 });
    rescue.clip(2);
    expect(hitTest(trayPoint(def, 2), rescue.state)).toBeNull();
  });

  it('finds a clipped balloon on the harness', () => {
    const rescue = createRescue(def);
    rescue.clip(0);
    rescue.clip(1);
    expect(hitTest(bunchPoint(1, 2, HOME), rescue.state)).toEqual({ kind: 'clipped', slot: 1 });
  });

  it('finds a tied balloon, which a tap pops', () => {
    const rescue = createRescue({ id: 't', line: '', weight: 7, tray: [2], tied: [6, 3, 1] });
    rescue.clip(0);
    expect(hitTest(bunchPoint(1, 4, HOME), rescue.state)).toEqual({ kind: 'tied', index: 1 });
    expect(hitTest(bunchPoint(3, 4, HOME), rescue.state)).toEqual({ kind: 'clipped', slot: 0 });
  });

  it('finds the button', () => {
    const { left, top, width, height } = LAYOUT.button;
    expect(hitTest({ x: left + width / 2, y: top + height / 2 }, createRescue(def).state)).toEqual({ kind: 'letGo' });
  });

  it('finds nothing in the open sky', () => {
    expect(hitTest({ x: 700, y: 120 }, createRescue(def).state)).toBeNull();
  });
});
```

```ts
// games/balloon/src/view/flight.test.ts
import { describe, it, expect } from 'vitest';
import { judge } from '../logic/outcome.js';
import type { RescueDef } from '../logic/rescue-def.js';
import { flightPose } from './flight.js';
import { HOME, LAYOUT, ledgeSpot } from './geometry.js';

const still: RescueDef = { id: 's', line: '', weight: 8, tray: [] };
const windy: RescueDef = { id: 'w', line: '', weight: 4, tray: [], wind: { ledge: 7, wind: 3, puffs: [] } };

describe('the flight', () => {
  it('starts at home every time', () => {
    for (const outcome of [judge(6, 8), judge(8, 8), judge(11, 8)]) {
      expect(flightPose(still, outcome, 0).at).toEqual(HOME);
    }
  });

  it('ends on the ledge when it was just right', () => {
    expect(flightPose(still, judge(8, 8), 1).at).toEqual(ledgeSpot(still));
    expect(flightPose(windy, judge(4, 4, { have: 7, need: 7 }), 1).at).toEqual(ledgeSpot(windy));
    expect(flightPose(still, judge(8, 8), 1).mood).toBe('happy');
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

  it('drifts as far as the wind and puffs reached, then parachutes back', () => {
    const outcome = judge(4, 4, { have: 5, need: 7 });
    expect(flightPose(windy, outcome, 0.66).at.x).toBeCloseTo(HOME.x + 5 * LAYOUT.stepWidth, 5);
    const landed = flightPose(windy, outcome, 1);
    expect(landed.at).toEqual(HOME);
    expect(landed.parachute).toBe(true);
  });

  it('holds still outside 0..1', () => {
    expect(flightPose(still, judge(8, 8), 1.5).at).toEqual(ledgeSpot(still));
    expect(flightPose(still, judge(8, 8), -1).at).toEqual(HOME);
  });
});
```

- [ ] **Step 2: Run to see them fail**

Run: `npx vitest run games/balloon/src/view`
Expected: FAIL — the modules do not exist.

- [ ] **Step 3: Implement geometry**

```ts
// games/balloon/src/view/geometry.ts
import { DESIGN, type Point } from '@bundle/core';
import type { Intent } from '../intent.js';
import type { RescueDef } from '../logic/rescue-def.js';
import { puffTaken, trayTaken, type RescueState } from '../logic/rescue.js';

/** Where everything sits, in design coordinates. */
export const LAYOUT = {
  /** The top bar: rescue number left, chapter centre, stars right. */
  hudY: 46,
  /** The story line, under the chapter. */
  lineY: 104,
  /** Where the kit's feet stand. */
  groundY: 560,
  homeX: 300,
  /** The top of the ledge the kit is trying to reach. */
  ledgeY: 262,
  /** One step of wind. Ten of them still reach the ledge on screen. */
  stepWidth: 72,
  /** The left cliff's edge, in the chapters where the ledge is straight up. */
  cliffEdgeX: 220,
  /** Centre line of the tray strip along the bottom. */
  trayY: 690,
  trayLeft: 50,
  trayRight: 890,
  /** In wind, each puff in the tray gets this much of the strip's right end. */
  puffSlot: 70,
  button: { left: 912, top: 626, width: 210, height: 116 },
  /** From the feet up to the ring the balloon strings tie to. */
  harnessHeight: 118,
} as const;

export const HOME: Point = { x: LAYOUT.homeX, y: LAYOUT.groundY };
export const PUFF_RADIUS = 26;

/** A 1 is small and a 10 is big; a 6 and a 7 are nearly the same, so read the number. */
export const balloonRadius = (value: number): number => 20 + (Math.min(10, Math.max(1, value)) - 1) * 2.8;

export const ledgeSpot = (def: RescueDef): Point =>
  def.wind
    ? { x: LAYOUT.homeX + def.wind.ledge * LAYOUT.stepWidth, y: LAYOUT.ledgeY }
    : { x: LAYOUT.cliffEdgeX - 80, y: LAYOUT.ledgeY };

export const harnessPoint = (at: Point): Point => ({ x: at.x, y: at.y - LAYOUT.harnessHeight });

/** Where the balloon on harness slot `slot` of `count` floats, for a kit standing at `at`. */
export function bunchPoint(slot: number, count: number, at: Point): Point {
  const spread = Math.min(64, 320 / Math.max(1, count));
  const offset = slot - (count - 1) / 2;
  return { x: at.x + offset * spread, y: at.y - LAYOUT.harnessHeight - 104 - (slot % 2) * 46 };
}

/** Puffs gather behind the kit, on the side away from the ledge. */
export const puffPoint = (slot: number, at: Point): Point => ({ x: at.x - 96, y: at.y - 34 - slot * 54 });

interface Region {
  left: number;
  right: number;
}

/** In wind the puffs take the right end of the strip, just as much as they need. */
const regions = (def: RescueDef): { balloons: Region; puffs: Region } => {
  if (!def.wind) {
    return { balloons: { left: LAYOUT.trayLeft, right: LAYOUT.trayRight }, puffs: { left: LAYOUT.trayRight, right: LAYOUT.trayRight } };
  }
  const puffLeft = LAYOUT.trayRight - LAYOUT.puffSlot * def.wind.puffs.length;
  return { balloons: { left: LAYOUT.trayLeft, right: puffLeft - 24 }, puffs: { left: puffLeft, right: LAYOUT.trayRight } };
};

/**
 * Tray balloons are packed by their own widths rather than spaced evenly, so a
 * row of big ones still fits and a pair of small ones does not drift apart. A
 * short tray is spread a little, never more than half again.
 */
export function trayPoint(def: RescueDef, index: number): Point {
  const region = regions(def).balloons;
  const widths = def.tray.map((value) => 2 * balloonRadius(value) + 10);
  const total = widths.reduce((sum, width) => sum + width, 0);
  const room = region.right - region.left;
  const scale = Math.min(1.5, room / Math.max(1, total));
  const before = widths.slice(0, index).reduce((sum, width) => sum + width, 0);
  const start = region.left + (room - total * scale) / 2;
  return { x: start + scale * (before + (widths[index] ?? 0) / 2), y: LAYOUT.trayY - 10 };
}

export const puffTrayPoint = (def: RescueDef, index: number): Point => ({
  x: regions(def).puffs.left + LAYOUT.puffSlot * (index + 0.5),
  y: LAYOUT.trayY,
});

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

  const count = state.tied.length + state.clipped.length;
  for (let slot = count - 1; slot >= 0; slot -= 1) {
    const tied = state.tied[slot];
    const clipped = state.clipped[slot - state.tied.length];
    const value = tied?.value ?? clipped?.value ?? 1;
    if (!near(point, bunchPoint(slot, count, HOME), balloonRadius(value) + 8)) continue;
    return tied ? { kind: 'tied', index: slot } : { kind: 'clipped', slot: slot - state.tied.length };
  }

  for (let slot = state.puffs.length - 1; slot >= 0; slot -= 1) {
    if (near(point, puffPoint(slot, HOME), PUFF_RADIUS + 8)) return { kind: 'puffSlot', slot };
  }

  const def = state.def;
  for (let index = 0; index < def.tray.length; index += 1) {
    if (trayTaken(state, index)) continue;
    if (near(point, trayPoint(def, index), balloonRadius(def.tray[index]!) + 10)) return { kind: 'tray', index };
  }

  const puffs = def.wind?.puffs ?? [];
  for (let index = 0; index < puffs.length; index += 1) {
    if (puffTaken(state, index)) continue;
    if (near(point, puffTrayPoint(def, index), PUFF_RADIUS + 12)) return { kind: 'puff', index };
  }
  return null;
}

/** For clamping a drift that went past the edge of the world. */
export const WORLD_RIGHT = DESIGN.width - 50;
```

- [ ] **Step 4: Implement the flight**

```ts
// games/balloon/src/view/flight.ts
import type { Point } from '@bundle/core';
import type { Outcome } from '../logic/outcome.js';
import type { RescueDef } from '../logic/rescue-def.js';
import { HOME, LAYOUT, WORLD_RIGHT, ledgeSpot } from './geometry.js';

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
 * Where the kit is, `t` of the way through its flight. A function of the
 * outcome and nothing else, so the flight is drawn from state rather than
 * simulated — a flight can never disagree with the verdict it shows.
 */
export function flightPose(def: RescueDef, outcome: Outcome, rawT: number): Pose {
  const t = clamp01(rawT);
  const hover = LAYOUT.ledgeY - 26;

  if (outcome.verdict === 'exact') {
    const spot = ledgeSpot(def);
    const mood = t >= 1 ? 'happy' : 'calm';
    if (!def.wind) {
      const rise = ease(during(t, 0, 0.7));
      const step = ease(during(t, 0.72, 1));
      return { at: { x: lerp(HOME.x, spot.x, step), y: lerp(lerp(HOME.y, hover, rise), spot.y, step) }, parachute: false, mood };
    }
    const rise = ease(during(t, 0, 0.4));
    const drift = ease(during(t, 0.42, 0.86));
    const settle = ease(during(t, 0.86, 1));
    return { at: { x: lerp(HOME.x, spot.x, drift), y: lerp(lerp(HOME.y, hover, rise), spot.y, settle) }, parachute: false, mood };
  }

  if (outcome.axis === 'up' && outcome.verdict === 'short') {
    // A strain and a hop: how nearly there it was shows in how high the hop is.
    const share = clamp01(outcome.have / outcome.need);
    const through = clamp01(t / 0.8);
    const hop = through >= 1 ? 0 : Math.sin(Math.PI * through) * (8 + 32 * share);
    return { at: { x: HOME.x, y: HOME.y - hop }, parachute: false, mood: 'strain' };
  }

  if (outcome.axis === 'up') {
    // Whoosh past the ledge and off the top, then a parachute home.
    if (t < 0.45) {
      const up = ease(during(t, 0, 0.35));
      return { at: { x: HOME.x + Math.sin(t * 14) * 6, y: lerp(HOME.y, -200, up) }, parachute: false, mood: 'wheee' };
    }
    const down = ease(during(t, 0.45, 1));
    return { at: { x: HOME.x, y: lerp(-150, HOME.y, down) }, parachute: true, mood: 'calm' };
  }

  // Across: up, over to wherever the wind and puffs reached, and back by parachute.
  const reached = Math.min(WORLD_RIGHT, Math.max(50, HOME.x + outcome.have * LAYOUT.stepWidth));
  if (t < 0.72) {
    const rise = ease(during(t, 0, 0.3));
    const drift = ease(during(t, 0.32, 0.62));
    return { at: { x: lerp(HOME.x, reached, drift), y: lerp(HOME.y, hover, rise) }, parachute: false, mood: 'strain' };
  }
  const back = ease(during(t, 0.72, 1));
  return { at: { x: lerp(reached, HOME.x, back), y: lerp(hover, HOME.y, back) }, parachute: true, mood: 'calm' };
}
```

- [ ] **Step 5: Run to see them pass**

Run: `npx vitest run games/balloon && npm run typecheck`
Expected: PASS. If the tray-spacing test fails for one rescue, the fix is in `LAYOUT` or `balloonRadius`, not the test: a child must be able to hit each balloon.

- [ ] **Step 6: Commit**

```bash
git add games/balloon/src/view/geometry.ts games/balloon/src/view/geometry.test.ts games/balloon/src/view/flight.ts games/balloon/src/view/flight.test.ts
git commit -m "feat(balloon): where everything sits, and how the kit flies"
```

---

### Task 9: The art

**Files:**
- Create: `games/balloon/src/view/art.ts`, `games/balloon/src/view/art.test.ts`

**Interfaces:**
- Consumes: `hand`, `label`, `Bounds`, `Point` from `@bundle/core`; `LAYOUT`, `balloonRadius`, `PUFF_RADIUS` (Task 8); `Mood` (Task 8).
- Produces: `balloonColour(value): string`; `drawSky(ctx, bounds)`; `drawGround(ctx, bounds)`; `drawCliff(ctx, bounds, side: 'left' | 'right', edgeX)`; `drawStepMarks(ctx, count)`; `drawWindSock(ctx, wind)`; `drawRope(ctx, from: Point)`; `drawString(ctx, from: Point, to: Point)`; `drawBalloon(ctx, at, value, options?: { limp?: boolean; glow?: number })`; `drawPuff(ctx, at, value)`; `drawFox(ctx, at, options: { weight: number; mood: Mood; bob: number })`; `drawParachute(ctx, at)`; `drawButton(ctx, enabled: boolean)`; `drawTrayShelf(ctx)`; `drawPopBurst(ctx, at, value, progress)`.

The look follows the concept art at the repo root: warm, rounded and pastel; soft clouds, grassy cliffs, a fox kit.

- [ ] **Step 1: Write the failing test**

```ts
// games/balloon/src/view/art.test.ts
import { describe, it, expect } from 'vitest';
import { depthOf, recordingContext } from '@bundle/core';
import {
  balloonColour,
  drawBalloon,
  drawButton,
  drawCliff,
  drawFox,
  drawGround,
  drawParachute,
  drawPopBurst,
  drawPuff,
  drawRope,
  drawSky,
  drawStepMarks,
  drawString,
  drawTrayShelf,
  drawWindSock,
} from './art.js';

const bounds = { left: -100, top: 0, right: 1252, bottom: 768 };

describe('the art', () => {
  it('draws every piece with its saves and restores balanced', () => {
    const { ctx } = recordingContext();
    drawSky(ctx, bounds);
    drawGround(ctx, bounds);
    drawCliff(ctx, bounds, 'left', 220);
    drawCliff(ctx, bounds, 'right', 800);
    drawStepMarks(ctx, 7);
    drawWindSock(ctx, 3);
    drawWindSock(ctx, -2);
    drawRope(ctx, { x: 300, y: 560 });
    drawString(ctx, { x: 300, y: 440 }, { x: 330, y: 300 });
    drawBalloon(ctx, { x: 300, y: 300 }, 7, { glow: 0.5 });
    drawBalloon(ctx, { x: 300, y: 300 }, 7, { limp: true });
    drawPuff(ctx, { x: 200, y: 500 }, 3);
    for (const mood of ['calm', 'strain', 'wheee', 'happy'] as const) drawFox(ctx, { x: 300, y: 560 }, { weight: 8, mood, bob: 0.3 });
    drawParachute(ctx, { x: 300, y: 560 });
    drawButton(ctx, true);
    drawButton(ctx, false);
    drawTrayShelf(ctx);
    drawPopBurst(ctx, { x: 300, y: 300 }, 5, 0.5);
    expect(depthOf(ctx)).toBe(0);
  });

  it('writes the number on a balloon, a puff and the kit\'s weight tag', () => {
    const { ctx, texts } = recordingContext();
    drawBalloon(ctx, { x: 0, y: 0 }, 7);
    drawPuff(ctx, { x: 0, y: 0 }, 3);
    drawFox(ctx, { x: 0, y: 0 }, { weight: 12, mood: 'calm', bob: 0 });
    expect(texts).toEqual(expect.arrayContaining(['7', '3', '12']));
  });

  it('still shows a popped balloon\'s number, so it can be put back', () => {
    const { ctx, texts } = recordingContext();
    drawBalloon(ctx, { x: 0, y: 0 }, 4, { limp: true });
    expect(texts).toContain('4');
  });

  it('says which way the wind blows, and how hard', () => {
    const helping = recordingContext();
    drawWindSock(helping.ctx, 3);
    expect(helping.texts).toContain('3 →');
    const against = recordingContext();
    drawWindSock(against.ctx, -2);
    expect(against.texts).toContain('← 2');
  });

  it('gives each value its own colour', () => {
    const colours = new Set(Array.from({ length: 10 }, (_, index) => balloonColour(index + 1)));
    expect(colours.size).toBe(10);
  });
});
```

- [ ] **Step 2: Run to see it fail**

Run: `npx vitest run games/balloon/src/view/art.test.ts`
Expected: FAIL — `./art.js` does not exist.

- [ ] **Step 3: Implement**

```ts
// games/balloon/src/view/art.ts
import { hand, label, type Bounds, type Point } from '@bundle/core';
import type { Mood } from './flight.js';
import { balloonRadius, LAYOUT, PUFF_RADIUS } from './geometry.js';

const INK = '#1e2a38';
const TAU = Math.PI * 2;

/** One colour per value, so a 6 is the same 6 wherever it appears. */
const BALLOON_COLOURS = [
  '#f7a8b8', '#ffcf6e', '#9fd8a8', '#8ecdf0', '#c9a8f0',
  '#f6b27a', '#7fd0c8', '#f08a8a', '#a8b8f7', '#f2d25c',
] as const;

export const balloonColour = (value: number): string =>
  BALLOON_COLOURS[(Math.max(1, Math.round(value)) - 1) % BALLOON_COLOURS.length] ?? BALLOON_COLOURS[0];

const CLOUDS = [
  { x: 170, y: 150, size: 1 },
  { x: 610, y: 84, size: 1.3 },
  { x: 990, y: 160, size: 0.9 },
  { x: 430, y: 214, size: 0.7 },
] as const;

function drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size, size);
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.beginPath();
  ctx.arc(-42, 10, 28, 0, TAU);
  ctx.arc(-6, -8, 38, 0, TAU);
  ctx.arc(36, 6, 30, 0, TAU);
  ctx.arc(0, 18, 30, 0, TAU);
  ctx.fill();
  ctx.restore();
}

export function drawSky(ctx: CanvasRenderingContext2D, bounds: Bounds): void {
  ctx.save();
  const sky = ctx.createLinearGradient(0, bounds.top, 0, LAYOUT.groundY);
  sky.addColorStop(0, '#86ccf4');
  sky.addColorStop(1, '#e3f5ff');
  ctx.fillStyle = sky;
  ctx.fillRect(bounds.left, bounds.top, bounds.right - bounds.left, bounds.bottom - bounds.top);
  for (const cloud of CLOUDS) drawCloud(ctx, cloud.x, cloud.y, cloud.size);
  ctx.restore();
}

export function drawGround(ctx: CanvasRenderingContext2D, bounds: Bounds): void {
  ctx.save();
  ctx.fillStyle = '#a3d982';
  ctx.fillRect(bounds.left, LAYOUT.groundY - 6, bounds.right - bounds.left, bounds.bottom - LAYOUT.groundY + 6);
  // Rolling hills along the horizon, the concept art's soft green.
  ctx.fillStyle = '#b8e39a';
  ctx.beginPath();
  ctx.moveTo(bounds.left, LAYOUT.groundY);
  for (let x = bounds.left; x <= bounds.right; x += 60) ctx.lineTo(x, LAYOUT.groundY - 18 - Math.sin(x / 90) * 12);
  ctx.lineTo(bounds.right, LAYOUT.groundY);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** A grassy cliff whose top is the ledge. `edgeX` is where its lip is. */
export function drawCliff(ctx: CanvasRenderingContext2D, bounds: Bounds, side: 'left' | 'right', edgeX: number): void {
  const from = side === 'left' ? bounds.left : edgeX;
  const to = side === 'left' ? edgeX : bounds.right;
  const top = LAYOUT.ledgeY;
  ctx.save();
  ctx.fillStyle = '#d9a66c';
  ctx.strokeStyle = 'rgba(120,72,30,0.35)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(from, LAYOUT.groundY + 10);
  ctx.lineTo(from, top + 10);
  ctx.lineTo(to, top + 10);
  ctx.quadraticCurveTo(to + (side === 'left' ? 14 : -14), (top + LAYOUT.groundY) / 2, to, LAYOUT.groundY + 10);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Strata, so it reads as rock.
  ctx.strokeStyle = 'rgba(120,72,30,0.25)';
  for (let y = top + 70; y < LAYOUT.groundY; y += 70) {
    ctx.beginPath();
    ctx.moveTo(from, y);
    ctx.lineTo(to, y + 8);
    ctx.stroke();
  }
  // The grass cap is the ledge itself.
  ctx.fillStyle = '#7cc45e';
  ctx.beginPath();
  ctx.roundRect?.(from - 10, top - 8, to - from + 20, 26, 13);
  ctx.fill();
  ctx.restore();
}

/** Numbered posts along the ground, one per step of wind, so distance can be read. */
export function drawStepMarks(ctx: CanvasRenderingContext2D, count: number): void {
  ctx.save();
  for (let step = 1; step <= count; step += 1) {
    const x = LAYOUT.homeX + step * LAYOUT.stepWidth;
    ctx.fillStyle = '#8a6a48';
    ctx.fillRect(x - 3, LAYOUT.groundY - 4, 6, 22);
    label(ctx, String(step), x, LAYOUT.groundY + 32, 20, 'center');
  }
  ctx.restore();
}

/** A pole with a sock pointing downwind, and the wind's own push written on it. */
export function drawWindSock(ctx: CanvasRenderingContext2D, wind: number): void {
  const x = 780;
  const y = 150;
  const direction = wind >= 0 ? 1 : -1;
  ctx.save();
  ctx.strokeStyle = '#6b5a48';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(x, y - 20);
  ctx.lineTo(x, y + 90);
  ctx.stroke();
  ctx.fillStyle = '#f08a6a';
  ctx.beginPath();
  ctx.moveTo(x, y - 20);
  ctx.lineTo(x + direction * 110, y - 6);
  ctx.lineTo(x + direction * 110, y + 10);
  ctx.lineTo(x, y + 24);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillRect(x + direction * 40 - (direction < 0 ? 22 : 0), y - 14, 22, 32);
  label(ctx, wind >= 0 ? `${wind} →` : `← ${-wind}`, x + direction * 60, y + 64, 36, 'center');
  ctx.restore();
}

/** The rope from the harness down to a peg: tied balloons cannot float off by themselves. */
export function drawRope(ctx: CanvasRenderingContext2D, feet: Point): void {
  const peg = { x: feet.x + 78, y: feet.y + 6 };
  ctx.save();
  ctx.strokeStyle = '#9b7b52';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(feet.x + 18, feet.y - 60);
  ctx.quadraticCurveTo(feet.x + 70, feet.y - 20, peg.x, peg.y - 16);
  ctx.stroke();
  ctx.fillStyle = '#7a5a38';
  ctx.fillRect(peg.x - 6, peg.y - 22, 12, 30);
  ctx.restore();
}

export function drawString(ctx: CanvasRenderingContext2D, from: Point, to: Point): void {
  ctx.save();
  ctx.strokeStyle = 'rgba(30,42,56,0.45)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.quadraticCurveTo((from.x + to.x) / 2 + 10, (from.y + to.y) / 2, to.x, to.y);
  ctx.stroke();
  ctx.restore();
}

export function drawBalloon(
  ctx: CanvasRenderingContext2D,
  at: Point,
  value: number,
  options: { limp?: boolean; glow?: number } = {},
): void {
  const radius = balloonRadius(value);
  ctx.save();
  ctx.translate(at.x, at.y);

  if (options.limp) {
    // Popped, but still on its hook and still wearing its number, so a tap can
    // put it back.
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = balloonColour(value);
    ctx.beginPath();
    ctx.ellipse(0, radius * 0.5, radius * 0.42, radius * 0.3, 0.3, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
    label(ctx, String(value), 0, radius * 0.5, 22, 'center');
    ctx.restore();
    return;
  }

  if (options.glow && options.glow > 0) {
    ctx.fillStyle = `rgba(255,236,140,${0.7 * options.glow})`;
    ctx.beginPath();
    ctx.arc(0, 0, radius + 14, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = balloonColour(value);
  ctx.strokeStyle = 'rgba(30,42,56,0.25)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(0, 0, radius * 0.9, radius, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath();
  ctx.ellipse(-radius * 0.35, -radius * 0.42, radius * 0.18, radius * 0.28, -0.5, 0, TAU);
  ctx.fill();
  ctx.fillStyle = balloonColour(value);
  ctx.beginPath();
  ctx.moveTo(-6, radius + 8);
  ctx.lineTo(6, radius + 8);
  ctx.lineTo(0, radius - 2);
  ctx.closePath();
  ctx.fill();
  label(ctx, String(value), 0, 2, Math.max(22, radius * 0.85), 'center');
  ctx.restore();
}

/** A little cloud of breath that pushes sideways. */
export function drawPuff(ctx: CanvasRenderingContext2D, at: Point, value: number): void {
  ctx.save();
  ctx.translate(at.x, at.y);
  ctx.fillStyle = '#eef8ff';
  ctx.strokeStyle = '#7fb8e0';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(-12, 4, PUFF_RADIUS * 0.7, 0, TAU);
  ctx.arc(8, -6, PUFF_RADIUS * 0.8, 0, TAU);
  ctx.arc(14, 10, PUFF_RADIUS * 0.6, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = 'rgba(127,184,224,0.9)';
  for (const dy of [-10, 4, 18]) {
    ctx.beginPath();
    ctx.moveTo(PUFF_RADIUS + 4, dy);
    ctx.lineTo(PUFF_RADIUS + 20, dy);
    ctx.stroke();
  }
  label(ctx, String(value), 2, 2, 26, 'center');
  ctx.restore();
}

/**
 * The fox kit, feet at `at`. Its weight is on a tag on its chest: the number
 * the whole rescue is about, so it is the biggest thing on it.
 */
export function drawFox(ctx: CanvasRenderingContext2D, at: Point, options: { weight: number; mood: Mood; bob: number }): void {
  const bounce = Math.sin(options.bob * TAU) * 2;
  ctx.save();
  ctx.translate(at.x, at.y + bounce);

  // Tail.
  ctx.fillStyle = '#f29a4a';
  ctx.beginPath();
  ctx.ellipse(-44, -30, 16, 34, -0.9, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#fff6ec';
  ctx.beginPath();
  ctx.ellipse(-62, -48, 8, 12, -0.9, 0, TAU);
  ctx.fill();

  // Body and belly.
  ctx.fillStyle = '#f29a4a';
  ctx.beginPath();
  ctx.ellipse(0, -36, 34, 38, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#fff6ec';
  ctx.beginPath();
  ctx.ellipse(0, -30, 22, 26, 0, 0, TAU);
  ctx.fill();

  // Harness straps up to the ring.
  ctx.strokeStyle = '#5a7fc2';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(-24, -52);
  ctx.lineTo(0, -LAYOUT.harnessHeight);
  ctx.lineTo(24, -52);
  ctx.stroke();
  ctx.fillStyle = '#5a7fc2';
  ctx.beginPath();
  ctx.arc(0, -LAYOUT.harnessHeight, 7, 0, TAU);
  ctx.fill();

  // Head, ears, face.
  ctx.fillStyle = '#f29a4a';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * 12, -98);
    ctx.lineTo(side * 32, -126);
    ctx.lineTo(side * 34, -90);
    ctx.closePath();
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(0, -82, 30, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#fff6ec';
  ctx.beginPath();
  ctx.ellipse(0, -72, 18, 13, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(0, -78, 4, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    if (options.mood === 'happy') {
      ctx.arc(side * 12, -88, 6, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
    } else if (options.mood === 'strain') {
      ctx.moveTo(side * 6, -90);
      ctx.lineTo(side * 18, -86);
      ctx.stroke();
    } else {
      ctx.arc(side * 12, -88, options.mood === 'wheee' ? 6 : 4.5, 0, TAU);
      ctx.fill();
    }
  }
  if (options.mood === 'wheee') {
    ctx.beginPath();
    ctx.ellipse(0, -66, 5, 7, 0, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(240,120,130,0.45)';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(side * 20, -74, 5, 0, TAU);
    ctx.fill();
  }

  // The weight tag.
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = 'rgba(30,42,56,0.4)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect?.(-24, -48, 48, 36, 10);
  ctx.fill();
  ctx.stroke();
  ctx.font = hand(700, 30);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = INK;
  ctx.fillText(String(options.weight), 0, -29);
  ctx.restore();
}

export function drawParachute(ctx: CanvasRenderingContext2D, feet: Point): void {
  const top = feet.y - 230;
  ctx.save();
  ctx.fillStyle = '#ffd36e';
  ctx.strokeStyle = 'rgba(30,42,56,0.3)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(feet.x, top + 40, 80, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = 'rgba(30,42,56,0.4)';
  ctx.lineWidth = 2;
  for (const dx of [-78, -30, 30, 78]) {
    ctx.beginPath();
    ctx.moveTo(feet.x + dx, top + 40);
    ctx.lineTo(feet.x, feet.y - 110);
    ctx.stroke();
  }
  ctx.restore();
}

/** The one big button. Dimmed until there is something on the harness to lift. */
export function drawButton(ctx: CanvasRenderingContext2D, enabled: boolean): void {
  const { left, top, width, height } = LAYOUT.button;
  ctx.save();
  ctx.globalAlpha = enabled ? 1 : 0.45;
  ctx.fillStyle = enabled ? '#f07b5f' : '#b9c2cc';
  ctx.beginPath();
  ctx.roundRect?.(left, top, width, height, 28);
  ctx.fill();
  ctx.font = hand(700, 40);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('Let go!', left + width / 2, top + height / 2 + 2);
  ctx.restore();
}

/** A soft shelf behind the tray, so waiting balloons read as a set to choose from. */
export function drawTrayShelf(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.beginPath();
  ctx.roundRect?.(LAYOUT.trayLeft - 20, LAYOUT.trayY - 74, LAYOUT.trayRight - LAYOUT.trayLeft + 40, 140, 30);
  ctx.fill();
  ctx.restore();
}

/** Scraps flying out where a balloon popped. */
export function drawPopBurst(ctx: CanvasRenderingContext2D, at: Point, value: number, progress: number): void {
  ctx.save();
  ctx.globalAlpha = Math.max(0, 1 - progress);
  ctx.fillStyle = balloonColour(value);
  for (let piece = 0; piece < 8; piece += 1) {
    const angle = (piece / 8) * TAU;
    const reach = 16 + progress * 46;
    ctx.beginPath();
    ctx.arc(at.x + Math.cos(angle) * reach, at.y + Math.sin(angle) * reach, 5, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}
```

- [ ] **Step 4: Run to see it pass**

Run: `npx vitest run games/balloon/src/view && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add games/balloon/src/view/art.ts games/balloon/src/view/art.test.ts
git commit -m "feat(balloon): a fox kit, numbered balloons, puffs, cliffs and wind"
```

---

### Task 10: The HUD and the scene

**Files:**
- Create: `games/balloon/src/view/hud.ts`, `games/balloon/src/view/hud.test.ts`
- Create: `games/balloon/src/view/scene.ts`, `games/balloon/src/view/scene.test.ts`

**Interfaces:**
- Consumes: `SceneModel`, `DriverEvent` (Task 7); everything in Tasks 8–9; `feedbackLine`, `gaugeText` (Task 2); `answerLines`, `liftedSlots` (Task 3); core's `drawArrivingBanner`, `drawSummaryCard`, `fitToScreen`, `visibleBounds`, `label`, `hand`.
- Produces from `hud.ts`: `drawTopBar(ctx, { title, number, count, line, totalStars })`; `drawGauge(ctx, outcome)`; `drawCount(ctx, text, at)`; `drawSolved(ctx, lines, progress)`; `drawStars(ctx, earned, progress)`; `drawFinished(ctx, totalStars, maxStars)`.
- Produces from `scene.ts`: `interface Scene { update(dt, model): void; observe(events): void; render(ctx, screen): void; toDesign(point, screen): Point }`; `createScene(): Scene`.

The scene must never show a running total while building: the count appears only once "Let go!" is pressed.

- [ ] **Step 1: Write the failing tests**

```ts
// games/balloon/src/view/hud.test.ts
import { describe, it, expect } from 'vitest';
import { depthOf, recordingContext } from '@bundle/core';
import { judge } from '../logic/outcome.js';
import { drawCount, drawFinished, drawGauge, drawSolved, drawStars, drawTopBar } from './hud.js';

describe('the hud', () => {
  it('names the chapter, the rescue\'s place in it, the story and the stars', () => {
    const { ctx, texts } = recordingContext();
    drawTopBar(ctx, { title: 'Pop!', number: 2, count: 5, line: 'Pop one to float just right', totalStars: 14 });
    expect(texts).toEqual(expect.arrayContaining(['Pop!', '2 of 5', 'Pop one to float just right', '★ 14']));
    expect(depthOf(ctx)).toBe(0);
  });

  it('shows the gauge and the gap in words', () => {
    const { ctx, texts } = recordingContext();
    drawGauge(ctx, judge(6, 8));
    expect(texts).toEqual(expect.arrayContaining(['6 / 8', '2 more!']));
    expect(depthOf(ctx)).toBe(0);
  });

  it('draws the count, the finished sum, the stars and the last card without leaking state', () => {
    const { ctx, texts } = recordingContext();
    drawCount(ctx, '8!', { x: 300, y: 200 });
    drawSolved(ctx, ['5 + 3 = 8'], 0.5);
    drawStars(ctx, 2, 1);
    drawFinished(ctx, 90, 117);
    expect(texts).toEqual(expect.arrayContaining(['8!', '5 + 3 = 8', 'Tap for the next rescue']));
    expect(depthOf(ctx)).toBe(0);
  });
});
```

```ts
// games/balloon/src/view/scene.test.ts
import { describe, it, expect } from 'vitest';
import { DESIGN, depthOf, recordingContext } from '@bundle/core';
import { createDriver, type Driver } from '../driver.js';
import { createScene } from './scene.js';

const FRAME = 1 / 60;
const SCREEN = { width: 1152, height: 768 };

const render = (driver: Driver, frames = 1) => {
  const scene = createScene();
  for (let i = 0; i < frames; i += 1) {
    scene.observe(driver.step(FRAME));
    scene.update(FRAME, driver.model());
  }
  const recording = recordingContext();
  scene.render(recording.ctx, SCREEN);
  return recording;
};

describe('the scene', () => {
  it('draws the weight, every tray balloon and the story line', () => {
    const driver = createDriver({ book: {}, startLevel: 'whoosh-1' });
    const { ctx, texts } = render(driver);
    expect(depthOf(ctx)).toBe(0);
    expect(texts).toContain('7');
    for (const value of [6, 4, 3, 1]) expect(texts).toContain(String(value));
    expect(texts).toContain('Careful, not too high!');
  });

  it('never shows a running total while building', () => {
    const driver = createDriver({ book: {}, startLevel: 'whoosh-1' });
    driver.act({ kind: 'tray', index: 1 }); // 4
    driver.act({ kind: 'tray', index: 2 }); // 3
    const { texts } = render(driver);
    expect(texts.some((text) => text.includes('/'))).toBe(false);
    expect(texts.filter((text) => text === '7')).toHaveLength(1); // the weight tag, and nothing else
  });

  it('counts on after "Let go!"', () => {
    const driver = createDriver({ book: {}, startLevel: 'whoosh-1' });
    driver.act({ kind: 'tray', index: 1 });
    driver.act({ kind: 'tray', index: 2 });
    driver.act({ kind: 'letGo' });
    const { texts } = render(driver, 2);
    expect(texts).toContain('4…');
    const later = render(driver, 30);
    expect(later.texts).toContain('7!');
  });

  it('shows the gauge after a wrong try', () => {
    const driver = createDriver({ book: {}, startLevel: 'whoosh-1' });
    driver.act({ kind: 'tray', index: 0 });
    driver.act({ kind: 'tray', index: 1 });
    driver.act({ kind: 'letGo' });
    while (driver.phase === 'flying') driver.step(FRAME);
    const { texts } = render(driver);
    expect(texts).toEqual(expect.arrayContaining(['10 / 7', '3 too many!']));
  });

  it('writes the finished sum and the stars once rescued', () => {
    const driver = createDriver({ book: {}, startLevel: 'whoosh-1' });
    driver.act({ kind: 'tray', index: 1 });
    driver.act({ kind: 'tray', index: 2 });
    driver.act({ kind: 'letGo' });
    const scene = createScene();
    for (let i = 0; i < 60 * 8; i += 1) {
      scene.observe(driver.step(FRAME));
      scene.update(FRAME, driver.model());
    }
    const recording = recordingContext();
    scene.render(recording.ctx, SCREEN);
    expect(recording.texts).toContain('4 + 3 = 7');
    expect(recording.texts).toContain('Tap for the next rescue');
  });

  it('draws the wind, the steps and the puffs in Windy Ridge', () => {
    const driver = createDriver({ book: {}, startLevel: 'windy-ridge-1' });
    const { texts } = render(driver);
    expect(texts).toContain('3 →');
    for (const value of [5, 4, 2]) expect(texts).toContain(String(value));
  });

  it('paints past the design rect, so an odd-shaped screen has no bars', () => {
    const driver = createDriver({ book: {} });
    const scene = createScene();
    scene.update(FRAME, driver.model());
    const { ctx, calls } = recordingContext();
    scene.render(ctx, { width: 2600, height: 1200 });
    expect(calls).toContain('fillRect');
    expect(depthOf(ctx)).toBe(0);
  });

  it('round-trips a screen point into the design space', () => {
    const point = createScene().toDesign({ x: 1152, y: 768 }, { width: 2304, height: 1536 });
    expect(point.x).toBeCloseTo(DESIGN.width / 2, 5);
    expect(point.y).toBeCloseTo(DESIGN.height / 2, 5);
  });

  it('draws nothing at all before it has been given a model', () => {
    const { ctx, calls } = recordingContext();
    createScene().render(ctx, SCREEN);
    expect(calls).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run to see them fail**

Run: `npx vitest run games/balloon/src/view`
Expected: FAIL — `./hud.js` and `./scene.js` do not exist.

- [ ] **Step 3: Implement the HUD**

```ts
// games/balloon/src/view/hud.ts
import { DESIGN, drawSummaryCard, hand, label, type Point } from '@bundle/core';
import { feedbackLine, gaugeText, type Outcome } from '../logic/outcome.js';
import { HOME, LAYOUT } from './geometry.js';

export function drawTopBar(
  ctx: CanvasRenderingContext2D,
  model: { title: string; number: number; count: number; line: string; totalStars: number },
): void {
  ctx.save();
  label(ctx, `${model.number} of ${model.count}`, 40, LAYOUT.hudY, 26, 'left');
  label(ctx, model.title, DESIGN.width / 2, LAYOUT.hudY, 34, 'center');
  label(ctx, `★ ${model.totalStars}`, DESIGN.width - 40, LAYOUT.hudY, 30, 'right');
  label(ctx, model.line, DESIGN.width / 2, LAYOUT.lineY, 32, 'center');
  ctx.restore();
}

/**
 * After a wrong try: what you had over what you needed, and the gap in words.
 * Beside the kit, where the child is already looking.
 */
export function drawGauge(ctx: CanvasRenderingContext2D, outcome: Outcome): void {
  const x = HOME.x + 340;
  const y = HOME.y - 250;
  ctx.save();
  ctx.fillStyle = outcome.verdict === 'short' ? 'rgba(90,150,220,0.95)' : 'rgba(240,123,95,0.95)';
  ctx.beginPath();
  ctx.roundRect?.(x - 150, y - 70, 300, 140, 26);
  ctx.fill();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = hand(700, 30);
  ctx.fillText(gaugeText(outcome), x, y - 28);
  ctx.fillStyle = '#ffffff';
  ctx.font = hand(700, 46);
  ctx.fillText(feedbackLine(outcome), x, y + 22);
  ctx.restore();
}

/** The running total as the balloons light, counted on: "5…", then "8!". */
export function drawCount(ctx: CanvasRenderingContext2D, text: string, at: Point): void {
  ctx.save();
  label(ctx, text, at.x, at.y, 64, 'center');
  ctx.restore();
}

/** The sum the bunch made, above the ledge. The teaching beat. */
export function drawSolved(ctx: CanvasRenderingContext2D, lines: readonly string[], progress: number): void {
  ctx.save();
  ctx.globalAlpha = Math.min(1, progress * 4);
  lines.forEach((line, index) => label(ctx, line, DESIGN.width / 2, 200 + index * 64, 56, 'center'));
  ctx.restore();
}

function star(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, filled: boolean): void {
  ctx.beginPath();
  for (let point = 0; point < 10; point += 1) {
    const angle = -Math.PI / 2 + (point * Math.PI) / 5;
    const reach = point % 2 === 0 ? radius : radius * 0.45;
    ctx.lineTo(x + Math.cos(angle) * reach, y + Math.sin(angle) * reach);
  }
  ctx.closePath();
  ctx.fillStyle = filled ? '#ffcc3a' : 'rgba(255,255,255,0.7)';
  ctx.strokeStyle = 'rgba(30,42,56,0.35)';
  ctx.lineWidth = 3;
  ctx.fill();
  ctx.stroke();
}

/** The stars this rescue earned, arriving one at a time as `progress` runs 0..3. */
export function drawStars(ctx: CanvasRenderingContext2D, earned: number, progress: number): void {
  ctx.save();
  for (let index = 0; index < 3; index += 1) {
    const shown = index < earned && progress > index;
    const pop = shown ? Math.min(1, (progress - index) * 2) : 1;
    star(ctx, DESIGN.width / 2 + (index - 1) * 110, 400, 44 * (0.6 + 0.4 * pop), shown);
  }
  label(ctx, 'Tap for the next rescue', DESIGN.width / 2, 490, 32, 'center');
  ctx.restore();
}

/** Every kit is home. How many stars, never a failure screen. */
export function drawFinished(ctx: CanvasRenderingContext2D, totalStars: number, maxStars: number): void {
  drawSummaryCard(ctx, {
    score: totalStars,
    bestStreak: 0,
    seconds: 0,
    best: totalStars,
    beatenBest: false,
    headline: 'Everyone is home!',
    lines: [`Stars   ${totalStars} of ${maxStars}`, 'Every kit rescued'],
  });
}
```

- [ ] **Step 4: Implement the scene**

```ts
// games/balloon/src/view/scene.ts
import { drawArrivingBanner, fitToScreen, visibleBounds, type Point, type Size } from '@bundle/core';
import type { DriverEvent, SceneModel } from '../driver.js';
import { answerLines, canLetGo, liftedSlots, puffTaken, trayTaken, type RescueState } from '../logic/rescue.js';
import {
  drawBalloon,
  drawButton,
  drawCliff,
  drawFox,
  drawGround,
  drawParachute,
  drawPopBurst,
  drawPuff,
  drawRope,
  drawSky,
  drawStepMarks,
  drawString,
  drawTrayShelf,
  drawWindSock,
} from './art.js';
import { flightPose, type Pose } from './flight.js';
import { bunchPoint, harnessPoint, HOME, LAYOUT, ledgeSpot, puffPoint, puffTrayPoint, trayPoint } from './geometry.js';
import { drawCount, drawFinished, drawGauge, drawSolved, drawStars, drawTopBar } from './hud.js';
import { TIMING } from './timing.js';

export interface Scene {
  update(dt: number, model: SceneModel): void;
  /** What just happened, so the scene can react. State stays the driver's. */
  observe(events: readonly DriverEvent[]): void;
  render(ctx: CanvasRenderingContext2D, screen: Size): void;
  toDesign(point: Point, screen: Size): Point;
}

interface Burst {
  at: Point;
  value: number;
  life: number;
}

/** Where the kit is and how it looks, from the model alone. */
function poseOf(model: SceneModel): Pose {
  const def = model.rescue.def;
  if (model.phase === 'rescued' || model.phase === 'finished') {
    return { at: ledgeSpot(def), parachute: false, mood: 'happy' };
  }
  const flight = model.flight;
  if (model.phase === 'flying' && flight && flight.t >= flight.count) {
    return flightPose(def, flight.outcome, (flight.t - flight.count) / flight.fly);
  }
  return { at: HOME, parachute: false, mood: model.feedback?.verdict === 'short' ? 'strain' : 'calm' };
}

/** During the count: which lifting balloon is lit, and the total so far. */
function countNow(model: SceneModel): { slot: number; text: string } | null {
  const flight = model.flight;
  if (model.phase !== 'flying' || !flight || flight.t >= flight.count || flight.lifted.length === 0) return null;
  const beat = flight.count / flight.lifted.length;
  const index = Math.min(flight.lifted.length - 1, Math.floor(flight.t / beat));
  const sum = flight.lifted.slice(0, index + 1).reduce((total, value) => total + value, 0);
  const last = index === flight.lifted.length - 1;
  return { slot: liftedSlots(model.rescue)[index] ?? -1, text: last ? `${sum}!` : `${sum}…` };
}

function drawBunch(ctx: CanvasRenderingContext2D, state: RescueState, at: Point, lit: number): void {
  const count = state.tied.length + state.clipped.length;
  const ring = harnessPoint(at);
  const values = [...state.tied.map((balloon) => balloon.value), ...state.clipped.map((taken) => taken.value)];
  values.forEach((value, slot) => {
    const point = bunchPoint(slot, count, at);
    const limp = state.tied[slot]?.popped ?? false;
    drawString(ctx, ring, limp ? { x: point.x, y: point.y + 40 } : point);
    drawBalloon(ctx, point, value, { limp, glow: slot === lit ? 1 : 0 });
  });
}

export function createScene(): Scene {
  let model: SceneModel | null = null;
  let banner: { title: string; life: number } | null = null;
  let rescuedFor = 0;
  let bob = 0;
  const bursts: Burst[] = [];

  return {
    observe(events) {
      for (const event of events) {
        if (event.type === 'chapter') banner = { title: event.chapter.title, life: 0 };
        if (event.type === 'popped' && model) {
          const count = model.rescue.tied.length + model.rescue.clipped.length;
          bursts.push({ at: bunchPoint(event.index, count, HOME), value: event.value, life: 0 });
        }
        if (event.type === 'rescued') rescuedFor = 0;
      }
    },

    update(dt, next) {
      model = next;
      bob += dt * 0.8;
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
      const pose = poseOf(current);
      const building = current.phase === 'building';

      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.translate(transform.offsetX, transform.offsetY);
      ctx.scale(transform.scale, transform.scale);

      drawSky(ctx, bounds);
      if (def.wind) {
        drawCliff(ctx, bounds, 'right', ledgeSpot(def).x - 50);
        drawWindSock(ctx, def.wind.wind);
      } else {
        drawCliff(ctx, bounds, 'left', LAYOUT.cliffEdgeX);
      }
      drawGround(ctx, bounds);
      if (def.wind) drawStepMarks(ctx, def.wind.ledge);

      if (building && state.tied.length > 0) drawRope(ctx, HOME);
      state.puffs.forEach((taken, slot) => drawPuff(ctx, puffPoint(slot, pose.at), taken.value));
      if (pose.parachute) {
        drawParachute(ctx, pose.at);
      } else {
        drawBunch(ctx, state, pose.at, countNow(current)?.slot ?? -1);
      }
      drawFox(ctx, pose.at, { weight: def.weight, mood: pose.mood, bob });
      for (const burst of bursts) drawPopBurst(ctx, burst.at, burst.value, burst.life / TIMING.popSeconds);

      drawTrayShelf(ctx);
      def.tray.forEach((value, index) => {
        if (!trayTaken(state, index)) drawBalloon(ctx, trayPoint(def, index), value);
      });
      def.wind?.puffs.forEach((value, index) => {
        if (!puffTaken(state, index)) drawPuff(ctx, puffTrayPoint(def, index), value);
      });
      drawButton(ctx, building && canLetGo(state));

      drawTopBar(ctx, {
        title: current.chapter.title,
        number: current.number,
        count: current.chapter.rescues.length,
        line: def.line,
        totalStars: current.totalStars,
      });

      const count = countNow(current);
      if (count) drawCount(ctx, count.text, { x: HOME.x + 230, y: HOME.y - 320 });
      if (building && current.feedback) drawGauge(ctx, current.feedback);
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
  };
}
```

- [ ] **Step 5: Run to see them pass**

Run: `npx vitest run games/balloon && npm run typecheck`
Expected: PASS. The "never a running total" test counts the text `7` exactly once — the weight tag. If it fails, something is drawing a sum while building: remove it, do not loosen the test.

- [ ] **Step 6: Commit**

```bash
git add games/balloon/src/view/hud.ts games/balloon/src/view/hud.test.ts games/balloon/src/view/scene.ts games/balloon/src/view/scene.test.ts
git commit -m "feat(balloon): the scene — the count, the gauge, the sum and the stars"
```

---

### Task 11: Input

**Files:**
- Create: `games/balloon/src/view/input.ts`, `games/balloon/src/view/input.test.ts`

**Interfaces:**
- Consumes: `Scene` (Task 10); `hitTest`, `LAYOUT` (Task 8); `Intent` (Task 7); `Phase` (Task 7); `RescueState` (Task 3).
- Produces: `createInput(canvas, scene, emit: (intent: Intent) => void, current: () => { phase: Phase; rescue: RescueState }): { dispose(): void }`.

Tapping is the main path. A tray balloon also clips when dragged up out of the tray; one dragged sideways and dropped back in the tray stays put, so a child can change their mind mid-drag.

- [ ] **Step 1: Write the failing test**

```ts
// games/balloon/src/view/input.test.ts
// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import type { Intent } from '../intent.js';
import { createRescue } from '../logic/rescue.js';
import type { RescueDef } from '../logic/rescue-def.js';
import type { Phase } from '../driver.js';
import { LAYOUT, trayPoint } from './geometry.js';
import { createInput } from './input.js';
import { createScene } from './scene.js';

const def: RescueDef = { id: 'i', line: '', weight: 8, tray: [5, 3, 6, 2] };

/** A canvas laid out at `width` by `height` CSS pixels at the page's origin. */
const canvasOf = (width: number, height: number): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  Object.defineProperty(canvas, 'clientWidth', { value: width });
  Object.defineProperty(canvas, 'clientHeight', { value: height });
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width, height, right: width, bottom: height, x: 0, y: 0, toJSON: () => ({}) });
  document.body.appendChild(canvas);
  return canvas;
};

const pointer = (canvas: HTMLCanvasElement, type: string, x: number, y: number) => {
  const event = new MouseEvent(type, { clientX: x, clientY: y, bubbles: true }) as MouseEvent & { pointerId: number };
  Object.defineProperty(event, 'pointerId', { value: 1 });
  canvas.dispatchEvent(event);
};

const setup = (width = 1152, height = 768, phase: Phase = 'building') => {
  const canvas = canvasOf(width, height);
  const intents: Intent[] = [];
  const rescue = createRescue(def);
  const input = createInput(canvas, createScene(), (intent) => intents.push(intent), () => ({ phase, rescue: rescue.state }));
  return { canvas, intents, input };
};

afterEach(() => document.body.replaceChildren());

describe('input', () => {
  it('turns a tap on a tray balloon into a clip', () => {
    const { canvas, intents, input } = setup();
    const at = trayPoint(def, 2);
    pointer(canvas, 'pointerdown', at.x, at.y);
    pointer(canvas, 'pointerup', at.x, at.y);
    expect(intents).toEqual([{ kind: 'tray', index: 2 }]);
    input.dispose();
  });

  it('clips a balloon dragged up out of the tray', () => {
    const { canvas, intents, input } = setup();
    const at = trayPoint(def, 1);
    pointer(canvas, 'pointerdown', at.x, at.y);
    pointer(canvas, 'pointerup', at.x + 40, at.y - 260);
    expect(intents).toEqual([{ kind: 'tray', index: 1 }]);
    input.dispose();
  });

  it('leaves a balloon dragged sideways and dropped back in the tray', () => {
    const { canvas, intents, input } = setup();
    const at = trayPoint(def, 1);
    pointer(canvas, 'pointerdown', at.x, at.y);
    pointer(canvas, 'pointerup', at.x + 150, at.y);
    expect(intents).toEqual([]);
    input.dispose();
  });

  it('presses the button', () => {
    const { canvas, intents, input } = setup();
    const x = LAYOUT.button.left + 20;
    const y = LAYOUT.button.top + 20;
    pointer(canvas, 'pointerdown', x, y);
    pointer(canvas, 'pointerup', x, y);
    expect(intents).toEqual([{ kind: 'letGo' }]);
    input.dispose();
  });

  it('hits the balloon under the finger on a screen that is not 3:2', () => {
    // 2000x768: the design is centred with 424px of sky either side.
    const { canvas, intents, input } = setup(2000, 768);
    const at = trayPoint(def, 0);
    pointer(canvas, 'pointerdown', at.x + 424, at.y);
    pointer(canvas, 'pointerup', at.x + 424, at.y);
    expect(intents).toEqual([{ kind: 'tray', index: 0 }]);
    input.dispose();
  });

  it('turns any tap into "next" once a rescue is done', () => {
    const { canvas, intents, input } = setup(1152, 768, 'rescued');
    pointer(canvas, 'pointerdown', 600, 300);
    pointer(canvas, 'pointerup', 600, 300);
    expect(intents).toEqual([{ kind: 'next' }]);
    input.dispose();
  });

  it('does nothing while the kit is flying', () => {
    const { canvas, intents, input } = setup(1152, 768, 'flying');
    const at = trayPoint(def, 0);
    pointer(canvas, 'pointerdown', at.x, at.y);
    pointer(canvas, 'pointerup', at.x, at.y);
    expect(intents).toEqual([]);
    input.dispose();
  });

  it('lets go with the space bar, and stops listening when disposed', () => {
    const { intents, input } = setup();
    globalThis.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    expect(intents).toEqual([{ kind: 'letGo' }]);
    input.dispose();
    globalThis.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    expect(intents).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run to see it fail**

Run: `npx vitest run games/balloon/src/view/input.test.ts`
Expected: FAIL — `./input.js` does not exist.

- [ ] **Step 3: Implement**

```ts
// games/balloon/src/view/input.ts
import { DESIGN, type Point, type Size } from '@bundle/core';
import type { Phase } from '../driver.js';
import type { Intent } from '../intent.js';
import type { RescueState } from '../logic/rescue.js';
import { hitTest, LAYOUT } from './geometry.js';
import type { Scene } from './scene.js';

export interface InputHandle {
  dispose(): void;
}

/** Further than this and a press has become a drag. */
const DRAG_PIXELS = 16;

/**
 * Tap is the main gesture, because six-year-olds drag imprecisely. A tray
 * balloon also clips when dragged up out of the tray; dropped back in the tray,
 * it stays where it was. Everything else acts when the finger lifts on the
 * thing it went down on, so a slipped finger does nothing.
 */
export function createInput(
  canvas: HTMLCanvasElement,
  scene: Scene,
  emit: (intent: Intent) => void,
  current: () => { phase: Phase; rescue: RescueState },
): InputHandle {
  let pressed: { intent: Intent | null; at: Point } | null = null;

  const screenSize = (): Size => ({
    width: canvas.clientWidth || DESIGN.width,
    height: canvas.clientHeight || DESIGN.height,
  });

  const designPoint = (event: PointerEvent): Point => {
    const bounds = canvas.getBoundingClientRect();
    return scene.toDesign({ x: event.clientX - bounds.left, y: event.clientY - bounds.top }, screenSize());
  };

  const same = (a: Intent | null, b: Intent | null): boolean => JSON.stringify(a) === JSON.stringify(b);

  const onPointerDown = (event: PointerEvent): void => {
    canvas.setPointerCapture?.(event.pointerId);
    const { phase, rescue } = current();
    const at = designPoint(event);
    pressed = { intent: phase === 'building' ? hitTest(at, rescue) : null, at };
  };

  const onPointerUp = (event: PointerEvent): void => {
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
    const moved = Math.hypot(at.x - down.at.x, at.y - down.at.y);
    const fromTray = down.intent.kind === 'tray' || down.intent.kind === 'puff';
    if (fromTray) {
      if (moved < DRAG_PIXELS || at.y < LAYOUT.trayY - 90) emit(down.intent);
      return;
    }
    if (same(hitTest(at, rescue), down.intent)) emit(down.intent);
  };

  const onPointerCancel = (): void => {
    pressed = null;
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== ' ' && event.key !== 'Enter') return;
    const { phase } = current();
    if (phase === 'building') emit({ kind: 'letGo' });
    else if (phase === 'rescued' || phase === 'finished') emit({ kind: 'next' });
  };

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerCancel);
  globalThis.addEventListener?.('keydown', onKeyDown);

  return {
    dispose() {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerCancel);
      globalThis.removeEventListener?.('keydown', onKeyDown);
    },
  };
}
```

- [ ] **Step 4: Run to see it pass**

Run: `npx vitest run games/balloon && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add games/balloon/src/view/input.ts games/balloon/src/view/input.test.ts
git commit -m "feat(balloon): tap to clip, drag if you like, and a big button"
```

---

### Task 12: Sound, the real module, and a game played end to end

**Files:**
- Create: `games/balloon/src/audio/balloon-sounds.ts`, `games/balloon/src/audio/balloon-sounds.test.ts`
- Modify: `games/balloon/src/index.ts` (replace the placeholder body entirely)
- Create: `games/balloon/src/integration.test.ts`

**Interfaces:**
- Consumes: everything above; `createTicker`, `DESIGN`, `tone`, `noiseBurst`, `AudioBus`, `SoundPack`, `GameHost`, `GameModule`, `GameSession` from `@bundle/core`.
- Produces: `SOUND_EVENTS`, `createBalloonSoundPack(bus): SoundPack`; `balloonGame: BalloonModule`, whose session carries `__test: BalloonTestHooks`.

- [ ] **Step 1: Write the failing tests**

```ts
// games/balloon/src/audio/balloon-sounds.test.ts
import { describe, it, expect } from 'vitest';
import { createAudioBus } from '@bundle/core';
import { fakeContext } from '../../../../packages/core/src/audio/fake-context.js';
import { createBalloonSoundPack, SOUND_EVENTS } from './balloon-sounds.js';

const packOnFakes = async () => {
  const bus = createAudioBus(() => fakeContext() as unknown as AudioContext);
  await bus.unlock();
  return createBalloonSoundPack(bus);
};

describe('the balloon sound pack', () => {
  it('has a voice for every sound the game asks for', async () => {
    const pack = await packOnFakes();
    for (const event of SOUND_EVENTS) expect(() => pack.play(event, { step: 2 })).not.toThrow();
  });

  it('names the moments the design cares about', () => {
    for (const event of ['clip', 'pop', 'count', 'float', 'strain', 'whoosh', 'cheer', 'chapter']) {
      expect(SOUND_EVENTS).toContain(event);
    }
  });

  it('shrugs off an event it has never heard of', async () => {
    const pack = await packOnFakes();
    expect(() => pack.play('nonsense')).not.toThrow();
  });

  it('stays silent rather than throwing before the context is unlocked', () => {
    expect(() => createBalloonSoundPack(createAudioBus(() => null)).play('pop')).not.toThrow();
  });
});
```

```ts
// games/balloon/src/integration.test.ts
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import { installCanvasStub } from '@bundle/core';
import { balloonGame } from './index.js';
import { createTestHost, type TestHost } from './test-host.js';
import { RESCUES } from './logic/levels.data.js';
import * as sounds from './audio/balloon-sounds.js';

let restoreCanvas: () => void;
beforeAll(() => {
  restoreCanvas = installCanvasStub();
});
afterAll(() => restoreCanvas());
afterEach(() => vi.restoreAllMocks());

const mountGame = async (startLevel?: string, host: TestHost = createTestHost()) => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const session = await balloonGame.mount(container, host, startLevel ? { startLevel } : undefined);
  return { container, host, session };
};

describe('a game played through the module', () => {
  it('opens at the first rescue and announces the chapter', async () => {
    const played: string[] = [];
    vi.spyOn(sounds, 'createBalloonSoundPack').mockReturnValue({
      preload: async () => {},
      play: (event: string) => void played.push(event),
    });
    const { session } = await mountGame();
    session.__test.step(2);
    expect(session.__test.rescueId()).toBe('first-flight-1');
    expect(played).toContain('chapter');
    session.unmount();
  });

  it('whooshes on too much, says how many too many, then rescues for two stars', async () => {
    const { session, host } = await mountGame();
    session.__test.act({ kind: 'tray', index: 1 }); // 5 for a weight of 3
    session.__test.act({ kind: 'letGo' });
    session.__test.settle();
    expect(session.__test.phase()).toBe('building');
    expect(session.__test.feedback()).toBe('2 too many!');

    session.__test.act({ kind: 'clipped', slot: 0 });
    session.__test.act({ kind: 'tray', index: 0 });
    session.__test.act({ kind: 'letGo' });
    session.__test.settle();
    expect(session.__test.phase()).toBe('rescued');
    expect(host.storage.get<Record<string, number>>('stars', {})['first-flight-1']).toBe(2);
    session.unmount();
  });

  it('ignores taps while the kit is in the air', async () => {
    const { session } = await mountGame();
    session.__test.act({ kind: 'tray', index: 1 });
    session.__test.act({ kind: 'letGo' });
    session.__test.step(1);
    session.__test.act({ kind: 'tray', index: 0 });
    session.__test.act({ kind: 'letGo' });
    expect(session.__test.tries()).toBe(1);
    session.unmount();
  });

  it('opens straight into a chapter for ?game=balloon&level=pop-1', async () => {
    const { session } = await mountGame('pop-1');
    expect(session.__test.rescueId()).toBe('pop-1');
    session.unmount();
  });

  it('picks up where the player left off', async () => {
    const host = createTestHost();
    host.storage.set('stars', { 'first-flight-1': 3, 'first-flight-2': 2 });
    const { session } = await mountGame(undefined, host);
    expect(session.__test.rescueId()).toBe('first-flight-3');
    session.unmount();
  });

  it('opens even when the saved stars are damaged', async () => {
    const host = createTestHost();
    host.storage.set('stars', 'not a book');
    const { session } = await mountGame(undefined, host);
    expect(session.__test.rescueId()).toBe('first-flight-1');
    session.unmount();
  });

  it('can be played from the first rescue to the last, three stars each', async () => {
    const { session, host } = await mountGame();
    for (let index = 0; index < RESCUES.length; index += 1) {
      expect(session.__test.rescueId()).toBe(RESCUES[index]!.id);
      session.__test.answer();
      expect(session.__test.phase()).toBe('rescued');
      session.__test.act({ kind: 'next' });
    }
    expect(session.__test.phase()).toBe('finished');
    const book = host.storage.get<Record<string, number>>('stars', {});
    for (const rescue of RESCUES) expect(book[rescue.id]).toBe(3);
    session.__test.act({ kind: 'next' });
    expect(session.__test.rescueId()).toBe('first-flight-1');
    session.unmount();
  });

  it('stops the clock when unmounted, leaving nothing behind', async () => {
    const { container, session } = await mountGame();
    session.__test.step(10);
    session.unmount();
    expect(container.querySelector('canvas')).toBeNull();
  });
});
```

- [ ] **Step 2: Run to see them fail**

Run: `npx vitest run games/balloon/src/audio games/balloon/src/integration.test.ts`
Expected: FAIL — the sound pack does not exist and the placeholder module has no `__test`.

- [ ] **Step 3: Implement the sound pack**

```ts
// games/balloon/src/audio/balloon-sounds.ts
import { noiseBurst, tone, type AudioBus, type SoundPack } from '@bundle/core';

/**
 * Every sound the game can make, by name. A later pack backed by recorded
 * samples implements the same names and swaps in with one line of setup.
 */
export const SOUND_EVENTS: readonly string[] = [
  'clip', 'unclip', 'full', 'pop', 'reinflate', 'puff',
  'count', 'float', 'strain', 'whoosh', 'land', 'cheer', 'star', 'chapter',
];

type Voice = (bus: AudioBus, delay: number, step: number) => void;

/** A balloon clipped on: a little rising squeak. */
const clip: Voice = (bus, delay) => tone(bus, { freq: 620, duration: 0.1, type: 'triangle', gain: 0.1, sweepTo: 900, delay });
/** Sent back: the same squeak, falling. */
const unclip: Voice = (bus, delay) => tone(bus, { freq: 800, duration: 0.1, type: 'triangle', gain: 0.08, sweepTo: 520, delay });
/** No room on the harness: soft, never a buzzer. */
const full: Voice = (bus, delay) => tone(bus, { freq: 220, duration: 0.16, type: 'sine', gain: 0.12, delay });
const pop: Voice = (bus, delay) => noiseBurst(bus, { duration: 0.09, gain: 0.2, filterHz: 3200, sweepTo: 900, delay });
const reinflate: Voice = (bus, delay) => noiseBurst(bus, { duration: 0.3, gain: 0.06, filterHz: 500, sweepTo: 2200, delay });
const puff: Voice = (bus, delay) => noiseBurst(bus, { duration: 0.22, gain: 0.08, filterHz: 900, sweepTo: 400, delay });
/** One tick of the count, a step higher for each balloon: counting on, out loud. */
const count: Voice = (bus, delay, step) =>
  tone(bus, { freq: 440 * Math.pow(2, (step * 2) / 12), duration: 0.14, type: 'sine', gain: 0.14, delay });
const float: Voice = (bus, delay) => {
  [392, 523.25, 659.25].forEach((freq, index) => tone(bus, { freq, duration: 0.4, type: 'sine', gain: 0.12, delay: delay + index * 0.14 }));
};
/** Too little: a creak and an effort. */
const strain: Voice = (bus, delay) => {
  tone(bus, { freq: 180, duration: 0.5, type: 'sawtooth', gain: 0.05, sweepTo: 240, delay });
  noiseBurst(bus, { duration: 0.3, gain: 0.04, filterHz: 300, delay });
};
/** Too much: a comic whoosh up and away. It should be funny. */
const whoosh: Voice = (bus, delay) => {
  noiseBurst(bus, { duration: 0.7, gain: 0.1, filterHz: 600, sweepTo: 4000, delay });
  tone(bus, { freq: 400, duration: 0.6, type: 'triangle', gain: 0.1, sweepTo: 1400, delay });
};
const land: Voice = (bus, delay) => tone(bus, { freq: 160, duration: 0.2, type: 'sine', gain: 0.14, sweepTo: 110, delay });
const cheer: Voice = (bus, delay) => {
  [523.25, 659.25, 783.99, 1046.5].forEach((freq, index) => tone(bus, { freq, duration: 0.3, type: 'triangle', gain: 0.15, delay: delay + index * 0.09 }));
};
const star: Voice = (bus, delay, step) => tone(bus, { freq: 880 + step * 220, duration: 0.2, type: 'sine', gain: 0.14, delay });
/** A new chapter: three notes climbing, attention without alarm. */
const chapter: Voice = (bus, delay) => {
  [523.25, 659.25, 830.61].forEach((freq, index) => tone(bus, { freq, duration: 0.26, type: 'triangle', gain: 0.15, delay: delay + index * 0.11 }));
};

const VOICES: Record<string, Voice> = { clip, unclip, full, pop, reinflate, puff, count, float, strain, whoosh, land, cheer, star, chapter };

export function createBalloonSoundPack(bus: AudioBus): SoundPack {
  return {
    async preload() {
      // Synthesised on demand; nothing to fetch.
    },
    play(event, params) {
      VOICES[event]?.(bus, Math.max(0, params?.delay ?? 0), params?.step ?? 0);
    },
  };
}
```

- [ ] **Step 4: Replace the module**

```ts
// games/balloon/src/index.ts
import { createTicker, DESIGN, type GameHost, type GameModule, type GameSession } from '@bundle/core';
import { createDriver, type Driver, type DriverEvent, type Phase } from './driver.js';
import type { Intent } from './intent.js';
import { feedbackLine, type Outcome } from './logic/outcome.js';
import { readBook } from './logic/progress.js';
import { solve } from './logic/solver.js';
import type { StarBook } from './logic/stars.js';
import { createBalloonSoundPack } from './audio/balloon-sounds.js';
import { createInput } from './view/input.js';
import { createScene } from './view/scene.js';
import { TIMING } from './view/timing.js';

export interface BalloonOptions {
  /** A rescue or chapter id, so `?game=balloon&level=pop-1` opens straight into Pop!. */
  startLevel?: string;
}

/** Test seam: play the game without synthesising pointer geometry. */
export interface BalloonTestHooks {
  step(frames?: number): void;
  act(intent: Intent): void;
  /** Step until the kit is back on the ground or on the ledge. */
  settle(): void;
  /** Work the sum out, let go, and land. */
  answer(): void;
  rescueId(): string;
  phase(): Phase;
  tries(): number;
  feedback(): string | null;
  stars(): StarBook;
}

export interface BalloonSession extends GameSession {
  readonly __test: BalloonTestHooks;
}

export interface BalloonModule extends GameModule<BalloonOptions> {
  mount(container: HTMLElement, host: GameHost, options?: BalloonOptions): Promise<BalloonSession>;
}

const STARS_KEY = 'stars';

/** The sound the kit makes as it leaves the ground, once the count is done. */
const liftOffSound = (outcome: Outcome): string => {
  if (outcome.verdict === 'exact' || outcome.axis === 'across') return 'float';
  return outcome.verdict === 'short' ? 'strain' : 'whoosh';
};

export const balloonGame: BalloonModule = {
  id: 'balloon',
  title: 'Balloon Rescue',

  async mount(container, host, options = {}): Promise<BalloonSession> {
    const sounds = createBalloonSoundPack(host.audio);
    await sounds.preload();

    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;';
    container.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    const scene = createScene();
    const driver: Driver = createDriver({
      book: readBook(host.storage.get<unknown>(STARS_KEY, {})),
      startLevel: options.startLevel,
    });

    const applySettings = (): void => {
      host.audio.muted = host.settings.values.muted;
      host.audio.volume = host.settings.values.volume;
    };
    applySettings();
    const unsubscribeSettings = host.settings.subscribe(applySettings);

    const handleEvents = (events: readonly DriverEvent[]): void => {
      for (const event of events) {
        switch (event.type) {
          case 'clipped':
            sounds.play('clip');
            break;
          case 'unclipped':
            sounds.play('unclip');
            break;
          case 'full':
            sounds.play('full');
            break;
          case 'popped':
            sounds.play('pop');
            break;
          case 'reinflated':
            sounds.play('reinflate');
            break;
          case 'puffed':
          case 'unpuffed':
            sounds.play('puff');
            break;
          case 'released': {
            const flight = driver.flight;
            if (!flight) break;
            const beat = flight.count / Math.max(1, flight.lifted.length);
            flight.lifted.forEach((_, step) => sounds.play('count', { delay: step * beat, step }));
            sounds.play(liftOffSound(event.outcome), { delay: flight.count });
            break;
          }
          case 'landed':
            if (event.outcome.verdict !== 'exact') sounds.play('land');
            break;
          case 'rescued':
            sounds.play('cheer');
            for (let step = 0; step < event.stars; step += 1) {
              sounds.play('star', { delay: TIMING.starsDelaySeconds + step * TIMING.starSeconds, step });
            }
            host.storage.set(STARS_KEY, event.book);
            break;
          case 'chapter':
            sounds.play('chapter');
            break;
          case 'finished':
            sounds.play('cheer');
            break;
          default:
            break;
        }
      }
    };

    const act = (intent: Intent): void => {
      const events = driver.act(intent);
      handleEvents(events);
      scene.observe(events);
    };

    const input = createInput(
      canvas,
      scene,
      (intent) => {
        void host.audio.unlock();
        act(intent);
      },
      () => ({ phase: driver.phase, rescue: driver.rescue.state }),
    );

    const resize = (): void => {
      const ratio = Math.min(globalThis.devicePixelRatio || 1, 3);
      canvas.width = Math.round((canvas.clientWidth || DESIGN.width) * ratio);
      canvas.height = Math.round((canvas.clientHeight || DESIGN.height) * ratio);
    };
    resize();
    globalThis.addEventListener?.('resize', resize);

    const frame = (dt: number): void => {
      const events = driver.step(dt);
      handleEvents(events);
      scene.observe(events);
      scene.update(dt, driver.model());
      if (ctx) scene.render(ctx, { width: canvas.width, height: canvas.height });
    };

    const ticker = createTicker(frame);
    ticker.start();

    const settle = (): void => {
      for (let i = 0; i < 60 * 12 && driver.phase === 'flying'; i += 1) frame(1 / 60);
    };

    return {
      pause: () => ticker.stop(),
      resume: () => ticker.start(),
      unmount() {
        ticker.stop();
        input.dispose();
        unsubscribeSettings();
        globalThis.removeEventListener?.('resize', resize);
        canvas.remove();
      },
      __test: {
        step: (frames = 1) => {
          for (let i = 0; i < frames; i += 1) frame(1 / 60);
        },
        act,
        settle,
        answer: () => {
          const answer = solve(driver.rescue.state.def)[0];
          if (!answer) throw new Error(`no answer to ${driver.rescue.state.def.id}`);
          answer.pop.forEach((index) => act({ kind: 'tied', index }));
          answer.clip.forEach((index) => act({ kind: 'tray', index }));
          answer.puffs.forEach((index) => act({ kind: 'puff', index }));
          act({ kind: 'letGo' });
          settle();
        },
        rescueId: () => driver.rescue.state.def.id,
        phase: () => driver.phase,
        tries: () => driver.rescue.state.tries,
        feedback: () => (driver.feedback ? feedbackLine(driver.feedback) : null),
        stars: () => driver.book,
      },
    };
  },
};

export default balloonGame;
export { createBalloonSoundPack, SOUND_EVENTS } from './audio/balloon-sounds.js';
```

- [ ] **Step 5: Run everything**

Run: `npm test && npm run typecheck`
Expected: PASS across the whole bundle, including the shell tests from Task 1.

- [ ] **Step 6: Commit**

```bash
git add games/balloon/src
git commit -m "feat(balloon): the module, the sound pack, and a game played end to end"
```

---

### Task 13: See it running, and write it down

**Files:**
- Modify: `README.md` (a Balloon Rescue section after Bramble Dash's; the "Not built yet" list mentions it alongside the others)

- [ ] **Step 1: Run the app and play it**

Run: `npm run dev`, open `http://localhost:5173/?game=balloon` (and `?game=balloon&level=pop-1`, `?game=balloon&level=windy-ridge-1`).

Check by eye, in a browser at 1152x768 and at an iPad-landscape and a phone-landscape size:
- the kit, weight tag, tray, button and top bar are all visible and nothing overlaps the story line
- tapping a tray balloon clips it; tapping it on the harness sends it back to its own gap in the tray
- no total appears while building; after "Let go!" the balloons light in turn and the count reads `5…` then `8!`
- too little: a strain and a hop, then the blue gauge "N more!"; too much: up off the top, parachute home, the coral gauge "N too many!"
- just right: up onto the ledge, the sum above it, then the stars and "Tap for the next rescue"
- Pop!: the rope and peg show, a tap pops a balloon into a limp one still wearing its number, a second tap puts it back
- Windy Ridge: the wind sock reads `3 →`, the step posts are numbered to the ledge, puffs sit in their own half of the tray and gather behind the kit

Fix anything that is wrong in the file that owns it, with a test where the mistake can be pinned by one.

- [ ] **Step 2: Add the README section**

After the Bramble Dash section, add:

```markdown
## Balloon Rescue

A fox kit is stuck on the ground and a ledge waits above it. Clip numbered
balloons to its harness until the lift is exactly its weight, then let go. Too
little and it strains and stays put; too much and it whooshes past the ledge
and parachutes home; exactly right and it floats up and steps off.

Sky Patrol and Bramble Dash ask a child to *recall* an answer. This one asks
them to *build* one: 8 is on the screen, and 5 + 3, 4 + 4 and 6 + 1 + 1 are all
theirs to find.

**Tap a balloon to clip it on; tap it again to send it back.** Dragging works
too. "Let go!" is the only way to find out, and a wrong try leaves the bunch as
it was, with the gap in words — "2 more!", "3 too many!".

**No running total while building.** The kit wears its weight; nothing adds up
the bunch until it is let go, and then the balloons light one by one as the
total is counted on. A live total would turn the game into watching a number
climb.

**Stars for working it out first**: three for the first try, two for the
second, one after that. A rescue is never failed.

**Eight chapters**: First Flight, Whoosh!, Big Bunches, Heavy Cargo (past ten),
Tiny Harness (a hook limit), Pop! (taking away), Windy Ridge (the wind gives
some steps and the puffs make up the rest) and The Big Rescue (two ideas at
once). `?game=balloon&level=pop-1` opens any rescue by id, or
`&level=windy-ridge` any chapter.

### The test that guards it

`games/balloon/src/logic/guards.test.ts` plays every rescue three ways. A bot
that grabs the biggest balloons must be right first time in under a quarter of
the rescues after the first chapter; a bot that picks at random must average
under two stars; a bot that works the sum out must get three stars everywhere.
If a size-only guess ever does well, the levels have stopped needing
arithmetic: fix the levels, never the test.
```

And in "Not built yet", extend the art-and-sound bullet with: "Balloon Rescue has a vector fox kit and a synthesised pack behind the same names." and change "The other seven games" to "The other six games".

- [ ] **Step 3: Final verification**

Run: `npm test && npm run typecheck && npm run build`
Expected: all tests pass, typecheck clean, build succeeds.

- [ ] **Step 4: Commit**

```bash
git add README.md games/balloon
git commit -m "docs(balloon): Balloon Rescue in the README"
```
