# Sky Patrol Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Sky Patrol, the bundle's second game: a plane shooter in which the only plane you may shoot is the one wearing the answer to the sum on your fighter, on one endless run of three hearts.

**Architecture:** A pure logic layer owns the whole run — planes aloft, shells in flight, the live sum, hearts — in normalised coordinates (`x` and `progress` both 0..1), so every rule is testable without a canvas. A canvas layer maps those fractions onto the 1152x768 design space and never writes back. The sum is written *about planes already flying* rather than the answer being spawned to order, which is what makes every plane shootable and keeps position from becoming a tell.

**Tech Stack:** TypeScript (strict, `noUncheckedIndexedAccess`), Vite, Vitest, canvas 2D, Web Audio via `@bundle/core`'s shared bus. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-19-sky-patrol-design.md` — read it before Task 1 and keep it open; this plan argues from it.

## Global Constraints

- **Design space 1152x768** landscape, as Seesaw's. Gameplay stays inside it; scenery may paint past it.
- **Answers never exceed 20 and never fall below 1.** Every plane number is drawn from the live band's answer set, which is what makes "every plane is shootable" structural rather than hopeful.
- **Three hearts for the whole run.** Hearts are spent only on the target escaping. A wrong shot costs `JAM_SECONDS = 0.9` of gun time and nothing else.
- **`src/logic/` is pure**: no DOM, no timers, no audio, no `Math.random` — randomness only through `createRng` from `@bundle/core`, seeded, so a run can be replayed exactly.
- **`src/view/` reads state and never writes it.**
- **The minus sign is `−` (U+2212), not a hyphen.** At 64px a hyphen reads as a dash.
- **Band titles are written for a six-year-old**: "Easy Sums", "Over Ten", "Take-Aways".
- **The game never asks whether the player paid.** The shell hands down a content manifest.
- Run `npm test` and `npm run typecheck` before every commit. Both must be clean.

---

### Task 1: Move the shared view primitives into core

Seesaw's viewport maths, spring, lettering and canvas test helpers are all needed verbatim by Sky Patrol. Copying them would let the two games' geometry and lettering drift apart, so they move to core first and Seesaw's own files become one-line re-export shims — no Seesaw import changes, so its existing suite proves nothing broke.

**Files:**
- Create: `packages/core/src/view/viewport.ts`, `packages/core/src/view/spring.ts`, `packages/core/src/view/type.ts`, `packages/core/src/view/recording-context.ts`, `packages/core/src/view/canvas-stub.ts`
- Create: `packages/core/src/view/viewport.test.ts`
- Modify: `packages/core/src/index.ts`
- Modify: `games/seesaw/src/view/layout.ts`, `games/seesaw/src/view/spring.ts`, `games/seesaw/src/view/type.ts`, `games/seesaw/src/view/recording-context.ts`, `games/seesaw/src/canvas-stub.ts` (each becomes a re-export)
- Delete: `games/seesaw/src/view/spring.test.ts` moves to `packages/core/src/view/spring.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces, all exported from `@bundle/core`: `DESIGN: Size`, `type Point = { x: number; y: number }`, `type Size = { width: number; height: number }`, `type Bounds`, `type ViewTransform`, `fitToScreen(screen: Size, design?: Size): ViewTransform`, `visibleBounds(screen: Size, transform: ViewTransform): Bounds`, `createSpring(initial: number, options?: SpringOptions): Spring`, `HAND: string`, `hand(weight: number, size: number): string`, `recordingContext(): RecordingContext`, `depthOf(ctx: CanvasRenderingContext2D): number`, `installCanvasStub(): () => void`.

- [ ] **Step 1: Move the files with git, so history follows them**

```bash
mkdir -p packages/core/src/view
git mv games/seesaw/src/view/spring.ts packages/core/src/view/spring.ts
git mv games/seesaw/src/view/spring.test.ts packages/core/src/view/spring.test.ts
git mv games/seesaw/src/view/type.ts packages/core/src/view/type.ts
git mv games/seesaw/src/view/recording-context.ts packages/core/src/view/recording-context.ts
git mv games/seesaw/src/canvas-stub.ts packages/core/src/view/canvas-stub.ts
```

- [ ] **Step 2: Split the viewport maths out of Seesaw's layout.ts**

Create `packages/core/src/view/viewport.ts` holding exactly what Seesaw's `layout.ts` had above the `TUCK` constant: `Point`, `Size`, `DESIGN`, `ViewTransform`, `Bounds`, `visibleBounds`, `fitToScreen`. Copy the bodies and the comments across unchanged — the comment explaining why 3:2 rather than 4:3 is the reason the number is what it is, and it travels with the number.

Fix the one import that moved: `packages/core/src/view/canvas-stub.ts` must now import from `'./recording-context.js'` (it was `'./view/recording-context.js'`).

- [ ] **Step 3: Leave re-export shims behind so no Seesaw file changes its imports**

```ts
// games/seesaw/src/view/spring.ts
export { createSpring, type Spring, type SpringOptions } from '@bundle/core';
```

```ts
// games/seesaw/src/view/type.ts
export { HAND, hand } from '@bundle/core';
```

```ts
// games/seesaw/src/view/recording-context.ts
export { recordingContext, depthOf, type RecordingContext } from '@bundle/core';
```

```ts
// games/seesaw/src/canvas-stub.ts
export { installCanvasStub } from '@bundle/core';
```

And at the top of `games/seesaw/src/view/layout.ts`, replace the moved declarations with a re-export, keeping `TUCK`, `Row` and `layOutRow` where they are — those are about animals in a basket, not about viewports:

```ts
export { DESIGN, fitToScreen, visibleBounds, type Bounds, type Point, type Size, type ViewTransform } from '@bundle/core';
```

- [ ] **Step 4: Export the new surface from core**

Add to `packages/core/src/index.ts`:

```ts
export { DESIGN, fitToScreen, visibleBounds, type Bounds, type Point, type Size, type ViewTransform } from './view/viewport.js';
export { createSpring, type Spring, type SpringOptions } from './view/spring.js';
export { HAND, hand } from './view/type.js';
export { recordingContext, depthOf, type RecordingContext } from './view/recording-context.js';
export { installCanvasStub } from './view/canvas-stub.js';
```

- [ ] **Step 5: Write a test for the viewport maths in its new home**

```ts
// packages/core/src/view/viewport.test.ts
import { describe, it, expect } from 'vitest';
import { DESIGN, fitToScreen, visibleBounds } from './viewport.js';

describe('fitToScreen', () => {
  it('centres the design space and round-trips a point', () => {
    const transform = fitToScreen({ width: 2304, height: 1536 });
    expect(transform.scale).toBe(2);
    const there = transform.toScreen({ x: 100, y: 50 });
    expect(transform.toDesign(there)).toEqual({ x: 100, y: 50 });
  });

  it('reports the surplus a wider screen leaves around the design rect', () => {
    const screen = { width: 2600, height: 1536 };
    const bounds = visibleBounds(screen, fitToScreen(screen));
    expect(bounds.left).toBeLessThan(0);
    expect(bounds.right).toBeGreaterThan(DESIGN.width);
  });
});
```

- [ ] **Step 6: Run the whole suite and the typechecker**

Run: `npm test && npm run typecheck`
Expected: PASS. Every Seesaw test still passes untouched — that is the whole point of the shims. If a Seesaw test fails, a moved file's imports are wrong; fix the import, not the test.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor(core): move viewport, spring, lettering and canvas test helpers into core

The second game needs all four verbatim, and two copies of the game's
lettering would let the two games drift apart. Seesaw's own files are now
re-export shims, so not one of its imports changed and its suite proves the
move was faithful."
```

---

### Task 2: The `games/sky` package, registered and mounting

An empty game that the shell can open. Nothing plays yet; this task's deliverable is that `?game=sky` reaches a live canvas and that the four registration points are correct, because a path mistake here is confusing to debug from inside gameplay code later.

**Files:**
- Create: `games/sky/package.json`, `games/sky/tsconfig.json`, `games/sky/src/index.ts`, `games/sky/src/vite-env.d.ts`, `games/sky/src/test-host.ts`, `games/sky/src/index.test.ts`
- Modify: `tsconfig.json` (paths), `vitest.config.ts` (alias), `apps/shell/vite.config.ts` (alias), `apps/shell/src/catalog.ts` (tile)

**Interfaces:**
- Consumes: `GameHost`, `GameModule`, `GameSession`, `createTicker` from `@bundle/core`.
- Produces: `skyGame: SkyModule` (default export too), `type SkyOptions = { startLevel?: string }`, `createTestHost(options?: { unlocked?: 'all' | readonly string[] }): TestHost` in `games/sky/src/test-host.ts`.

- [ ] **Step 1: Write the failing test**

```ts
// games/sky/src/index.test.ts
// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { installCanvasStub } from '@bundle/core';
import { skyGame } from './index.js';
import { createTestHost } from './test-host.js';

let restoreCanvas: () => void;
beforeAll(() => { restoreCanvas = installCanvasStub(); });
afterAll(() => restoreCanvas());

describe('skyGame', () => {
  it('names itself for the catalog', () => {
    expect(skyGame.id).toBe('sky');
    expect(skyGame.title).toBe('Sky Patrol');
  });

  it('mounts a canvas and takes it away again', async () => {
    const container = document.createElement('div');
    const session = await skyGame.mount(container, createTestHost());
    expect(container.querySelector('canvas')).not.toBeNull();
    session.unmount();
    expect(container.querySelector('canvas')).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run games/sky/src/index.test.ts`
Expected: FAIL — cannot resolve `./index.js`.

- [ ] **Step 3: Create the package**

```json
// games/sky/package.json
{
  "name": "@bundle/sky",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "src/index.ts"
}
```

```json
// games/sky/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src"]
}
```

```ts
// games/sky/src/vite-env.d.ts
/// <reference types="vite/client" />
```

- [ ] **Step 4: Register the package in all four places**

`tsconfig.json` — add to `compilerOptions.paths`:

```json
"@bundle/sky": ["games/sky/src/index.ts"]
```

`vitest.config.ts` — add to `resolve.alias`:

```ts
'@bundle/sky': resolvePath('./games/sky/src/index.ts'),
```

`apps/shell/vite.config.ts` — add to `resolve.alias`:

```ts
'@bundle/sky': resolvePath('../../games/sky/src/index.ts'),
```

`apps/shell/src/catalog.ts` — import the module and give it the second tile, **removing the `numberline` placeholder** so the bundle stays ten games. Sky Patrol is the addition-and-subtraction-within-20 game a Number Line Trail would have been drilling, and two playable tiles side by side is what the launcher should show.

```ts
import { seesawGame } from '@bundle/seesaw';
import { skyGame } from '@bundle/sky';
// ...
{ id: 'seesaw', title: 'Seesaw Park', blurb: 'Balance the animals', colors: ['#8fce72', '#5aa9d6'], module: seesawGame },
{ id: 'sky', title: 'Sky Patrol', blurb: 'Shoot the right answer', colors: ['#6fb6e8', '#2f6f9f'], module: skyGame },
```

- [ ] **Step 5: Write the test host**

Copy `games/seesaw/src/test-host.ts` verbatim, changing only the storage namespace from `'seesaw'` to `'sky'`. The `fakeContext` import stays as the same relative reach into core:

```ts
import { fakeContext } from '../../../packages/core/src/audio/fake-context.js';
```

- [ ] **Step 6: Write the minimal module**

```ts
// games/sky/src/index.ts
import { createTicker, type GameHost, type GameModule, type GameSession } from '@bundle/core';

export interface SkyOptions {
  /** A band id, so `?game=sky&level=take-aways` opens straight into subtraction. */
  startLevel?: string;
}

export interface SkyModule extends GameModule<SkyOptions> {
  mount(container: HTMLElement, host: GameHost, options?: SkyOptions): Promise<GameSession>;
}

export const skyGame: SkyModule = {
  id: 'sky',
  title: 'Sky Patrol',

  async mount(container, host, _options = {}): Promise<GameSession> {
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;';
    container.appendChild(canvas);

    const ticker = createTicker(() => {});
    ticker.start();

    return {
      pause: () => ticker.stop(),
      resume: () => ticker.start(),
      unmount() {
        ticker.stop();
        canvas.remove();
      },
    };
  },
};

export default skyGame;
```

- [ ] **Step 7: Run the tests and the typechecker**

Run: `npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(sky): the Sky Patrol package, registered and mounting

An empty canvas the shell can open at ?game=sky. It takes the second tile
and retires the Number Line Trail placeholder, which is the skill this game
drills, so the bundle stays ten games."
```

---
### Task 3: The tempo curve and the three bands

Two pure tables of numbers, both functions of elapsed time only. Tempo is a function of the clock and not of how well the player is doing, so skill shows up in the score rather than in the difficulty.

**Files:**
- Create: `games/sky/src/logic/tempo.ts`, `games/sky/src/logic/tempo.test.ts`
- Create: `games/sky/src/logic/bands.data.ts`, `games/sky/src/logic/bands.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `type Tempo = { fallSeconds: number; aloft: number; thinkSeconds: number; spawnEvery: number }`, `tempoAt(elapsed: number): Tempo`; `type BandId = 'easy' | 'over-ten' | 'take-aways'`, `interface Band { id: BandId; title: string; from: number; answers: { from: number; to: number }; easyMix: number; addMix: number }`, `BANDS: readonly Band[]`, `bandAt(elapsed: number): Band`, `bandById(id: string): Band | undefined`, `answerSet(band: Band): readonly number[]`.

- [ ] **Step 1: Write the failing tempo test**

```ts
// games/sky/src/logic/tempo.test.ts
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
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run games/sky/src/logic/tempo.test.ts`
Expected: FAIL — cannot resolve `./tempo.js`.

- [ ] **Step 3: Write the tempo curve**

```ts
// games/sky/src/logic/tempo.ts
/**
 * How the sky tightens as a run goes on. Elapsed time is the only input: a
 * player doing well is not punished for it, so skill shows up in the score
 * rather than in the difficulty.
 */
export interface Tempo {
  /** Seconds a plain glider takes to fall from the spawn line to the escape line. */
  fallSeconds: number;
  /** How many planes the sky wants aloft. */
  aloft: number;
  /**
   * Fall time a plane must have left before a sum may ask about it. This is the
   * number that keeps the game arithmetic rather than reflex: a rising tempo
   * shrinks the margin for error, never the thinking time.
   */
  thinkSeconds: number;
  /** Gap between spawns, derived so the sky fills to `aloft` and stays there. */
  spawnEvery: number;
}

/** How long the run takes to reach full pace. */
const RAMP_SECONDS = 180;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));
const lerp = (from: number, to: number, t: number): number => from + (to - from) * t;
/** Ease out, so the first minute tightens gently and the third is brisk. */
const ease = (t: number): number => 1 - (1 - t) * (1 - t);

export function tempoAt(elapsed: number): Tempo {
  const ramp = ease(clamp01(elapsed / RAMP_SECONDS));
  // Past the ramp the sky keeps creeping towards the floor, so a very long run
  // still ends rather than settling into a comfortable plateau.
  const beyond = clamp01((elapsed - RAMP_SECONDS) / RAMP_SECONDS);
  const fallSeconds = lerp(13, 5.5, ramp) - 0.5 * beyond;
  const aloft = Math.round(lerp(4, 7, ramp));
  return { fallSeconds, aloft, thinkSeconds: lerp(5.5, 3, ramp), spawnEvery: fallSeconds / aloft };
}
```

- [ ] **Step 4: Run the tempo test**

Run: `npx vitest run games/sky/src/logic/tempo.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing bands test**

```ts
// games/sky/src/logic/bands.test.ts
import { describe, it, expect } from 'vitest';
import { answerSet, bandAt, bandById, BANDS } from './bands.data.js';

describe('bands', () => {
  it('opens on easy sums and hands over on time', () => {
    expect(bandAt(0).id).toBe('easy');
    expect(bandAt(44).id).toBe('easy');
    expect(bandAt(45).id).toBe('over-ten');
    expect(bandAt(119).id).toBe('over-ten');
    expect(bandAt(120).id).toBe('take-aways');
    expect(bandAt(9999).id).toBe('take-aways');
  });

  it('is titled for a six-year-old', () => {
    expect(BANDS.map((band) => band.title)).toEqual(['Easy Sums', 'Over Ten', 'Take-Aways']);
  });

  it('finds a band by id, for ?game=sky&level=take-aways', () => {
    expect(bandById('take-aways')?.from).toBe(120);
    expect(bandById('nonsense')).toBeUndefined();
  });

  it('never allows a number outside 1..20 into the sky', () => {
    for (const band of BANDS) {
      for (const number of answerSet(band)) {
        expect(number).toBeGreaterThanOrEqual(1);
        expect(number).toBeLessThanOrEqual(20);
      }
    }
  });

  it('keeps the opening band inside ten', () => {
    expect(answerSet(BANDS[0]!)).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('lets easy sums keep flying once the numbers get big', () => {
    const overTen = answerSet(BANDS[1]!);
    expect(overTen).toContain(4);
    expect(overTen).toContain(20);
  });
});
```

- [ ] **Step 6: Run it to make sure it fails**

Run: `npx vitest run games/sky/src/logic/bands.test.ts`
Expected: FAIL — cannot resolve `./bands.data.js`.

- [ ] **Step 7: Write the band table**

```ts
// games/sky/src/logic/bands.data.ts
export type BandId = 'easy' | 'over-ten' | 'take-aways';

/**
 * One stretch of the curriculum. A band decides two separate things: which
 * numbers planes may wear, and how a sum for one of those numbers is written.
 */
export interface Band {
  id: BandId;
  /** Written for a six-year-old rather than for a spreadsheet. */
  title: string;
  /** Seconds into a run when this band takes over. */
  from: number;
  /** The numbers planes may wear while it is live. */
  answers: { from: number; to: number };
  /**
   * Chance a plane's number is drawn from 2..10 instead of the band's own range,
   * so crossing ten arrives as a change of gear rather than a wall.
   */
  easyMix: number;
  /**
   * Chance a sum is written as an addition. Below 1 it means take-aways are
   * live, and addition stays in the mix so that the *sign* is something worth
   * reading rather than a constant to ignore.
   */
  addMix: number;
}

export const BANDS: readonly Band[] = [
  { id: 'easy', title: 'Easy Sums', from: 0, answers: { from: 2, to: 10 }, easyMix: 1, addMix: 1 },
  { id: 'over-ten', title: 'Over Ten', from: 45, answers: { from: 11, to: 20 }, easyMix: 0.3, addMix: 1 },
  { id: 'take-aways', title: 'Take-Aways', from: 120, answers: { from: 1, to: 20 }, easyMix: 0, addMix: 0.4 },
];

export const bandAt = (elapsed: number): Band => {
  let current = BANDS[0]!;
  for (const band of BANDS) if (elapsed >= band.from) current = band;
  return current;
};

export const bandById = (id: string): Band | undefined => BANDS.find((band) => band.id === id);

/**
 * Every number a plane may wear while this band is live. The spawner draws from
 * it, which is what makes "every plane is shootable" a structural fact: a plane
 * cannot wear a number no sum of this band could produce.
 */
export const answerSet = (band: Band): readonly number[] => {
  const numbers = new Set<number>();
  for (let n = band.answers.from; n <= band.answers.to; n += 1) numbers.add(n);
  if (band.easyMix > 0) for (let n = 2; n <= 10; n += 1) numbers.add(n);
  return [...numbers].sort((a, b) => a - b);
};
```

- [ ] **Step 8: Run both tests and the typechecker**

Run: `npx vitest run games/sky/src/logic && npm run typecheck`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(sky): the tempo curve and the three curriculum bands

Both are functions of elapsed time alone. The figure that matters most is
thinkSeconds: a rising tempo shrinks the margin for error and never the
thinking time, which is the difference between an arithmetic game and a
reflex test."
```

---

### Task 4: Writing sums

Given a number a plane is wearing, write a sum that makes it — preferring operands already in the sky, because shooting an operand instead of the answer is the characteristic error at this age and is worth baiting on purpose.

**Files:**
- Create: `games/sky/src/logic/equation.ts`, `games/sky/src/logic/equation.test.ts`

**Interfaces:**
- Consumes: `Rng` from `@bundle/core`; `Band` from `./bands.data.js`.
- Produces: `type Op = '+' | '-'`, `interface Sum { left: number; op: Op; right: number; answer: number }`, `CEILING = 20`, `sumText(sum: Sum): string`, `additionsFor(answer: number): readonly Sum[]`, `subtractionsFor(answer: number): readonly Sum[]`, `drawAnswer(rng: Rng, band: Band): number`, `writeSum(rng: Rng, band: Band, answer: number, inTheSky: readonly number[]): Sum | null`.

- [ ] **Step 1: Write the failing test**

```ts
// games/sky/src/logic/equation.test.ts
import { describe, it, expect } from 'vitest';
import { createRng } from '@bundle/core';
import { BANDS, answerSet } from './bands.data.js';
import { additionsFor, drawAnswer, subtractionsFor, sumText, writeSum, CEILING } from './equation.js';

const EASY = BANDS[0]!;
const OVER_TEN = BANDS[1]!;
const TAKE_AWAYS = BANDS[2]!;

describe('sums for an answer', () => {
  it('lists every addition that makes it, with no zeroes', () => {
    expect(additionsFor(4)).toEqual([
      { left: 1, op: '+', right: 3, answer: 4 },
      { left: 2, op: '+', right: 2, answer: 4 },
      { left: 3, op: '+', right: 1, answer: 4 },
    ]);
  });

  it('lists every take-away that makes it, staying under the ceiling', () => {
    const sums = subtractionsFor(18);
    expect(sums).toEqual([
      { left: 19, op: '-', right: 1, answer: 18 },
      { left: 20, op: '-', right: 2, answer: 18 },
    ]);
    for (const sum of sums) expect(sum.left).toBeLessThanOrEqual(CEILING);
  });

  it('writes the minus sign as a minus sign, not a hyphen', () => {
    expect(sumText({ left: 15, op: '-', right: 8, answer: 7 })).toBe('15 − 8');
    expect(sumText({ left: 7, op: '+', right: 8, answer: 15 })).toBe('7 + 8');
  });
});

describe('writeSum', () => {
  it('always produces a sum whose answer is the number asked for', () => {
    const rng = createRng(7);
    for (const band of BANDS) {
      for (const answer of answerSet(band)) {
        const sum = writeSum(rng, band, answer, []);
        expect(sum, `no sum for ${answer} in ${band.id}`).not.toBeNull();
        const worked = sum!.op === '+' ? sum!.left + sum!.right : sum!.left - sum!.right;
        expect(worked).toBe(answer);
        expect(sum!.left).toBeLessThanOrEqual(CEILING);
        expect(sum!.right).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('only writes additions while take-aways have not arrived', () => {
    const rng = createRng(3);
    for (let i = 0; i < 200; i += 1) {
      expect(writeSum(rng, OVER_TEN, 14, [])!.op).toBe('+');
      expect(writeSum(rng, EASY, 9, [])!.op).toBe('+');
    }
  });

  it('writes both signs once take-aways arrive, so the sign must be read', () => {
    const rng = createRng(5);
    const ops = new Set<string>();
    for (let i = 0; i < 300; i += 1) ops.add(writeSum(rng, TAKE_AWAYS, 8, [])!.op);
    expect([...ops].sort()).toEqual(['+', '-']);
  });

  it('prefers operands already in the sky, so the sky baits its own trap', () => {
    const rng = createRng(11);
    for (let i = 0; i < 50; i += 1) {
      const sum = writeSum(rng, OVER_TEN, 15, [7, 3, 19])!;
      expect([sum.left, sum.right]).toContain(7);
    }
  });

  it('falls back to any sum when the sky offers no useful operand', () => {
    const sum = writeSum(createRng(2), OVER_TEN, 15, [20]);
    expect(sum!.left + sum!.right).toBe(15);
  });
});

describe('drawAnswer', () => {
  it('stays inside the band it was asked about', () => {
    const rng = createRng(13);
    for (const band of BANDS) {
      const allowed = answerSet(band);
      for (let i = 0; i < 500; i += 1) expect(allowed).toContain(drawAnswer(rng, band));
    }
  });

  it('keeps easy sums flying in the over-ten band, but mostly big ones', () => {
    const rng = createRng(17);
    const drawn = Array.from({ length: 1000 }, () => drawAnswer(rng, OVER_TEN));
    const easy = drawn.filter((n) => n <= 10).length;
    expect(easy).toBeGreaterThan(150);
    expect(easy).toBeLessThan(450);
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run games/sky/src/logic/equation.test.ts`
Expected: FAIL — cannot resolve `./equation.js`.

- [ ] **Step 3: Write the equation module**

```ts
// games/sky/src/logic/equation.ts
import type { Rng } from '@bundle/core';
import type { Band } from './bands.data.js';

export type Op = '+' | '-';

/** The question on the fighter's fuselage. */
export interface Sum {
  left: number;
  op: Op;
  right: number;
  answer: number;
}

/** The biggest number anything in this game is allowed to reach. */
export const CEILING = 20;

/** U+2212, not a hyphen: at 64px a hyphen reads as a dash. */
export const sumText = (sum: Sum): string => `${sum.left} ${sum.op === '+' ? '+' : '−'} ${sum.right}`;

/** Every addition that makes this answer. Neither operand is ever zero. */
export const additionsFor = (answer: number): readonly Sum[] => {
  const sums: Sum[] = [];
  for (let left = 1; left < answer; left += 1) sums.push({ left, op: '+', right: answer - left, answer });
  return sums;
};

/** Every take-away that makes this answer without going over the ceiling. */
export const subtractionsFor = (answer: number): readonly Sum[] => {
  const sums: Sum[] = [];
  for (let left = answer + 1; left <= CEILING; left += 1) sums.push({ left, op: '-', right: left - answer, answer });
  return sums;
};

/** A number for a plane to wear, drawn from what this band allows. */
export const drawAnswer = (rng: Rng, band: Band): number => {
  if (rng.next() < band.easyMix) return 2 + rng.int(9);
  return band.answers.from + rng.int(band.answers.to - band.answers.from + 1);
};

/**
 * A sum for this answer, preferring operands already in the sky: asked about a
 * plane wearing 15 with a 7 aloft, the fighter shows `7 + 8`, so the sky baits
 * its own trap. Shooting an operand instead of the answer is the characteristic
 * error at this age, and it should be available to make.
 *
 * Null is unreachable for answers 1..20 — 1 has no addition and 20 has no
 * take-away, and each falls back to the other form — but the caller checks.
 */
export const writeSum = (rng: Rng, band: Band, answer: number, inTheSky: readonly number[]): Sum | null => {
  const wantsAddition = rng.next() < band.addMix;
  const preferred = wantsAddition ? additionsFor(answer) : subtractionsFor(answer);
  const other = wantsAddition ? subtractionsFor(answer) : additionsFor(answer);
  const pool = preferred.length > 0 ? preferred : other;
  if (pool.length === 0) return null;
  const baited = pool.filter((sum) => inTheSky.includes(sum.left) || inTheSky.includes(sum.right));
  return rng.pick(baited.length > 0 ? baited : pool);
};
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run games/sky/src/logic/equation.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(sky): write a sum for a number a plane is already wearing

Sums are written about the sky rather than the sky being spawned to match a
sum, and the writer prefers operands already flying, so the fighter showing
7 + 8 usually means there is a 7 up there to shoot by mistake."
```

---
### Task 5: The plane catalog and the planes aloft

The five plane types, and the maths of one plane falling. Positions are normalised — `x` and `progress` both 0..1 — so the whole of gameplay is testable without a canvas, and the view is the only thing that knows how big the screen is.

**Files:**
- Create: `games/sky/src/logic/planes.ts`, `games/sky/src/logic/planes.test.ts`
- Create: `games/sky/src/logic/sky-state.ts`, `games/sky/src/logic/sky-state.test.ts`

**Interfaces:**
- Consumes: `Rng` from `@bundle/core`.
- Produces: `type PlaneTypeId = 'glider' | 'weaver' | 'blimp' | 'scout' | 'hider'`, `interface PlaneType`, `PLANE_TYPES: Record<PlaneTypeId, PlaneType>`, `PLANE_IDS: readonly PlaneTypeId[]`, `typesAt(elapsed: number): readonly PlaneType[]`, `drawType(rng: Rng, elapsed: number): PlaneType`; `interface Plane`, `planeX(plane: Plane): number`, `remaining(plane: Plane): number`, `escaped(plane: Plane): boolean`, `advance(plane: Plane, dt: number): void`, `struck(plane: Plane, x: number, y: number): boolean`, `damage(plane: Plane): 'damaged' | 'destroyed'`.

- [ ] **Step 1: Write the failing plane-catalog test**

```ts
// games/sky/src/logic/planes.test.ts
import { describe, it, expect } from 'vitest';
import { createRng } from '@bundle/core';
import { drawType, PLANE_IDS, PLANE_TYPES, typesAt } from './planes.js';

describe('plane types', () => {
  it('opens with nothing but gliders', () => {
    expect(typesAt(0).map((type) => type.id)).toEqual(['glider']);
  });

  it('brings each type in at its own arrival time', () => {
    expect(typesAt(30).map((type) => type.id)).toEqual(['glider', 'weaver']);
    expect(typesAt(50).map((type) => type.id)).toContain('blimp');
    expect(typesAt(75).map((type) => type.id)).toContain('scout');
    expect(typesAt(110).map((type) => type.id)).toEqual(PLANE_IDS);
  });

  it('describes a blimp as slow and three-hit, and a scout as fast and one-hit', () => {
    expect(PLANE_TYPES.blimp.speed).toBeLessThan(1);
    expect(PLANE_TYPES.blimp.hits).toBe(3);
    expect(PLANE_TYPES.scout.speed).toBeGreaterThan(1.5);
    expect(PLANE_TYPES.scout.hits).toBe(1);
  });

  it('gives only the cloud-hider something to hide behind', () => {
    for (const id of PLANE_IDS) {
      if (id === 'hider') expect(PLANE_TYPES[id].hideSeconds).toBeGreaterThan(0);
      else expect(PLANE_TYPES[id].hideSeconds).toBe(0);
    }
  });

  it('keeps every plane small enough to fit the playfield twice over', () => {
    for (const id of PLANE_IDS) {
      expect(PLANE_TYPES[id].halfWidth).toBeGreaterThan(0);
      expect(PLANE_TYPES[id].halfWidth).toBeLessThan(0.25);
      expect(PLANE_TYPES[id].hits).toBeGreaterThanOrEqual(1);
    }
  });

  it('only ever draws a type that has arrived', () => {
    const rng = createRng(4);
    for (let i = 0; i < 500; i += 1) expect(drawType(rng, 40).id).toMatch(/glider|weaver/);
  });

  it('draws every arrived type sooner or later', () => {
    const rng = createRng(9);
    const seen = new Set(Array.from({ length: 2000 }, () => drawType(rng, 200).id));
    expect([...seen].sort()).toEqual([...PLANE_IDS].sort());
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run games/sky/src/logic/planes.test.ts`
Expected: FAIL — cannot resolve `./planes.js`.

- [ ] **Step 3: Write the plane catalog**

```ts
// games/sky/src/logic/planes.ts
import type { Rng } from '@bundle/core';

export type PlaneTypeId = 'glider' | 'weaver' | 'blimp' | 'scout' | 'hider';

/**
 * A kind of plane. Each one is a different *reason* to be hard — thumbs, time,
 * commitment, memory — so the ramp is never merely "faster".
 *
 * Sizes are fractions of the playfield, and they are the hit box: the view
 * draws a plane from these numbers rather than keeping its own, so what a child
 * aims at and what the shell collides with can never drift apart.
 */
export interface PlaneType {
  id: PlaneTypeId;
  label: string;
  /** Multiplies the tempo's fall speed: 1.8 falls nearly twice as fast. */
  speed: number;
  /** Shots needed to bring it down. */
  hits: number;
  /** Seconds into a run before it may appear. */
  from: number;
  /** How likely it is against the other types that have arrived. */
  weight: number;
  halfWidth: number;
  halfHeight: number;
  /** Sideways sway, as a fraction of the playfield's width. */
  sway: number;
  /** Sways per second. */
  swayHz: number;
  /** Seconds its number is hidden at a time; 0 never hides it. */
  hideSeconds: number;
  /** Seconds its number shows between hides. */
  showSeconds: number;
}

export const PLANE_TYPES: Record<PlaneTypeId, PlaneType> = {
  // Straight down, steady, readable. The plane everything else is measured against.
  glider: { id: 'glider', label: 'Glider', speed: 1, hits: 1, from: 0, weight: 5, halfWidth: 0.055, halfHeight: 0.045, sway: 0, swayHz: 0, hideSeconds: 0, showSeconds: 0 },
  // Falls in an S. The number is plain; lining up is the work — so it delays a
  // child who knows the answer and never punishes them for knowing it.
  weaver: { id: 'weaver', label: 'Weaver', speed: 1, hits: 1, from: 30, weight: 3, halfWidth: 0.05, halfHeight: 0.042, sway: 0.12, swayHz: 0.35, hideSeconds: 0, showSeconds: 0 },
  // Slow, big, and three hits: it rewards committing to an answer, because you
  // cannot dab at it and change your mind. Also a breather between scouts.
  blimp: { id: 'blimp', label: 'Blimp', speed: 0.55, hits: 3, from: 50, weight: 2, halfWidth: 0.085, halfHeight: 0.06, sway: 0.02, swayHz: 0.15, hideSeconds: 0, showSeconds: 0 },
  // The type that genuinely threatens a heart. The fair window still applies, so
  // a scout you are asked about is always winnable.
  scout: { id: 'scout', label: 'Scout', speed: 1.8, hits: 1, from: 75, weight: 2, halfWidth: 0.045, halfHeight: 0.035, sway: 0, swayHz: 0, hideSeconds: 0, showSeconds: 0 },
  // Ducks behind cloud, so the player must remember which plane was the 15.
  hider: { id: 'hider', label: 'Cloud-hider', speed: 0.9, hits: 1, from: 110, weight: 2, halfWidth: 0.055, halfHeight: 0.045, sway: 0.05, swayHz: 0.2, hideSeconds: 1.2, showSeconds: 1.6 },
};

/** Arrival order, which is also the order the catalog is read in. */
export const PLANE_IDS: readonly PlaneTypeId[] = ['glider', 'weaver', 'blimp', 'scout', 'hider'];

export const typesAt = (elapsed: number): readonly PlaneType[] =>
  PLANE_IDS.map((id) => PLANE_TYPES[id]).filter((type) => elapsed >= type.from);

export function drawType(rng: Rng, elapsed: number): PlaneType {
  const available = typesAt(elapsed);
  const total = available.reduce((sum, type) => sum + type.weight, 0);
  let roll = rng.next() * total;
  for (const type of available) {
    roll -= type.weight;
    if (roll <= 0) return type;
  }
  return available[0] ?? PLANE_TYPES.glider;
}
```

- [ ] **Step 4: Run the catalog test**

Run: `npx vitest run games/sky/src/logic/planes.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing sky-state test**

```ts
// games/sky/src/logic/sky-state.test.ts
import { describe, it, expect } from 'vitest';
import { PLANE_TYPES, type PlaneTypeId } from './planes.js';
import { advance, damage, escaped, planeX, remaining, struck, type Plane } from './sky-state.js';

const plane = (type: PlaneTypeId, overrides: Partial<Plane> = {}): Plane => ({
  uid: 'p1',
  number: 15,
  type,
  progress: 0,
  fallSeconds: 10,
  lane: 0.5,
  phase: 0,
  age: 0,
  hits: 0,
  hidden: false,
  hideTimer: PLANE_TYPES[type].showSeconds,
  ...overrides,
});

describe('a plane falling', () => {
  it('crosses the sky in its own fall time', () => {
    const p = plane('glider');
    advance(p, 5);
    expect(p.progress).toBeCloseTo(0.5, 5);
    expect(remaining(p)).toBeCloseTo(5, 5);
    expect(escaped(p)).toBe(false);
    advance(p, 5);
    expect(escaped(p)).toBe(true);
    expect(remaining(p)).toBe(0);
  });

  it('keeps a weaver on the playfield however far it swings', () => {
    const p = plane('weaver', { lane: 0.02 });
    for (let i = 0; i < 400; i += 1) {
      advance(p, 1 / 60);
      const x = planeX(p);
      expect(x).toBeGreaterThanOrEqual(PLANE_TYPES.weaver.halfWidth - 1e-9);
      expect(x).toBeLessThanOrEqual(1 - PLANE_TYPES.weaver.halfWidth + 1e-9);
    }
  });

  it('holds a straight faller in its lane', () => {
    const p = plane('glider', { lane: 0.3 });
    advance(p, 3);
    expect(planeX(p)).toBeCloseTo(0.3, 5);
  });

  it('hides and shows the cloud-hider number in turn', () => {
    const p = plane('hider');
    expect(p.hidden).toBe(false);
    advance(p, PLANE_TYPES.hider.showSeconds + 0.01);
    expect(p.hidden).toBe(true);
    advance(p, PLANE_TYPES.hider.hideSeconds + 0.01);
    expect(p.hidden).toBe(false);
  });

  it('is struck only by a shell inside its body', () => {
    const p = plane('glider', { progress: 0.5, lane: 0.5 });
    expect(struck(p, 0.5, 0.5)).toBe(true);
    expect(struck(p, 0.5 + PLANE_TYPES.glider.halfWidth - 0.001, 0.5)).toBe(true);
    expect(struck(p, 0.5 + PLANE_TYPES.glider.halfWidth + 0.01, 0.5)).toBe(false);
    expect(struck(p, 0.5, 0.5 + PLANE_TYPES.glider.halfHeight + 0.01)).toBe(false);
  });

  it('takes a glider down in one shot', () => {
    expect(damage(plane('glider'))).toBe('destroyed');
  });

  it('takes a blimp down in three, and no fewer', () => {
    const p = plane('blimp');
    expect(damage(p)).toBe('damaged');
    expect(damage(p)).toBe('damaged');
    expect(damage(p)).toBe('destroyed');
  });
});
```

- [ ] **Step 6: Run it to make sure it fails**

Run: `npx vitest run games/sky/src/logic/sky-state.test.ts`
Expected: FAIL — cannot resolve `./sky-state.js`.

- [ ] **Step 7: Write the plane state**

```ts
// games/sky/src/logic/sky-state.ts
import { PLANE_TYPES, type PlaneTypeId } from './planes.js';

/**
 * One plane in the air. Positions are fractions, never pixels: `progress` runs
 * 0 at the spawn line to 1 at the escape line, and `lane` runs 0 to 1 across the
 * playfield. The view is the only thing that knows how big a screen is.
 */
export interface Plane {
  readonly uid: string;
  /** What it wears, and therefore what sum can ask for it. */
  readonly number: number;
  readonly type: PlaneTypeId;
  progress: number;
  /** Seconds it takes to fall the whole way, its type's speed included. */
  fallSeconds: number;
  /** The line it flies down; weavers sway about it. */
  lane: number;
  /** Where its sway starts, so two weavers never move as one. */
  phase: number;
  age: number;
  hits: number;
  /** Whether its number can be read right now. */
  hidden: boolean;
  /** Seconds until it hides or shows again. */
  hideTimer: number;
}

/** Keeps a plane's whole body on the playfield, however far it sways. */
const clampLane = (x: number, halfWidth: number): number =>
  Math.min(1 - halfWidth, Math.max(halfWidth, x));

export const planeX = (plane: Plane): number => {
  const type = PLANE_TYPES[plane.type];
  const sway = type.sway * Math.sin(plane.phase + plane.age * type.swayHz * Math.PI * 2);
  return clampLane(plane.lane + sway, type.halfWidth);
};

/** Seconds of fall left. The number the fair window is measured against. */
export const remaining = (plane: Plane): number => Math.max(0, (1 - plane.progress) * plane.fallSeconds);

export const escaped = (plane: Plane): boolean => plane.progress >= 1;

export function advance(plane: Plane, dt: number): void {
  plane.age += dt;
  plane.progress += dt / plane.fallSeconds;
  const type = PLANE_TYPES[plane.type];
  if (type.hideSeconds <= 0) return;
  plane.hideTimer -= dt;
  if (plane.hideTimer > 0) return;
  plane.hidden = !plane.hidden;
  plane.hideTimer = plane.hidden ? type.hideSeconds : type.showSeconds;
}

/** Whether a shell at this point, in playfield fractions, is inside the plane. */
export const struck = (plane: Plane, x: number, y: number): boolean => {
  const type = PLANE_TYPES[plane.type];
  return Math.abs(x - planeX(plane)) <= type.halfWidth && Math.abs(y - plane.progress) <= type.halfHeight;
};

/** Another shell home. A blimp remembers the hits it has taken. */
export const damage = (plane: Plane): 'damaged' | 'destroyed' => {
  plane.hits += 1;
  return plane.hits >= PLANE_TYPES[plane.type].hits ? 'destroyed' : 'damaged';
};
```

- [ ] **Step 8: Run the tests and the typechecker**

Run: `npx vitest run games/sky/src/logic && npm run typecheck`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(sky): the five plane types and the maths of one plane falling

Positions are fractions rather than pixels, so every rule is testable
without a canvas. A type's half-width is both its drawn size and its hit
box, so what a child aims at and what the shell collides with cannot drift."
```

---

### Task 6: Choosing which plane the sum asks about

The fair window, and the weighting that stops "shoot the lowest one" from ever becoming a strategy.

**Files:**
- Create: `games/sky/src/logic/targeting.ts`, `games/sky/src/logic/targeting.test.ts`

**Interfaces:**
- Consumes: `Rng` from `@bundle/core`; `Plane`, `remaining` from `./sky-state.js`.
- Produces: `eligible(aloft: readonly Plane[], thinkSeconds: number): readonly Plane[]`, `chooseTarget(rng: Rng, aloft: readonly Plane[], thinkSeconds: number): Plane | null`.

- [ ] **Step 1: Write the failing test**

```ts
// games/sky/src/logic/targeting.test.ts
import { describe, it, expect } from 'vitest';
import { createRng } from '@bundle/core';
import { chooseTarget, eligible } from './targeting.js';
import { remaining, type Plane } from './sky-state.js';

const at = (uid: string, progress: number, fallSeconds = 10): Plane => ({
  uid,
  number: 15,
  type: 'glider',
  progress,
  fallSeconds,
  lane: 0.5,
  phase: 0,
  age: 0,
  hits: 0,
  hidden: false,
  hideTimer: 0,
});

describe('eligible', () => {
  it('passes over a plane with less than the thinking time left', () => {
    const aloft = [at('high', 0.1), at('low', 0.8)];
    expect(eligible(aloft, 5).map((plane) => plane.uid)).toEqual(['high']);
    expect(remaining(aloft[1]!)).toBeLessThan(5);
  });

  it('counts a freshly spawned plane as fair, whatever the tempo', () => {
    expect(eligible([at('new', 0, 5.5)], 3)).toHaveLength(1);
  });
});

describe('chooseTarget', () => {
  it('gives up when nothing aloft has time left', () => {
    expect(chooseTarget(createRng(1), [at('low', 0.95)], 3)).toBeNull();
    expect(chooseTarget(createRng(1), [], 3)).toBeNull();
  });

  it('always chooses a plane that still has its full fair window', () => {
    const aloft = [at('a', 0.1), at('b', 0.3), at('c', 0.45), at('d', 0.9)];
    const rng = createRng(21);
    for (let i = 0; i < 300; i += 1) {
      const chosen = chooseTarget(rng, aloft, 5)!;
      expect(remaining(chosen)).toBeGreaterThanOrEqual(5);
      expect(chosen.uid).not.toBe('d');
    }
  });

  it('leans on the most urgent plane without ever being predictable', () => {
    const aloft = [at('a', 0.05), at('b', 0.25), at('c', 0.45)];
    const rng = createRng(33);
    const counts = new Map<string, number>();
    for (let i = 0; i < 900; i += 1) {
      const uid = chooseTarget(rng, aloft, 5)!.uid;
      counts.set(uid, (counts.get(uid) ?? 0) + 1);
    }
    // The lowest fair plane is likeliest, so the pressure is real...
    expect(counts.get('c')!).toBeGreaterThan(counts.get('b')!);
    expect(counts.get('b')!).toBeGreaterThan(counts.get('a')!);
    // ...but every plane gets asked about, so position is never the answer.
    expect(counts.get('a')!).toBeGreaterThan(80);
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run games/sky/src/logic/targeting.test.ts`
Expected: FAIL — cannot resolve `./targeting.js`.

- [ ] **Step 3: Write the targeting**

```ts
// games/sky/src/logic/targeting.ts
import type { Rng } from '@bundle/core';
import { remaining, type Plane } from './sky-state.js';

/**
 * The planes a sum may fairly ask about: those with at least the tempo's
 * thinking time left to fall. A freshly spawned plane always qualifies, which is
 * what lets the run send one up when the sky has nothing askable in it.
 */
export const eligible = (aloft: readonly Plane[], thinkSeconds: number): readonly Plane[] =>
  aloft.filter((plane) => remaining(plane) >= thinkSeconds);

/**
 * Which plane the next sum asks about.
 *
 * Urgency is weighted rather than absolute. The plane furthest down is likeliest,
 * so the pressure is real and the game naturally asks about planes before they
 * get away — but it is not certain, so "shoot the lowest one" never becomes a
 * strategy that works without reading a number. That is the failure the Seesaw
 * arcade half was cut for, and this weighting is where it is designed out.
 */
export function chooseTarget(rng: Rng, aloft: readonly Plane[], thinkSeconds: number): Plane | null {
  const pool = [...eligible(aloft, thinkSeconds)].sort((a, b) => b.progress - a.progress);
  if (pool.length === 0) return null;
  const weights = pool.map((_, index) => 1 / (index + 1));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let roll = rng.next() * total;
  for (let i = 0; i < pool.length; i += 1) {
    roll -= weights[i]!;
    if (roll <= 0) return pool[i]!;
  }
  return pool[0]!;
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run games/sky/src/logic/targeting.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(sky): choose the target by urgency, weighted rather than absolute

The lowest fair plane is likeliest to be asked about, so the pressure is the
sky itself and no timer is needed. It is never certain, so position never
becomes an answer a child can shoot without reading a number."
```

---
### Task 7: The spawner and the trap invariant

What number the next plane wears. This is the task that keeps the arithmetic load-bearing: while a sum is live the sky must hold something plausible-but-wrong, so the answer has to be computed rather than scanned for.

**Files:**
- Create: `games/sky/src/logic/spawner.ts`, `games/sky/src/logic/spawner.test.ts`

**Interfaces:**
- Consumes: `Rng` from `@bundle/core`; `Band`, `answerSet` from `./bands.data.js`; `Sum`, `drawAnswer` from `./equation.js`; `drawType` from `./planes.js`; `Plane` from `./sky-state.js`.
- Produces: `isTrapFor(sum: Sum, value: number): boolean`, `hasTrap(sum: Sum, aloft: readonly Plane[]): boolean`, `trapNumber(rng: Rng, sum: Sum, band: Band): number`, `interface SpawnSpec { uid: string; number: number; elapsed: number; fallSeconds: number; lane?: number }`, `spawnPlane(rng: Rng, spec: SpawnSpec): Plane`, `nextNumber(rng: Rng, band: Band, sum: Sum | null, aloft: readonly Plane[]): number`.

- [ ] **Step 1: Write the failing test**

```ts
// games/sky/src/logic/spawner.test.ts
import { describe, it, expect } from 'vitest';
import { createRng } from '@bundle/core';
import { answerSet, BANDS } from './bands.data.js';
import { hasTrap, isTrapFor, nextNumber, spawnPlane, trapNumber } from './spawner.js';
import { PLANE_TYPES } from './planes.js';
import { planeX, type Plane } from './sky-state.js';
import type { Sum } from './equation.js';

const OVER_TEN = BANDS[1]!;
const SEVEN_PLUS_EIGHT: Sum = { left: 7, op: '+', right: 8, answer: 15 };

const wearing = (number: number): Plane => ({
  uid: `p${number}`,
  number,
  type: 'glider',
  progress: 0.2,
  fallSeconds: 10,
  lane: 0.5,
  phase: 0,
  age: 0,
  hits: 0,
  hidden: false,
  hideTimer: 0,
});

describe('isTrapFor', () => {
  it('counts an operand as a trap, because shooting one is the error of this age', () => {
    expect(isTrapFor(SEVEN_PLUS_EIGHT, 7)).toBe(true);
    expect(isTrapFor(SEVEN_PLUS_EIGHT, 8)).toBe(true);
  });

  it('counts a near miss as a trap', () => {
    expect(isTrapFor(SEVEN_PLUS_EIGHT, 14)).toBe(true);
    expect(isTrapFor(SEVEN_PLUS_EIGHT, 16)).toBe(true);
    expect(isTrapFor(SEVEN_PLUS_EIGHT, 13)).toBe(true);
  });

  it('does not count the answer itself, or a number nowhere near it', () => {
    expect(isTrapFor(SEVEN_PLUS_EIGHT, 15)).toBe(false);
    expect(isTrapFor(SEVEN_PLUS_EIGHT, 2)).toBe(false);
  });
});

describe('hasTrap', () => {
  it('is false for a sky where the answer is the only plausible number', () => {
    expect(hasTrap(SEVEN_PLUS_EIGHT, [wearing(15), wearing(2), wearing(3)])).toBe(false);
  });

  it('is true once something plausible-but-wrong is up there', () => {
    expect(hasTrap(SEVEN_PLUS_EIGHT, [wearing(15), wearing(16)])).toBe(true);
    expect(hasTrap(SEVEN_PLUS_EIGHT, [wearing(15), wearing(7)])).toBe(true);
  });
});

describe('trapNumber', () => {
  it('reaches for an operand first', () => {
    const rng = createRng(6);
    for (let i = 0; i < 40; i += 1) expect([7, 8]).toContain(trapNumber(rng, SEVEN_PLUS_EIGHT, OVER_TEN));
  });

  it('falls back to a near miss when the operands are not allowed in the sky', () => {
    // 20 − 19 = 1 in the opening band, whose planes only wear 2..10.
    const easy = BANDS[0]!;
    const sum: Sum = { left: 20, op: '-', right: 19, answer: 1 };
    const value = trapNumber(createRng(8), sum, easy);
    expect(answerSet(easy)).toContain(value);
    expect(isTrapFor(sum, value)).toBe(true);
  });

  it('never suggests a number the band would not allow', () => {
    const rng = createRng(12);
    for (const band of BANDS) {
      const allowed = answerSet(band);
      for (const answer of allowed) {
        const sum: Sum = { left: answer, op: '+', right: 0, answer };
        expect(allowed).toContain(trapNumber(rng, sum, band));
      }
    }
  });
});

describe('nextNumber', () => {
  it('injects a trap when the live sum has none in the sky', () => {
    const value = nextNumber(createRng(2), OVER_TEN, SEVEN_PLUS_EIGHT, [wearing(15), wearing(3)]);
    expect(isTrapFor(SEVEN_PLUS_EIGHT, value)).toBe(true);
  });

  it('draws freely once a trap is already flying', () => {
    const rng = createRng(2);
    const drawn = new Set<number>();
    for (let i = 0; i < 200; i += 1) {
      drawn.add(nextNumber(rng, OVER_TEN, SEVEN_PLUS_EIGHT, [wearing(15), wearing(16)]));
    }
    expect(drawn.size).toBeGreaterThan(4);
  });

  it('draws freely when nothing has been asked yet', () => {
    const allowed = answerSet(OVER_TEN);
    const rng = createRng(4);
    for (let i = 0; i < 100; i += 1) expect(allowed).toContain(nextNumber(rng, OVER_TEN, null, []));
  });
});

describe('spawnPlane', () => {
  it('starts a plane at the top, undamaged, in a lane that fits it', () => {
    const rng = createRng(5);
    for (let i = 0; i < 200; i += 1) {
      const plane = spawnPlane(rng, { uid: `p${i}`, number: 9, elapsed: 200, fallSeconds: 10 });
      const type = PLANE_TYPES[plane.type];
      expect(plane.progress).toBe(0);
      expect(plane.hits).toBe(0);
      expect(plane.number).toBe(9);
      expect(planeX(plane)).toBeGreaterThanOrEqual(type.halfWidth - 1e-9);
      expect(planeX(plane)).toBeLessThanOrEqual(1 - type.halfWidth + 1e-9);
      // A blimp is slow, so its fall takes longer than the tempo's own figure.
      expect(plane.fallSeconds).toBeCloseTo(10 / type.speed, 5);
    }
  });

  it('puts a plane where it is told, for an escort pair', () => {
    const plane = spawnPlane(createRng(1), { uid: 'p', number: 9, elapsed: 0, fallSeconds: 10, lane: 0.25 });
    expect(plane.lane).toBeCloseTo(0.25, 5);
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run games/sky/src/logic/spawner.test.ts`
Expected: FAIL — cannot resolve `./spawner.js`.

- [ ] **Step 3: Write the spawner**

```ts
// games/sky/src/logic/spawner.ts
import type { Rng } from '@bundle/core';
import { answerSet, type Band } from './bands.data.js';
import { drawAnswer, type Sum } from './equation.js';
import { drawType } from './planes.js';
import type { Plane } from './sky-state.js';

/**
 * Whether a number is worth having in the sky while this sum is live: an
 * operand, or a near miss. Either forces the answer to be computed instead of
 * scanned for as the only plausible number up there.
 */
export const isTrapFor = (sum: Sum, value: number): boolean =>
  value !== sum.answer &&
  (value === sum.left || value === sum.right || Math.abs(value - sum.answer) <= 2);

export const hasTrap = (sum: Sum, aloft: readonly Plane[]): boolean =>
  aloft.some((plane) => isTrapFor(sum, plane.number));

/**
 * A trap to send up. An operand first — shooting the 7 when asked for 7 + 8 is
 * the characteristic error at this age, and it should be there to make — then a
 * near miss, then anything the band allows rather than nothing at all.
 */
export const trapNumber = (rng: Rng, sum: Sum, band: Band): number => {
  const allowed = answerSet(band);
  const operands = [sum.left, sum.right].filter((value) => isTrapFor(sum, value) && allowed.includes(value));
  if (operands.length > 0) return rng.pick(operands);
  const nearby = [sum.answer - 1, sum.answer + 1, sum.answer - 2, sum.answer + 2].filter(
    (value) => allowed.includes(value) && isTrapFor(sum, value),
  );
  return nearby.length > 0 ? rng.pick(nearby) : rng.pick(allowed);
};

export interface SpawnSpec {
  uid: string;
  number: number;
  elapsed: number;
  /** The tempo's fall time; the plane's own type stretches or shortens it. */
  fallSeconds: number;
  /** Where to fly, for an escort pair. Random within the playfield otherwise. */
  lane?: number;
}

export function spawnPlane(rng: Rng, spec: SpawnSpec): Plane {
  const type = drawType(rng, spec.elapsed);
  const free = 1 - 2 * type.halfWidth;
  const lane = spec.lane ?? type.halfWidth + rng.next() * free;
  return {
    uid: spec.uid,
    number: spec.number,
    type: type.id,
    progress: 0,
    fallSeconds: spec.fallSeconds / type.speed,
    lane: Math.min(1 - type.halfWidth, Math.max(type.halfWidth, lane)),
    phase: rng.next() * Math.PI * 2,
    age: 0,
    hits: 0,
    hidden: false,
    hideTimer: type.showSeconds,
  };
}

/**
 * The number the next plane wears. A live sum with no trap in the sky gets one
 * now; otherwise the band draws freely.
 */
export const nextNumber = (rng: Rng, band: Band, sum: Sum | null, aloft: readonly Plane[]): number =>
  sum && !hasTrap(sum, aloft) ? trapNumber(rng, sum, band) : drawAnswer(rng, band);
```

- [ ] **Step 4: Run the test and the typechecker**

Run: `npx vitest run games/sky/src/logic/spawner.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(sky): the spawner, and the trap that keeps the maths load-bearing

While a sum is live the sky must hold an operand or a near miss, injected if
chance has not provided one. Without it a child can shoot the only plausible
number on screen and never compute anything."
```

---

### Task 8: The run

Everything assembled: hearts, score, streak, the band clock, planes aloft, shells in flight, and the rule that a sum is always asked about a plane that is already flying.

**Files:**
- Create: `games/sky/src/logic/run.ts`, `games/sky/src/logic/run.test.ts`

**Interfaces:**
- Consumes: `createRng`, `Rng` from `@bundle/core`; everything from Tasks 3–7.
- Produces: `interface Bullet { x: number; y: number }`, `type RunEvent`, `interface RunState`, `interface RunOptions { seed?: number; hearts?: number; startBand?: BandId }`, `interface Run { readonly state: RunState; step(dt: number): readonly RunEvent[]; aim(x: number): void; fire(): void }`, `createRun(options?: RunOptions): Run`, `JAM_SECONDS = 0.9`, `HEARTS = 3`, `BULLET_SECONDS = 0.35`.

- [ ] **Step 1: Write the failing test**

```ts
// games/sky/src/logic/run.test.ts
import { describe, it, expect } from 'vitest';
import { createRun, HEARTS, JAM_SECONDS, type Run, type RunEvent } from './run.js';
import { planeX, type Plane } from './sky-state.js';

const FRAME = 1 / 60;

/** Runs the clock, collecting everything that happened. */
const run = (game: Run, seconds: number): RunEvent[] => {
  const events: RunEvent[] = [];
  for (let t = 0; t < seconds; t += FRAME) events.push(...game.step(FRAME));
  return events;
};

const target = (game: Run): Plane | undefined =>
  game.state.aloft.find((plane) => plane.uid === game.state.targetUid);

/** Lines the fighter up under a plane and shoots until something happens. */
const shoot = (game: Run, plane: Plane): RunEvent[] => {
  const events: RunEvent[] = [];
  for (let i = 0; i < 200; i += 1) {
    const live = game.state.aloft.find((entry) => entry.uid === plane.uid);
    if (!live) break;
    game.aim(planeX(live));
    game.fire();
    const batch = game.step(FRAME);
    events.push(...batch);
    if (batch.some((event) => event.type === 'destroyed' || event.type === 'jammed')) break;
  }
  return events;
};

describe('a run opening', () => {
  it('starts with a sky already flying and a question already asked', () => {
    const game = createRun({ seed: 1 });
    game.step(FRAME);
    expect(game.state.aloft.length).toBeGreaterThanOrEqual(4);
    expect(game.state.sum).not.toBeNull();
    expect(game.state.hearts).toBe(HEARTS);
    expect(game.state.band.id).toBe('easy');
  });

  it('asks about a plane that is actually up there', () => {
    const game = createRun({ seed: 2 });
    run(game, 20);
    const chosen = target(game)!;
    expect(chosen).toBeDefined();
    expect(chosen.number).toBe(game.state.sum!.answer);
  });

  it('can open at a band, for ?game=sky&level=take-aways', () => {
    const game = createRun({ seed: 3, startBand: 'take-aways' });
    game.step(FRAME);
    expect(game.state.band.id).toBe('take-aways');
  });
});

describe('shooting', () => {
  it('scores the right plane and asks something new', () => {
    const game = createRun({ seed: 4 });
    run(game, 2);
    const chosen = target(game)!;
    const asked = game.state.sum!;
    const events = shoot(game, chosen);
    expect(events.some((event) => event.type === 'destroyed')).toBe(true);
    expect(game.state.score).toBe(1);
    expect(game.state.streak).toBe(1);
    expect(game.state.hearts).toBe(HEARTS);
    // The new question is not the old one, and is answerable by something aloft.
    expect(game.state.sum).not.toBe(asked);
    expect(target(game)!.number).toBe(game.state.sum!.answer);
  });

  it('jams the gun on the wrong plane and costs no heart', () => {
    const game = createRun({ seed: 5 });
    run(game, 2);
    const wrong = game.state.aloft.find((plane) => plane.number !== game.state.sum!.answer)!;
    const events = shoot(game, wrong);
    expect(events.some((event) => event.type === 'jammed')).toBe(true);
    expect(game.state.hearts).toBe(HEARTS);
    expect(game.state.score).toBe(0);
    expect(game.state.jam).toBeCloseTo(JAM_SECONDS, 1);
    // The plane shrugged it off: it is still flying.
    expect(game.state.aloft.some((plane) => plane.uid === wrong.uid)).toBe(true);
  });

  it('will not fire while the gun is overheating', () => {
    const game = createRun({ seed: 6 });
    run(game, 2);
    const wrong = game.state.aloft.find((plane) => plane.number !== game.state.sum!.answer)!;
    shoot(game, wrong);
    const before = game.state.bullets.length;
    game.fire();
    expect(game.state.bullets.length).toBe(before);
  });

  it('takes three shells to down a blimp, and the sum survives the first two', () => {
    const game = createRun({ seed: 7, startBand: 'take-aways' });
    let blimp: Plane | undefined;
    for (let i = 0; i < 4000 && !blimp; i += 1) {
      game.step(FRAME);
      const chosen = target(game);
      if (chosen?.type === 'blimp') blimp = chosen;
    }
    expect(blimp, 'no blimp was ever asked about').toBeDefined();
    const asked = game.state.sum!;
    const events = shoot(game, blimp!);
    expect(events.filter((event) => event.type === 'damaged').length).toBeGreaterThanOrEqual(1);
    expect(game.state.sum === asked || game.state.score === 1).toBe(true);
  });
});

describe('escapes', () => {
  it('costs a heart when the plane being asked about gets away', () => {
    const game = createRun({ seed: 8 });
    run(game, 2);
    const chosen = target(game)!;
    const events = run(game, chosen.fallSeconds + 1);
    expect(events.some((event) => event.type === 'escaped')).toBe(true);
    expect(game.state.hearts).toBeLessThan(HEARTS);
  });

  it('costs nothing when any other plane leaves', () => {
    const game = createRun({ seed: 9, hearts: 99 });
    const events = run(game, 60);
    const escapes = events.filter((event) => event.type === 'escaped').length;
    const gone = events.filter((event) => event.type === 'spawned').length - game.state.aloft.length;
    expect(gone).toBeGreaterThan(escapes);
  });

  it('ends the run when the last heart goes, and stops dead', () => {
    const game = createRun({ seed: 10, hearts: 1 });
    run(game, 2);
    run(game, 40);
    expect(game.state.status).toBe('over');
    const after = run(game, 5);
    expect(after).toHaveLength(0);
  });
});

describe('the clock', () => {
  it('announces a band change once, without rewriting the live question', () => {
    const game = createRun({ seed: 11, hearts: 99 });
    run(game, 44);
    const asked = game.state.sum;
    const events = run(game, 3);
    const changes = events.filter((event) => event.type === 'band');
    expect(changes).toHaveLength(1);
    expect(game.state.sum === asked || game.state.score > 0).toBe(true);
  });

  it('keeps the sky as full as the tempo wants', () => {
    const game = createRun({ seed: 12, hearts: 99 });
    run(game, 150);
    expect(game.state.aloft.length).toBeGreaterThanOrEqual(game.state.tempo.aloft - 2);
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run games/sky/src/logic/run.test.ts`
Expected: FAIL — cannot resolve `./run.js`.

- [ ] **Step 3: Write the run**

```ts
// games/sky/src/logic/run.ts
import { createRng, type Rng } from '@bundle/core';
import { bandAt, bandById, type Band, type BandId } from './bands.data.js';
import { writeSum, type Sum } from './equation.js';
import { advance, damage, escaped, struck, type Plane } from './sky-state.js';
import { hasTrap, nextNumber, spawnPlane, trapNumber } from './spawner.js';
import { chooseTarget } from './targeting.js';
import { tempoAt, type Tempo } from './tempo.js';

/** A shell in flight. `y` runs 1 at the fighter down to 0 at the spawn line. */
export interface Bullet {
  x: number;
  y: number;
}

export type RunEvent =
  | { type: 'spawned'; plane: Plane }
  | { type: 'asked'; sum: Sum; target: Plane }
  | { type: 'damaged'; plane: Plane }
  | { type: 'destroyed'; plane: Plane; sum: Sum }
  | { type: 'jammed'; plane: Plane }
  | { type: 'escaped'; plane: Plane; hearts: number }
  | { type: 'band'; band: Band }
  | { type: 'ended'; score: number };

export interface RunState {
  elapsed: number;
  hearts: number;
  score: number;
  streak: number;
  bestStreak: number;
  band: Band;
  tempo: Tempo;
  /** The question on the fighter, or null for the instant before one is written. */
  sum: Sum | null;
  targetUid: string | null;
  aloft: Plane[];
  bullets: Bullet[];
  /** Where the fighter is, 0..1 across the playfield. */
  fighterX: number;
  /** Seconds of overheat left. The gun cannot fire while this is above zero. */
  jam: number;
  status: 'flying' | 'over';
}

export interface RunOptions {
  seed?: number;
  hearts?: number;
  /** Opens the run at a band's own pace, for `?game=sky&level=take-aways`. */
  startBand?: BandId;
}

export interface Run {
  readonly state: RunState;
  step(dt: number): readonly RunEvent[];
  /** Slide the fighter. 0..1 across the playfield. */
  aim(x: number): void;
  /** Let go of the screen: one shell. */
  fire(): void;
}

/** Three for the whole run. */
export const HEARTS = 3;
/** What a wrong answer costs: gun time, never a heart. */
export const JAM_SECONDS = 0.9;
/** How long a shell takes to cross the sky. */
export const BULLET_SECONDS = 0.35;
/** Chance a spawn brings an escort pair, once the numbers get big. */
const ESCORT_CHANCE = 0.18;

export function createRun(options: RunOptions = {}): Run {
  const rng: Rng = createRng(options.seed ?? 1);
  const opened = (options.startBand ? bandById(options.startBand)?.from : 0) ?? 0;
  let uidCounter = 0;
  const nextUid = (): string => `plane-${(uidCounter += 1)}`;

  const state: RunState = {
    elapsed: opened,
    hearts: options.hearts ?? HEARTS,
    score: 0,
    streak: 0,
    bestStreak: 0,
    band: bandAt(opened),
    tempo: tempoAt(opened),
    sum: null,
    targetUid: null,
    aloft: [],
    bullets: [],
    fighterX: 0.5,
    jam: 0,
    status: 'flying',
  };

  let sinceSpawn = 0;

  const spawn = (events: RunEvent[], number?: number, lane?: number): Plane => {
    const plane = spawnPlane(rng, {
      uid: nextUid(),
      number: number ?? nextNumber(rng, state.band, state.sum, state.aloft),
      elapsed: state.elapsed,
      fallSeconds: state.tempo.fallSeconds,
      lane,
    });
    state.aloft.push(plane);
    events.push({ type: 'spawned', plane });
    return plane;
  };

  /**
   * Write the next question about a plane already flying. If nothing aloft can
   * fairly be asked about, one is sent up for the purpose — so the game can
   * never ask a question it has not also made answerable.
   */
  const ask = (events: RunEvent[]): void => {
    const chosen = chooseTarget(rng, state.aloft, state.tempo.thinkSeconds) ?? spawn(events);
    const sum = writeSum(rng, state.band, chosen.number, state.aloft.map((plane) => plane.number));
    if (!sum) return;
    state.sum = sum;
    state.targetUid = chosen.uid;
    events.push({ type: 'asked', sum, target: chosen });
    // A question whose answer is the only plausible number in the sky can be
    // answered without arithmetic, so a trap goes up now.
    if (!hasTrap(sum, state.aloft)) spawn(events, trapNumber(rng, sum, state.band));
  };

  // Open with a sky already flying, spread down the screen, so the first
  // question is about a plane that is already on its way rather than one that
  // has just appeared at the top.
  const prime = (): void => {
    const events: RunEvent[] = [];
    for (let i = 0; i < state.tempo.aloft; i += 1) {
      const plane = spawn(events);
      plane.progress = 0.08 * i;
      plane.age = plane.progress * plane.fallSeconds;
    }
  };
  prime();

  const step = (dt: number): readonly RunEvent[] => {
    const events: RunEvent[] = [];
    if (state.status === 'over') return events;

    state.elapsed += dt;
    state.tempo = tempoAt(state.elapsed);
    const band = bandAt(state.elapsed);
    if (band.id !== state.band.id) {
      state.band = band;
      events.push({ type: 'band', band });
    }
    if (state.jam > 0) state.jam = Math.max(0, state.jam - dt);

    for (const plane of state.aloft) advance(plane, dt);

    // Planes that got away. Only the one being asked about costs anything; the
    // rest were never the player's business.
    const gone = state.aloft.filter(escaped);
    if (gone.length > 0) {
      state.aloft = state.aloft.filter((plane) => !escaped(plane));
      for (const plane of gone) {
        if (plane.uid !== state.targetUid) continue;
        state.hearts -= 1;
        state.streak = 0;
        state.sum = null;
        state.targetUid = null;
        events.push({ type: 'escaped', plane, hearts: state.hearts });
      }
    }

    if (state.hearts <= 0) {
      state.status = 'over';
      events.push({ type: 'ended', score: state.score });
      return events;
    }

    for (const bullet of state.bullets) bullet.y -= dt / BULLET_SECONDS;
    const spent = new Set<Bullet>();
    for (const bullet of state.bullets) {
      if (bullet.y <= 0) {
        spent.add(bullet);
        continue;
      }
      const hit = state.aloft.find((plane) => struck(plane, bullet.x, bullet.y));
      if (!hit) continue;
      spent.add(bullet);

      if (!state.sum || hit.number !== state.sum.answer) {
        // The wrong plane shrugs the shell off. The cost is the clock, which is
        // the thing that actually matters as the sky speeds up.
        state.jam = JAM_SECONDS;
        state.streak = 0;
        events.push({ type: 'jammed', plane: hit });
        continue;
      }

      if (damage(hit) === 'damaged') {
        events.push({ type: 'damaged', plane: hit });
        continue;
      }

      state.aloft = state.aloft.filter((plane) => plane.uid !== hit.uid);
      state.score += 1;
      state.streak += 1;
      state.bestStreak = Math.max(state.bestStreak, state.streak);
      events.push({ type: 'destroyed', plane: hit, sum: state.sum });
      state.sum = null;
      state.targetUid = null;
    }
    state.bullets = state.bullets.filter((bullet) => !spent.has(bullet));

    sinceSpawn += dt;
    if (state.aloft.length < state.tempo.aloft && sinceSpawn >= state.tempo.spawnEvery) {
      sinceSpawn = 0;
      const first = spawn(events);
      // Escort pairs: two planes abreast wearing neighbouring numbers, so once
      // the numbers get big the sky supplies its own traps.
      if (state.band.id !== 'easy' && rng.next() < ESCORT_CHANCE) {
        const shift = rng.next() < 0.5 ? -1 : 1;
        const neighbour = Math.min(20, Math.max(1, first.number + shift));
        spawn(events, neighbour, first.lane + (first.lane < 0.5 ? 0.12 : -0.12));
      }
    }

    if (!state.sum) ask(events);
    return events;
  };

  return {
    state,
    step,
    aim(x) {
      state.fighterX = Math.min(1, Math.max(0, x));
    },
    fire() {
      if (state.status === 'over' || state.jam > 0) return;
      state.bullets.push({ x: state.fighterX, y: 1 });
    },
  };
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run games/sky/src/logic/run.test.ts`
Expected: PASS. If the blimp test cannot find a blimp inside 4000 frames, raise `PLANE_TYPES.blimp.weight` rather than loosening the test — a blimp nobody is ever asked about is a plane type that is not in the game.

- [ ] **Step 5: Run the whole suite and the typechecker**

Run: `npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(sky): the run — hearts, shells, escapes and the band clock

One sum live at a time, written about a plane already flying. Hearts are
spent only on the target escaping; a wrong shell jams the gun for 0.9s and
the plane shrugs it off, so a slipped thumb never ends a run and a misread
number still costs the only thing that matters."
```

---
### Task 9: The invariants, and proof the maths is load-bearing

No new production code — this task is the guard rail. Every promise the spec makes becomes an executable claim about long seeded runs, including the one that would have caught the Seesaw arcade half before it shipped.

**Files:**
- Create: `games/sky/src/logic/invariants.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 3–8. Nothing new is produced.

- [ ] **Step 1: Write the invariant tests**

```ts
// games/sky/src/logic/invariants.test.ts
import { describe, it, expect } from 'vitest';
import { answerSet, BANDS } from './bands.data.js';
import { createRun, HEARTS, type Run } from './run.js';
import { hasTrap } from './spawner.js';
import { planeX, remaining, type Plane } from './sky-state.js';

const FRAME = 1 / 60;
const SEEDS = [1, 2, 3, 5, 8, 13, 21, 34];

/** Every number any band would ever allow into the sky. */
const EVERY_ALLOWED_NUMBER = new Set(BANDS.flatMap((band) => [...answerSet(band)]));

/** The plane the live sum is asking about. */
const target = (game: Run): Plane | undefined =>
  game.state.aloft.find((plane) => plane.uid === game.state.targetUid);

describe('a long run never breaks its promises', () => {
  it('never puts a number in the sky that no sum could produce', () => {
    for (const seed of SEEDS) {
      const game = createRun({ seed, hearts: 999 });
      for (let i = 0; i < 60 * 60 * 5; i += 1) {
        game.step(FRAME);
        for (const plane of game.state.aloft) {
          expect(EVERY_ALLOWED_NUMBER.has(plane.number), `plane wearing ${plane.number}`).toBe(true);
        }
      }
    }
  });

  it('always has a plane aloft wearing the answer to the live sum', () => {
    for (const seed of SEEDS) {
      const game = createRun({ seed, hearts: 999 });
      for (let i = 0; i < 60 * 60 * 5; i += 1) {
        game.step(FRAME);
        const sum = game.state.sum;
        if (!sum) continue;
        const answering = game.state.aloft.filter((plane) => plane.number === sum.answer);
        expect(answering.length, `nothing aloft answers ${sum.answer}`).toBeGreaterThan(0);
      }
    }
  });

  it('never asks about a plane without its full fair window', () => {
    for (const seed of SEEDS) {
      const game = createRun({ seed, hearts: 999 });
      let lastUid: string | null = null;
      for (let i = 0; i < 60 * 60 * 5; i += 1) {
        const events = game.step(FRAME);
        for (const event of events) {
          if (event.type !== 'asked') continue;
          expect(remaining(event.target)).toBeGreaterThanOrEqual(game.state.tempo.thinkSeconds - 1e-6);
          lastUid = event.target.uid;
        }
      }
      expect(lastUid).not.toBeNull();
    }
  });

  it('always keeps something plausible-but-wrong in the sky', () => {
    for (const seed of SEEDS) {
      const game = createRun({ seed, hearts: 999 });
      // Traps are injected as the question is written, so check from the frame
      // after each question rather than during it.
      let asked = false;
      for (let i = 0; i < 60 * 60 * 3; i += 1) {
        const events = game.step(FRAME);
        if (events.some((event) => event.type === 'asked')) {
          asked = true;
          continue;
        }
        const sum = game.state.sum;
        if (!asked || !sum) continue;
        expect(hasTrap(sum, game.state.aloft), `no trap for ${sum.answer}`).toBe(true);
      }
    }
  });

  it('keeps every plane inside the playfield', () => {
    const game = createRun({ seed: 42, hearts: 999 });
    for (let i = 0; i < 60 * 60 * 4; i += 1) {
      game.step(FRAME);
      for (const plane of game.state.aloft) {
        expect(planeX(plane)).toBeGreaterThanOrEqual(0);
        expect(planeX(plane)).toBeLessThanOrEqual(1);
      }
    }
  });

  it('never deadlocks: a question is always live or being written', () => {
    const game = createRun({ seed: 77, hearts: 999 });
    for (let i = 0; i < 60 * 60 * 10; i += 1) {
      game.step(FRAME);
      expect(game.state.sum).not.toBeNull();
      expect(target(game)).toBeDefined();
    }
  });
});

describe('the maths is load-bearing', () => {
  /**
   * A player who reads the sum, finds the plane wearing its answer, lines up and
   * fires. Proof the game is winnable at all: without this, the bot test below
   * would pass for the wrong reason.
   */
  const playWell = (game: Run, seconds: number): void => {
    for (let t = 0; t < seconds; t += FRAME) {
      const chosen = target(game);
      if (chosen) {
        game.aim(planeX(chosen));
        // Only shoot when lined up, so a shell in flight is never wasted on a
        // plane that has swayed out from under it.
        if (Math.abs(game.state.fighterX - planeX(chosen)) < 0.01) game.fire();
      }
      game.step(FRAME);
    }
  };

  /** A player who never reads a number and simply shoots whatever is lowest. */
  const playBlind = (game: Run, seconds: number): void => {
    for (let t = 0; t < seconds; t += FRAME) {
      const lowest = [...game.state.aloft].sort((a, b) => b.progress - a.progress)[0];
      if (lowest) {
        game.aim(planeX(lowest));
        game.fire();
      }
      game.step(FRAME);
    }
  };

  it('is winnable: reading the sum keeps all three hearts for two minutes', () => {
    for (const seed of [1, 2, 3, 5]) {
      const game = createRun({ seed });
      playWell(game, 120);
      expect(game.state.hearts, `seed ${seed}`).toBe(HEARTS);
      expect(game.state.score).toBeGreaterThan(15);
    }
  });

  /**
   * The test this whole design exists to pass. Seesaw Park's arcade half was
   * built and cut because a player could win it without reading a number. If
   * this ever passes the game, the arithmetic has stopped mattering and the
   * design has regressed — fix the game, never the test.
   */
  it('cannot be played blind: shooting the lowest plane loses every heart inside ninety seconds', () => {
    for (const seed of [1, 2, 3, 5, 8]) {
      const game = createRun({ seed });
      playBlind(game, 90);
      expect(game.state.status, `seed ${seed} survived without reading a number`).toBe('over');
    }
  });

  it('cannot be sprayed: firing at everything loses every heart too', () => {
    const game = createRun({ seed: 4 });
    for (let t = 0; t < 90; t += FRAME) {
      game.aim((t * 0.37) % 1);
      game.fire();
      game.step(FRAME);
    }
    expect(game.state.status).toBe('over');
  });
});
```

- [ ] **Step 2: Run the invariants**

Run: `npx vitest run games/sky/src/logic/invariants.test.ts`
Expected: PASS. These are slow (several simulated hours); a few seconds of wall clock is normal.

When one fails, the failure is in the game, not in the test. Likely causes and their fixes:

| Failure | Where to look |
| --- | --- |
| Nothing aloft answers the sum | `ask` in `run.ts` set a sum without a target, or the target was removed without clearing `state.sum` |
| No trap for a sum | `nextNumber` is drawing freely while `hasTrap` is false — check the `sum &&` guard |
| Asked about a plane without its window | `chooseTarget` is being handed a stale `thinkSeconds`; `state.tempo` must be recomputed before `ask` |
| **Playing blind survives** | The target is too predictable. Flatten the weighting in `chooseTarget` (try `1 / (index + 1.5)`) or raise `ESCORT_CHANCE`. Do not weaken the test |
| Playing well loses a heart | `thinkSeconds` is too tight against `BULLET_SECONDS`, or the bot's aim tolerance is fighting a weaver's sway. Widen `thinkSeconds` in `tempo.ts` before touching the bot |

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "test(sky): the invariants, and proof the arithmetic is load-bearing

Long seeded runs assert every promise the spec makes: no unshootable number,
always an answering plane, always a fair window, always a trap.

Two bots matter most. One reads the sum and keeps all three hearts for two
minutes, so the game is winnable. One ignores the numbers and shoots whatever
is lowest, and must lose every heart inside ninety seconds. If that second
test ever passes, the maths has stopped mattering — which is exactly how
Seesaw's arcade half went wrong."
```

---
### Task 10: Screen geometry and choreography

The one place that knows how big things are on screen, and the one place that knows how long things take. Clearances are pinned by tests because they all sit close to something they must not collide with — the same reason Seesaw has `layout.test.ts`.

**Files:**
- Create: `games/sky/src/view/geometry.ts`, `games/sky/src/view/geometry.test.ts`
- Create: `games/sky/src/view/timing.ts`

**Interfaces:**
- Consumes: `DESIGN`, `Point` from `@bundle/core`; `PLANE_TYPES`, `PlaneType` from `../logic/planes.js`; `Plane`, `planeX` from `../logic/sky-state.js`.
- Produces: `SKY` (the constants), `FIELD_WIDTH: number`, `FALL_HEIGHT: number`, `skyPoint(x: number, progress: number): Point`, `planePoint(plane: Plane): Point`, `planeSize(type: PlaneType): { width: number; height: number }`, `fighterPoint(x: number): Point`, `laneAt(designX: number): number`; `TIMING` in `timing.ts`.

- [ ] **Step 1: Write the failing geometry test**

```ts
// games/sky/src/view/geometry.test.ts
import { describe, it, expect } from 'vitest';
import { DESIGN } from '@bundle/core';
import { PLANE_IDS, PLANE_TYPES } from '../logic/planes.js';
import { FIELD_WIDTH, laneAt, planeSize, skyPoint, SKY } from './geometry.js';

describe('the sky', () => {
  it('leaves the top bar clear, so a plane never flies through the hearts', () => {
    expect(SKY.spawnY).toBeGreaterThan(SKY.hudY + 30);
  });

  it('gives the fighter room below the escape line', () => {
    expect(SKY.escapeY).toBeLessThan(SKY.fighterY - 40);
    expect(SKY.fighterY).toBeLessThan(DESIGN.height);
  });

  it('keeps the widest plane on screen at either edge of its lane', () => {
    const blimp = planeSize(PLANE_TYPES.blimp);
    const left = skyPoint(PLANE_TYPES.blimp.halfWidth, 0).x - blimp.width / 2;
    const right = skyPoint(1 - PLANE_TYPES.blimp.halfWidth, 0).x + blimp.width / 2;
    expect(left).toBeGreaterThanOrEqual(0);
    expect(right).toBeLessThanOrEqual(DESIGN.width);
  });

  it('draws every plane big enough for its number to be read', () => {
    for (const id of PLANE_IDS) {
      const size = planeSize(PLANE_TYPES[id]);
      expect(size.width).toBeGreaterThan(70);
      expect(size.height).toBeGreaterThan(30);
    }
  });

  it('maps the playfield onto the screen and back again', () => {
    expect(laneAt(skyPoint(0.25, 0).x)).toBeCloseTo(0.25, 5);
    expect(skyPoint(0, 0).x).toBe(SKY.fieldLeft);
    expect(skyPoint(1, 0).x).toBeCloseTo(SKY.fieldLeft + FIELD_WIDTH, 5);
    expect(skyPoint(0.5, 1).y).toBe(SKY.escapeY);
  });

  it('clamps a tap outside the playfield to its edge', () => {
    expect(laneAt(-500)).toBe(0);
    expect(laneAt(DESIGN.width + 500)).toBe(1);
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run games/sky/src/view/geometry.test.ts`
Expected: FAIL — cannot resolve `./geometry.js`.

- [ ] **Step 3: Write the geometry**

```ts
// games/sky/src/view/geometry.ts
import { DESIGN, type Point } from '@bundle/core';
import { PLANE_TYPES, type PlaneType } from '../logic/planes.js';
import { planeX, type Plane } from '../logic/sky-state.js';

/**
 * Where everything sits, in design coordinates. The playfield is inset from the
 * screen so a blimp at the far edge of its lane still has both wings on screen,
 * and the escape line sits well above the fighter so a plane that gets away is
 * seen to get away rather than vanishing behind the guns.
 */
export const SKY = {
  /** The top bar: hearts on the left, score on the right. */
  hudY: 46,
  /** Where planes enter, clear of the top bar. */
  spawnY: 128,
  /** Where a plane counts as having got away. */
  escapeY: 616,
  /** The fighter's altitude. */
  fighterY: 700,
  /** The sides of the playfield. */
  fieldLeft: 84,
  fieldRight: DESIGN.width - 84,
  /** How big the fighter is drawn. */
  fighterWidth: 96,
  fighterHeight: 74,
  /** The shell. */
  bulletWidth: 7,
  bulletLength: 26,
} as const;

export const FIELD_WIDTH = SKY.fieldRight - SKY.fieldLeft;
export const FALL_HEIGHT = SKY.escapeY - SKY.spawnY;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/** A point in the playfield, from its normalised place. */
export const skyPoint = (x: number, progress: number): Point => ({
  x: SKY.fieldLeft + x * FIELD_WIDTH,
  y: SKY.spawnY + progress * FALL_HEIGHT,
});

export const planePoint = (plane: Plane): Point => skyPoint(planeX(plane), plane.progress);

/**
 * How big a plane is drawn — derived from the hit box in its catalog entry
 * rather than kept separately, so what a child aims at is exactly what the
 * shell collides with.
 */
export const planeSize = (type: PlaneType): { width: number; height: number } => ({
  width: type.halfWidth * 2 * FIELD_WIDTH,
  height: type.halfHeight * 2 * FALL_HEIGHT,
});

export const fighterPoint = (x: number): Point => ({ x: SKY.fieldLeft + x * FIELD_WIDTH, y: SKY.fighterY });

/** Where a shell is, from the run's normalised bullet position. */
export const bulletPoint = (x: number, y: number): Point => ({
  x: SKY.fieldLeft + x * FIELD_WIDTH,
  y: SKY.spawnY + y * FALL_HEIGHT,
});

/** Turns a tap's design x into the fighter's lane. */
export const laneAt = (designX: number): number => clamp01((designX - SKY.fieldLeft) / FIELD_WIDTH);

/** The biggest plane in the game, for the clearance tests. */
export const WIDEST_PLANE = PLANE_TYPES.blimp;
```

- [ ] **Step 4: Run the geometry test**

Run: `npx vitest run games/sky/src/view/geometry.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the choreography**

```ts
// games/sky/src/view/timing.ts
/**
 * How the game feels, in one place. Retuning the choreography should never mean
 * hunting through the renderer, and swapping the art should never mean retuning
 * the choreography.
 */
export const TIMING = {
  /** How fast the fighter follows the finger. Higher is snappier. */
  fighterStiffness: 420,
  /** How long an explosion lasts. */
  boomSeconds: 0.55,
  /**
   * How long the solved sum hangs in the air where the plane was. This is the
   * actual teaching beat — the child's confirmation they were right — so it is
   * longer than the explosion it follows.
   */
  solvedSeconds: 1.1,
  /** How long the barrel glows after a shell hits the wrong plane. */
  jamGlowSeconds: 0.9,
  /** How long a heart shows its crack. */
  heartCrackSeconds: 0.9,
  /** How long a band's name is shown large before it flies into the top bar. */
  bandAnnounceSeconds: 2.1,
  /** The share of that spent flying up to the bar. */
  bandSettleFraction: 0.26,
  /** Beat before the summary card appears, so the last heart is seen to go. */
  summaryDelaySeconds: 1.2,
} as const;
```

- [ ] **Step 6: Run the suite and the typechecker**

Run: `npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(sky): screen geometry and choreography

A plane's drawn size comes from the hit box in its catalog entry, so what a
child aims at is exactly what the shell collides with. The clearances that
keep a blimp on screen and the escape line clear of the fighter are pinned by
tests, because both sit close to something they must not touch."
```

---

### Task 11: Drawing the planes, the fighter and the shells

Vector art only. There are no sprites for this game yet, and a theme seam with one implementation would be a seam for its own sake — so the art is drawn directly and swapping it later is a change to this one file.

**Files:**
- Create: `games/sky/src/view/plane-art.ts`, `games/sky/src/view/plane-art.test.ts`

**Interfaces:**
- Consumes: `hand`, `depthOf`, `recordingContext` from `@bundle/core`; `PLANE_TYPES` from `../logic/planes.js`; `Plane` from `../logic/sky-state.js`; `planePoint`, `planeSize`, `fighterPoint`, `bulletPoint`, `SKY` from `./geometry.js`.
- Produces: `drawPlane(ctx: CanvasRenderingContext2D, plane: Plane): void`, `drawFighter(ctx: CanvasRenderingContext2D, x: number, options: { jammed: boolean; sum: string }): void`, `drawBullet(ctx: CanvasRenderingContext2D, x: number, y: number): void`, `drawBoom(ctx: CanvasRenderingContext2D, at: Point, progress: number): void`.

- [ ] **Step 1: Write the failing test**

```ts
// games/sky/src/view/plane-art.test.ts
import { describe, it, expect } from 'vitest';
import { depthOf, recordingContext } from '@bundle/core';
import { PLANE_IDS, type PlaneTypeId } from '../logic/planes.js';
import { drawBoom, drawBullet, drawFighter, drawPlane } from './plane-art.js';
import type { Plane } from '../logic/sky-state.js';

const plane = (type: PlaneTypeId, overrides: Partial<Plane> = {}): Plane => ({
  uid: 'p',
  number: 15,
  type,
  progress: 0.4,
  fallSeconds: 10,
  lane: 0.5,
  phase: 0,
  age: 0,
  hits: 0,
  hidden: false,
  hideTimer: 0,
  ...overrides,
});

describe('drawing a plane', () => {
  it('writes its number on it, and balances every save with a restore', () => {
    for (const id of PLANE_IDS) {
      const { ctx, texts } = recordingContext();
      drawPlane(ctx, plane(id));
      expect(texts).toContain('15');
      expect(depthOf(ctx)).toBe(0);
    }
  });

  it('hides the number of a plane behind cloud, but still draws the plane', () => {
    const { ctx, texts, calls } = recordingContext();
    drawPlane(ctx, plane('hider', { hidden: true }));
    expect(texts).not.toContain('15');
    expect(calls).toContain('fill');
    expect(depthOf(ctx)).toBe(0);
  });

  it('shows a blimp wearing its damage', () => {
    const fresh = recordingContext();
    drawPlane(fresh.ctx, plane('blimp'));
    const hurt = recordingContext();
    drawPlane(hurt.ctx, plane('blimp', { hits: 2 }));
    expect(hurt.calls.length).toBeGreaterThan(fresh.calls.length);
    expect(depthOf(hurt.ctx)).toBe(0);
  });
});

describe('drawing the fighter', () => {
  it('carries the sum on its fuselage', () => {
    const { ctx, texts } = recordingContext();
    drawFighter(ctx, 0.5, { jammed: false, sum: '7 + 8' });
    expect(texts).toContain('7 + 8');
    expect(depthOf(ctx)).toBe(0);
  });

  it('looks different when the gun is jammed', () => {
    const cool = recordingContext();
    drawFighter(cool.ctx, 0.5, { jammed: false, sum: '7 + 8' });
    const hot = recordingContext();
    drawFighter(hot.ctx, 0.5, { jammed: true, sum: '7 + 8' });
    expect(hot.calls.length).toBeGreaterThan(cool.calls.length);
  });
});

describe('drawing shells and explosions', () => {
  it('draws without leaving the context saved', () => {
    const { ctx, calls } = recordingContext();
    drawBullet(ctx, 0.5, 0.8);
    drawBoom(ctx, { x: 400, y: 300 }, 0.5);
    expect(calls).toContain('fill');
    expect(depthOf(ctx)).toBe(0);
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run games/sky/src/view/plane-art.test.ts`
Expected: FAIL — cannot resolve `./plane-art.js`.

- [ ] **Step 3: Write the art**

```ts
// games/sky/src/view/plane-art.ts
import { hand, type Point } from '@bundle/core';
import { PLANE_TYPES } from '../logic/planes.js';
import type { Plane } from '../logic/sky-state.js';
import { bulletPoint, fighterPoint, planePoint, planeSize, SKY } from './geometry.js';

/** One palette per type, so a scout is known by its colour before its number. */
const PALETTE: Record<string, { body: string; wing: string; trim: string }> = {
  glider: { body: '#e8eef5', wing: '#b9c8d8', trim: '#41628a' },
  weaver: { body: '#f6dc8a', wing: '#d9b551', trim: '#8a6a1f' },
  blimp: { body: '#cfd8e0', wing: '#aab7c4', trim: '#4a5a6a' },
  scout: { body: '#f2a0a0', wing: '#d06a6a', trim: '#7d2f2f' },
  hider: { body: '#cbbce8', wing: '#a793d1', trim: '#54407f' },
};

/** The number on a plane has to read at a glance from across a room. */
const numberOn = (ctx: CanvasRenderingContext2D, text: string, at: Point, size: number): void => {
  ctx.font = hand(700, size);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // A pale rim under the letters keeps them legible against any fuselage.
  ctx.lineWidth = Math.max(3, size * 0.16);
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.strokeText(text, at.x, at.y);
  ctx.fillStyle = '#1e2a38';
  ctx.fillText(text, at.x, at.y);
};

export function drawPlane(ctx: CanvasRenderingContext2D, plane: Plane): void {
  const type = PLANE_TYPES[plane.type];
  const { width, height } = planeSize(type);
  const at = planePoint(plane);
  const skin = PALETTE[plane.type] ?? PALETTE.glider!;

  ctx.save();
  ctx.translate(at.x, at.y);

  if (plane.type === 'blimp') {
    // A fat envelope with a gondola: unmistakably the slow one.
    ctx.fillStyle = skin.body;
    ctx.beginPath();
    ctx.ellipse(0, 0, width / 2, height / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = skin.trim;
    ctx.fillRect(-width * 0.12, height * 0.38, width * 0.24, height * 0.2);
    // Damage: a dent per hit taken, so committing to an answer is visible.
    for (let i = 0; i < plane.hits; i += 1) {
      ctx.fillStyle = 'rgba(60,40,30,0.5)';
      ctx.beginPath();
      ctx.arc(-width * 0.2 + i * width * 0.2, -height * 0.1, height * 0.12, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    // Wings, then a fuselage, then a tail: a paper-aeroplane silhouette, nose down.
    ctx.fillStyle = skin.wing;
    ctx.beginPath();
    ctx.moveTo(-width / 2, 0);
    ctx.lineTo(width / 2, 0);
    ctx.lineTo(width * 0.22, height * 0.3);
    ctx.lineTo(-width * 0.22, height * 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = skin.body;
    ctx.beginPath();
    ctx.ellipse(0, 0, width * 0.26, height * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = skin.trim;
    ctx.beginPath();
    ctx.moveTo(-width * 0.1, -height * 0.45);
    ctx.lineTo(width * 0.1, -height * 0.45);
    ctx.lineTo(0, -height * 0.8);
    ctx.closePath();
    ctx.fill();
  }

  // Cloud-hiders duck behind a puff; the plane stays visible, the number does not.
  if (plane.hidden) {
    ctx.fillStyle = 'rgba(248,250,252,0.94)';
    ctx.beginPath();
    ctx.arc(-width * 0.2, 0, height * 0.5, 0, Math.PI * 2);
    ctx.arc(width * 0.2, 0, height * 0.55, 0, Math.PI * 2);
    ctx.arc(0, -height * 0.15, height * 0.6, 0, Math.PI * 2);
    ctx.fill();
  } else {
    numberOn(ctx, String(plane.number), { x: 0, y: 0 }, height * 0.62);
  }

  ctx.restore();
}

export function drawFighter(
  ctx: CanvasRenderingContext2D,
  x: number,
  options: { jammed: boolean; sum: string },
): void {
  const at = fighterPoint(x);
  ctx.save();
  ctx.translate(at.x, at.y);

  ctx.fillStyle = '#2f6f9f';
  ctx.beginPath();
  ctx.moveTo(0, -SKY.fighterHeight * 0.5);
  ctx.lineTo(SKY.fighterWidth * 0.5, SKY.fighterHeight * 0.4);
  ctx.lineTo(-SKY.fighterWidth * 0.5, SKY.fighterHeight * 0.4);
  ctx.closePath();
  ctx.fill();

  // The gun. Red hot while the shell that hit the wrong plane is paid for.
  ctx.fillStyle = options.jammed ? '#e8543f' : '#cfd8e0';
  ctx.fillRect(-SKY.bulletWidth, -SKY.fighterHeight * 0.72, SKY.bulletWidth * 2, SKY.fighterHeight * 0.3);
  if (options.jammed) {
    ctx.fillStyle = 'rgba(232,84,63,0.35)';
    ctx.beginPath();
    ctx.arc(0, -SKY.fighterHeight * 0.66, SKY.fighterHeight * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  // The question rides on the fuselage, where the player's eye already is.
  numberOn(ctx, options.sum, { x: 0, y: SKY.fighterHeight * 0.12 }, 34);
  ctx.restore();
}

export function drawBullet(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  const at = bulletPoint(x, y);
  ctx.save();
  ctx.fillStyle = '#ffd166';
  ctx.beginPath();
  ctx.ellipse(at.x, at.y, SKY.bulletWidth / 2, SKY.bulletLength / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** A puff of smoke and sparks, fading over its life. `progress` runs 0 to 1. */
export function drawBoom(ctx: CanvasRenderingContext2D, at: Point, progress: number): void {
  const fade = 1 - progress;
  const radius = 20 + progress * 58;
  ctx.save();
  ctx.globalAlpha = Math.max(0, fade);
  ctx.fillStyle = '#ffb703';
  ctx.beginPath();
  ctx.arc(at.x, at.y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(90,90,100,0.55)';
  ctx.beginPath();
  ctx.arc(at.x, at.y, radius * 0.65, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
```

- [ ] **Step 4: Run the test and the typechecker**

Run: `npx vitest run games/sky/src/view/plane-art.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(sky): vector art for the planes, the fighter and the shells

Each type is known by its colour before its number is read, a blimp wears the
hits it has taken, and a cloud-hider keeps its plane visible while its number
goes. The sum rides on the fighter's fuselage, where the eye already is."
```

---
### Task 12: The top bar, the band banner and the summary card

**Files:**
- Create: `games/sky/src/view/hud.ts`, `games/sky/src/view/hud.test.ts`

**Interfaces:**
- Consumes: `hand`, `DESIGN`, `Bounds` from `@bundle/core`; `SKY` from `./geometry.js`; `TIMING` from `./timing.js`.
- Produces: `drawHud(ctx, model: HudModel): void`, `interface HudModel { hearts: number; score: number; streak: number; crack: number }`, `drawBanner(ctx, title: string, progress: number): void`, `drawSolved(ctx, at: Point, text: string, progress: number): void`, `drawSummary(ctx, summary: Summary): void`, `interface Summary { score: number; bestStreak: number; seconds: number; best: number; beatenBest: boolean }`.

- [ ] **Step 1: Write the failing test**

```ts
// games/sky/src/view/hud.test.ts
import { describe, it, expect } from 'vitest';
import { depthOf, recordingContext } from '@bundle/core';
import { drawBanner, drawHud, drawSolved, drawSummary } from './hud.js';

describe('the top bar', () => {
  it('shows one heart per heart left and the score', () => {
    const { ctx, texts, calls } = recordingContext();
    drawHud(ctx, { hearts: 2, score: 17, streak: 4, crack: 0 });
    expect(texts).toContain('17');
    // Two full hearts and one spent, so three heart shapes in all.
    expect(calls.filter((call) => call === 'bezierCurveTo').length).toBeGreaterThanOrEqual(6);
    expect(depthOf(ctx)).toBe(0);
  });

  it('shows a streak only once it is worth showing', () => {
    const quiet = recordingContext();
    drawHud(quiet.ctx, { hearts: 3, score: 3, streak: 1, crack: 0 });
    expect(quiet.texts.some((text) => text.includes('3 in a row'))).toBe(false);
    const hot = recordingContext();
    drawHud(hot.ctx, { hearts: 3, score: 9, streak: 3, crack: 0 });
    expect(hot.texts.some((text) => text.includes('3 in a row'))).toBe(true);
  });

  it('draws without leaving the context saved, whatever the state', () => {
    for (const hearts of [0, 1, 3]) {
      const { ctx } = recordingContext();
      drawHud(ctx, { hearts, score: 0, streak: 0, crack: 0.5 });
      expect(depthOf(ctx)).toBe(0);
    }
  });
});

describe('the band banner', () => {
  it('writes the band name', () => {
    const { ctx, texts } = recordingContext();
    drawBanner(ctx, 'Take-Aways', 0.1);
    expect(texts).toContain('Take-Aways');
    expect(depthOf(ctx)).toBe(0);
  });

  it('is on its way to the top bar by the end of its life', () => {
    const early = recordingContext();
    drawBanner(early.ctx, 'Over Ten', 0.05);
    const late = recordingContext();
    drawBanner(late.ctx, 'Over Ten', 0.95);
    expect(late.translations[0]!.y).toBeLessThan(early.translations[0]!.y);
  });
});

describe('the solved sum', () => {
  it('writes the whole equation, answer and all — the teaching beat', () => {
    const { ctx, texts } = recordingContext();
    drawSolved(ctx, { x: 500, y: 300 }, '7 + 8 = 15', 0.2);
    expect(texts).toContain('7 + 8 = 15');
    expect(depthOf(ctx)).toBe(0);
  });
});

describe('the summary card', () => {
  it('reads as how far you flew, not as a failure', () => {
    const { ctx, texts } = recordingContext();
    drawSummary(ctx, { score: 24, bestStreak: 9, seconds: 132, best: 20, beatenBest: true });
    const all = texts.join(' ');
    expect(all).toContain('24');
    expect(all).toContain('9');
    expect(all.toLowerCase()).not.toContain('fail');
    expect(all.toLowerCase()).toContain('best');
    expect(depthOf(ctx)).toBe(0);
  });

  it('tells the player how to go again', () => {
    const { ctx, texts } = recordingContext();
    drawSummary(ctx, { score: 4, bestStreak: 2, seconds: 30, best: 20, beatenBest: false });
    expect(texts.join(' ').toLowerCase()).toContain('tap');
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run games/sky/src/view/hud.test.ts`
Expected: FAIL — cannot resolve `./hud.js`.

- [ ] **Step 3: Write the HUD**

```ts
// games/sky/src/view/hud.ts
import { DESIGN, hand, type Point } from '@bundle/core';
import { HEARTS } from '../logic/run.js';
import { SKY } from './geometry.js';
import { TIMING } from './timing.js';

export interface HudModel {
  hearts: number;
  score: number;
  streak: number;
  /** 0..1 through the crack animation, just after a heart is lost. */
  crack: number;
}

const heart = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number, filled: boolean): void => {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.moveTo(0, size * 0.3);
  ctx.bezierCurveTo(size * 0.6, -size * 0.35, size * 0.5, size * 0.55, 0, size);
  ctx.bezierCurveTo(-size * 0.5, size * 0.55, -size * 0.6, -size * 0.35, 0, size * 0.3);
  ctx.closePath();
  if (filled) {
    ctx.fillStyle = '#e8543f';
    ctx.fill();
  } else {
    // A spent heart stays on the bar as an outline, so a child can see what
    // they have left and what they have already used.
    ctx.strokeStyle = 'rgba(30,42,56,0.35)';
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  ctx.restore();
};

const label = (ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, align: CanvasTextAlign): void => {
  ctx.font = hand(700, size);
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.lineWidth = Math.max(3, size * 0.18);
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = '#1e2a38';
  ctx.fillText(text, x, y);
};

export function drawHud(ctx: CanvasRenderingContext2D, model: HudModel): void {
  ctx.save();
  const size = 24;
  for (let i = 0; i < HEARTS; i += 1) {
    const filled = i < model.hearts;
    // The heart just lost shakes as it empties, so the loss is felt as well as seen.
    const shake = !filled && i === model.hearts && model.crack > 0 ? Math.sin(model.crack * 40) * 3 : 0;
    heart(ctx, SKY.fieldLeft + i * (size * 1.9) + shake, SKY.hudY - size / 2, size, filled);
  }

  label(ctx, String(model.score), DESIGN.width - SKY.fieldLeft, SKY.hudY, 40, 'right');
  // A streak is worth naming only once it is a streak.
  if (model.streak >= 3) {
    label(ctx, `${model.streak} in a row!`, DESIGN.width / 2, SKY.hudY, 26, 'center');
  }
  ctx.restore();
}

/**
 * A band announcing itself: large in the middle, then away to the top bar, so a
 * change in the rules is seen arriving rather than discovered. The same grammar
 * Seesaw's chapters use, because a child who has played that one already knows
 * what a banner means.
 */
export function drawBanner(ctx: CanvasRenderingContext2D, title: string, progress: number): void {
  const settle = Math.max(0, (progress - (1 - TIMING.bandSettleFraction)) / TIMING.bandSettleFraction);
  const y = DESIGN.height * 0.38 + (SKY.hudY - DESIGN.height * 0.38) * settle;
  const scale = 1 - 0.55 * settle;
  ctx.save();
  ctx.translate(DESIGN.width / 2, y);
  ctx.scale(scale, scale);
  ctx.globalAlpha = progress > 0.92 ? (1 - progress) / 0.08 : 1;
  label(ctx, title, 0, 0, 76, 'center');
  ctx.restore();
}

/**
 * The solved sum, hanging where the plane was. This is the teaching beat: the
 * child sees the whole equation finished, which is their confirmation that they
 * were right — so it is written in full, answer included.
 */
export function drawSolved(ctx: CanvasRenderingContext2D, at: Point, text: string, progress: number): void {
  ctx.save();
  ctx.globalAlpha = Math.max(0, 1 - progress * progress);
  ctx.translate(at.x, at.y - progress * 46);
  label(ctx, text, 0, 0, 42, 'center');
  ctx.restore();
}

export interface Summary {
  score: number;
  bestStreak: number;
  seconds: number;
  best: number;
  beatenBest: boolean;
}

const minutes = (seconds: number): string => {
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
};

/** How far you flew, never a failure screen. */
export function drawSummary(ctx: CanvasRenderingContext2D, summary: Summary): void {
  const width = 640;
  const height = 380;
  const left = (DESIGN.width - width) / 2;
  const top = (DESIGN.height - height) / 2;

  ctx.save();
  ctx.fillStyle = 'rgba(12,24,38,0.55)';
  ctx.fillRect(0, 0, DESIGN.width, DESIGN.height);
  ctx.fillStyle = '#f7fbff';
  ctx.beginPath();
  ctx.roundRect?.(left, top, width, height, 28);
  ctx.fill();

  label(ctx, summary.beatenBest ? 'A new best!' : 'Good flying!', DESIGN.width / 2, top + 66, 52, 'center');
  label(ctx, `Planes down   ${summary.score}`, DESIGN.width / 2, top + 150, 34, 'center');
  label(ctx, `Longest streak   ${summary.bestStreak}`, DESIGN.width / 2, top + 198, 34, 'center');
  label(ctx, `Time flown   ${minutes(summary.seconds)}`, DESIGN.width / 2, top + 246, 34, 'center');
  label(ctx, `Best so far   ${summary.best}`, DESIGN.width / 2, top + 294, 28, 'center');
  label(ctx, 'Tap to fly again', DESIGN.width / 2, top + height - 34, 30, 'center');
  ctx.restore();
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run games/sky/src/view/hud.test.ts`
Expected: PASS. Note `roundRect` is called with `?.` — the recording context has it, and Safari 16.4+ has it, but an older iPad would silently skip the card's background rather than throw. If the card must have a background everywhere, replace it with four `arcTo` corners.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(sky): the top bar, the band banner and the summary card

Spent hearts stay on the bar as outlines so a child can see what they have
left. The solved sum is written out in full where the plane was, because that
beat is the actual teaching. The card says how far you flew rather than that
you failed."
```

---

### Task 13: The scene

The one thing that turns a `RunState` into a frame. It owns the fighter's easing, the explosions, the solved sums hanging in the air, and the banner's clock — everything that is presentation and must never reach the rules.

**Files:**
- Create: `games/sky/src/view/scene.ts`, `games/sky/src/view/scene.test.ts`

**Interfaces:**
- Consumes: `createSpring`, `fitToScreen`, `visibleBounds`, `DESIGN`, `Point`, `Size` from `@bundle/core`; `RunState`, `RunEvent` from `../logic/run.js`; the art and HUD from Tasks 11–12; `TIMING`, `SKY`, `planePoint`, `laneAt`.
- Produces: `interface SceneModel { run: RunState; sumText: string; summary: Summary | null }`, `interface Scene { update(dt: number, model: SceneModel): void; observe(events: readonly RunEvent[]): void; render(ctx: CanvasRenderingContext2D, screen: Size): void; toDesign(point: Point, screen: Size): Point; readonly fighterX: number }`, `createScene(): Scene`.

- [ ] **Step 1: Write the failing test**

```ts
// games/sky/src/view/scene.test.ts
import { describe, it, expect } from 'vitest';
import { depthOf, recordingContext, DESIGN } from '@bundle/core';
import { createRun } from '../logic/run.js';
import { createScene, type SceneModel } from './scene.js';
import { sumText } from '../logic/equation.js';

const FRAME = 1 / 60;

const modelOf = (game: ReturnType<typeof createRun>, overrides: Partial<SceneModel> = {}): SceneModel => ({
  run: game.state,
  sumText: game.state.sum ? sumText(game.state.sum) : '',
  summary: null,
  ...overrides,
});

describe('the scene', () => {
  it('draws a full sky without leaving the context saved', () => {
    const game = createRun({ seed: 1 });
    for (let i = 0; i < 120; i += 1) game.step(FRAME);
    const scene = createScene();
    scene.update(FRAME, modelOf(game));
    const { ctx, texts } = recordingContext();
    scene.render(ctx, { width: 1152, height: 768 });
    expect(depthOf(ctx)).toBe(0);
    // Every plane's number is on screen, and so is the question.
    for (const plane of game.state.aloft.filter((entry) => !entry.hidden)) {
      expect(texts).toContain(String(plane.number));
    }
    expect(texts).toContain(sumText(game.state.sum!));
  });

  it('eases the fighter towards where the finger is, never teleporting', () => {
    const game = createRun({ seed: 2 });
    game.aim(1);
    const scene = createScene();
    scene.update(FRAME, modelOf(game));
    const firstStep = scene.fighterX;
    expect(firstStep).toBeGreaterThan(0.5);
    expect(firstStep).toBeLessThan(1);
    for (let i = 0; i < 120; i += 1) scene.update(FRAME, modelOf(game));
    expect(scene.fighterX).toBeCloseTo(1, 2);
  });

  it('shows the solved sum where the plane was, then lets it go', () => {
    const game = createRun({ seed: 3 });
    game.step(FRAME);
    const target = game.state.aloft.find((plane) => plane.uid === game.state.targetUid)!;
    const scene = createScene();
    scene.observe([{ type: 'destroyed', plane: target, sum: game.state.sum! }]);
    scene.update(FRAME, modelOf(game));
    const during = recordingContext();
    scene.render(during.ctx, { width: 1152, height: 768 });
    expect(during.texts.some((text) => text.includes('='))).toBe(true);

    for (let i = 0; i < 180; i += 1) scene.update(FRAME, modelOf(game));
    const after = recordingContext();
    scene.render(after.ctx, { width: 1152, height: 768 });
    expect(after.texts.some((text) => text.includes('='))).toBe(false);
  });

  it('announces a band and then puts the banner away', () => {
    const game = createRun({ seed: 4 });
    const scene = createScene();
    scene.observe([{ type: 'band', band: { id: 'over-ten', title: 'Over Ten', from: 45, answers: { from: 11, to: 20 }, easyMix: 0.3, addMix: 1 } }]);
    scene.update(FRAME, modelOf(game));
    const during = recordingContext();
    scene.render(during.ctx, { width: 1152, height: 768 });
    expect(during.texts).toContain('Over Ten');

    for (let i = 0; i < 300; i += 1) scene.update(FRAME, modelOf(game));
    const after = recordingContext();
    scene.render(after.ctx, { width: 1152, height: 768 });
    expect(after.texts).not.toContain('Over Ten');
  });

  it('paints scenery past the design rect, so an odd-shaped screen has no bars', () => {
    const scene = createScene();
    const game = createRun({ seed: 5 });
    scene.update(FRAME, modelOf(game));
    const { ctx, calls } = recordingContext();
    scene.render(ctx, { width: 2600, height: 1200 });
    expect(calls).toContain('fillRect');
    expect(depthOf(ctx)).toBe(0);
  });

  it('round-trips a screen point into the design space', () => {
    const scene = createScene();
    const screen = { width: 2304, height: 1536 };
    const point = scene.toDesign({ x: 1152, y: 768 }, screen);
    expect(point.x).toBeCloseTo(DESIGN.width / 2, 5);
    expect(point.y).toBeCloseTo(DESIGN.height / 2, 5);
  });

  it('covers the sky with the summary card when the run is over', () => {
    const game = createRun({ seed: 6 });
    const scene = createScene();
    scene.update(FRAME, modelOf(game, { summary: { score: 12, bestStreak: 5, seconds: 88, best: 12, beatenBest: true } }));
    const { ctx, texts } = recordingContext();
    scene.render(ctx, { width: 1152, height: 768 });
    expect(texts.join(' ')).toContain('12');
    expect(texts.join(' ').toLowerCase()).toContain('tap');
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run games/sky/src/view/scene.test.ts`
Expected: FAIL — cannot resolve `./scene.js`.

- [ ] **Step 3: Write the scene**

```ts
// games/sky/src/view/scene.ts
import { createSpring, DESIGN, fitToScreen, visibleBounds, type Point, type Size } from '@bundle/core';
import { sumText } from '../logic/equation.js';
import type { RunEvent, RunState } from '../logic/run.js';
import { drawBoom, drawBullet, drawFighter, drawPlane } from './plane-art.js';
import { drawBanner, drawHud, drawSolved, drawSummary, type Summary } from './hud.js';
import { planePoint, SKY } from './geometry.js';
import { TIMING } from './timing.js';

export interface SceneModel {
  run: RunState;
  /** The question, already written out, so the scene never does arithmetic. */
  sumText: string;
  /** Set once the run is over. */
  summary: Summary | null;
}

interface Boom {
  at: Point;
  life: number;
}

interface Solved {
  at: Point;
  text: string;
  life: number;
}

export interface Scene {
  update(dt: number, model: SceneModel): void;
  /** What just happened, so the scene can react to it. State stays the run's. */
  observe(events: readonly RunEvent[]): void;
  render(ctx: CanvasRenderingContext2D, screen: Size): void;
  toDesign(point: Point, screen: Size): Point;
  readonly fighterX: number;
}

/** Drifting cloud, drawn from a fixed set so the sky is never a blank wash. */
const CLOUDS: readonly { x: number; y: number; r: number; speed: number }[] = [
  { x: 0.15, y: 0.2, r: 80, speed: 0.012 },
  { x: 0.55, y: 0.12, r: 110, speed: 0.008 },
  { x: 0.8, y: 0.3, r: 70, speed: 0.016 },
  { x: 0.35, y: 0.45, r: 95, speed: 0.01 },
];

export function createScene(): Scene {
  // The fighter eases rather than snapping, so a finger dragged across the glass
  // reads as flying rather than as teleporting.
  const fighter = createSpring(0.5, { stiffness: TIMING.fighterStiffness });
  const booms: Boom[] = [];
  const solved: Solved[] = [];
  let banner: { title: string; life: number } | null = null;
  let crack = 0;
  let drift = 0;
  let model: SceneModel | null = null;

  const scene: Scene = {
    get fighterX() {
      return fighter.value;
    },

    observe(events) {
      for (const event of events) {
        switch (event.type) {
          case 'destroyed':
            booms.push({ at: planePoint(event.plane), life: 0 });
            // The whole equation, finished. The child's confirmation.
            solved.push({ at: planePoint(event.plane), text: `${sumText(event.sum)} = ${event.sum.answer}`, life: 0 });
            break;
          case 'damaged':
            booms.push({ at: planePoint(event.plane), life: TIMING.boomSeconds * 0.6 });
            break;
          case 'escaped':
            crack = TIMING.heartCrackSeconds;
            break;
          case 'band':
            banner = { title: event.band.title, life: 0 };
            break;
          default:
            break;
        }
      }
    },

    update(dt, next) {
      model = next;
      drift += dt;
      fighter.target = next.run.fighterX;
      fighter.step(dt);

      for (const boom of booms) boom.life += dt;
      while (booms.length > 0 && booms[0]!.life > TIMING.boomSeconds) booms.shift();
      for (const entry of solved) entry.life += dt;
      while (solved.length > 0 && solved[0]!.life > TIMING.solvedSeconds) solved.shift();
      if (crack > 0) crack = Math.max(0, crack - dt);
      if (banner) {
        banner.life += dt;
        if (banner.life > TIMING.bandAnnounceSeconds) banner = null;
      }
    },

    render(ctx, screen) {
      const current = model;
      if (!current) return;
      const transform = fitToScreen(screen);
      const bounds = visibleBounds(screen, transform);

      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.translate(transform.offsetX, transform.offsetY);
      ctx.scale(transform.scale, transform.scale);

      // Sky and cloud are painted across everything visible, so a screen of a
      // different shape is filled with sky rather than letterboxed.
      const gradient = ctx.createLinearGradient(0, bounds.top, 0, bounds.bottom);
      gradient.addColorStop(0, '#9fd2f2');
      gradient.addColorStop(1, '#dff0fb');
      ctx.fillStyle = gradient;
      ctx.fillRect(bounds.left, bounds.top, bounds.right - bounds.left, bounds.bottom - bounds.top);

      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      for (const cloud of CLOUDS) {
        const x = ((cloud.x + drift * cloud.speed) % 1.2) * DESIGN.width - DESIGN.width * 0.1;
        ctx.beginPath();
        ctx.arc(x, cloud.y * DESIGN.height, cloud.r, 0, Math.PI * 2);
        ctx.arc(x + cloud.r * 0.8, cloud.y * DESIGN.height + cloud.r * 0.2, cloud.r * 0.7, 0, Math.PI * 2);
        ctx.fill();
      }

      for (const plane of current.run.aloft) drawPlane(ctx, plane);
      for (const bullet of current.run.bullets) drawBullet(ctx, bullet.x, bullet.y);
      for (const boom of booms) drawBoom(ctx, boom.at, boom.life / TIMING.boomSeconds);
      for (const entry of solved) drawSolved(ctx, entry.at, entry.text, entry.life / TIMING.solvedSeconds);

      drawFighter(ctx, fighter.value, { jammed: current.run.jam > 0, sum: current.sumText });

      drawHud(ctx, {
        hearts: current.run.hearts,
        score: current.run.score,
        streak: current.run.streak,
        crack: crack / TIMING.heartCrackSeconds,
      });
      if (banner) drawBanner(ctx, banner.title, banner.life / TIMING.bandAnnounceSeconds);
      if (current.summary) drawSummary(ctx, current.summary);

      ctx.restore();
    },

    toDesign(point, screen) {
      return fitToScreen(screen).toDesign(point);
    },
  };

  return scene;
}

export { SKY };
```

- [ ] **Step 4: Run the test and the typechecker**

Run: `npx vitest run games/sky/src/view/scene.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(sky): the scene

Turns a RunState into a frame and owns nothing the rules care about: the
fighter's easing, the explosions, the solved sums hanging where their planes
were, and the banner's clock. Sky is painted across everything visible, so an
odd-shaped screen is filled with sky rather than letterboxed."
```

---
### Task 14: Input — drag to move, fire on release

One rule for the touch, which is what makes it teachable to a five-year-old without a word of instruction.

**Files:**
- Create: `games/sky/src/view/input.ts`, `games/sky/src/view/input.test.ts`

**Interfaces:**
- Consumes: `DESIGN`, `Point`, `Size` from `@bundle/core`; `Scene` from `./scene.js`; `laneAt` from `./geometry.js`.
- Produces: `type InputIntent = { kind: 'aim'; lane: number } | { kind: 'fire' } | { kind: 'restart' }`, `interface InputHandle { dispose(): void }`, `createInput(canvas: HTMLCanvasElement, scene: Scene, emit: (intent: InputIntent) => void, isOver: () => boolean): InputHandle`.

- [ ] **Step 1: Write the failing test**

```ts
// games/sky/src/view/input.test.ts
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { createInput, type InputIntent } from './input.js';
import { createScene } from './scene.js';
import { createRun } from '../logic/run.js';
import { fighterPoint, laneAt, SKY } from './geometry.js';

const harness = (isOver = () => false) => {
  const canvas = document.createElement('canvas');
  // jsdom gives every element a zero-sized rect, so the scene's own mapping is
  // exercised with a 1:1 transform.
  Object.defineProperty(canvas, 'clientWidth', { value: 1152 });
  Object.defineProperty(canvas, 'clientHeight', { value: 768 });
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1152, height: 768 }) as DOMRect;
  const scene = createScene();
  const game = createRun({ seed: 1 });
  scene.update(1 / 60, { run: game.state, sumText: '', summary: null });
  const intents: InputIntent[] = [];
  const handle = createInput(canvas, scene, (intent) => intents.push(intent), isOver);
  return { canvas, intents, handle };
};

const pointer = (kind: string, x: number, y: number): PointerEvent =>
  new (globalThis as unknown as { PointerEvent: typeof PointerEvent }).PointerEvent(kind, {
    clientX: x,
    clientY: y,
    pointerId: 1,
    bubbles: true,
  });

describe('input', () => {
  it('aims where the finger goes down', () => {
    const { canvas, intents } = harness();
    canvas.dispatchEvent(pointer('pointerdown', 300, 700));
    expect(intents).toEqual([{ kind: 'aim', lane: laneAt(300) }]);
  });

  it('tracks a drag', () => {
    const { canvas, intents } = harness();
    canvas.dispatchEvent(pointer('pointerdown', 300, 700));
    canvas.dispatchEvent(pointer('pointermove', 600, 700));
    expect(intents.at(-1)).toEqual({ kind: 'aim', lane: laneAt(600) });
  });

  it('fires when the finger lifts — aim, then let go', () => {
    const { canvas, intents } = harness();
    canvas.dispatchEvent(pointer('pointerdown', 300, 700));
    canvas.dispatchEvent(pointer('pointerup', 300, 700));
    expect(intents.at(-1)).toEqual({ kind: 'fire' });
  });

  it('aims a final time before firing, so a fast drag still shoots where it ended', () => {
    const { canvas, intents } = harness();
    canvas.dispatchEvent(pointer('pointerdown', 300, 700));
    canvas.dispatchEvent(pointer('pointerup', 900, 700));
    expect(intents.at(-2)).toEqual({ kind: 'aim', lane: laneAt(900) });
    expect(intents.at(-1)).toEqual({ kind: 'fire' });
  });

  it('does not fire when a touch is cancelled', () => {
    const { canvas, intents } = harness();
    canvas.dispatchEvent(pointer('pointerdown', 300, 700));
    canvas.dispatchEvent(pointer('pointercancel', 300, 700));
    expect(intents.some((intent) => intent.kind === 'fire')).toBe(false);
  });

  it('restarts instead of firing once the run is over', () => {
    const { canvas, intents } = harness(() => true);
    canvas.dispatchEvent(pointer('pointerdown', 300, 700));
    canvas.dispatchEvent(pointer('pointerup', 300, 700));
    expect(intents).toEqual([{ kind: 'restart' }]);
  });

  it('flies with the arrow keys and fires with space, for testing on a Mac', () => {
    const { intents } = harness();
    globalThis.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    globalThis.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    expect(intents.some((intent) => intent.kind === 'aim')).toBe(true);
    expect(intents.some((intent) => intent.kind === 'fire')).toBe(true);
  });

  it('stops listening once disposed', () => {
    const { canvas, intents, handle } = harness();
    handle.dispose();
    canvas.dispatchEvent(pointer('pointerdown', 300, 700));
    globalThis.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    expect(intents).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run games/sky/src/view/input.test.ts`
Expected: FAIL — cannot resolve `./input.js`.

- [ ] **Step 3: Write the input**

```ts
// games/sky/src/view/input.ts
import { DESIGN, type Point, type Size } from '@bundle/core';
import { laneAt } from './geometry.js';
import type { Scene } from './scene.js';

export type InputIntent = { kind: 'aim'; lane: number } | { kind: 'fire' } | { kind: 'restart' };

export interface InputHandle {
  dispose(): void;
}

/** How far the arrow keys move the fighter per press. */
const KEY_STEP = 0.06;

/**
 * Drag to move, fire on release.
 *
 * One shot per touch: the finger positions the fighter and lifting it shoots.
 * Firing on touch-down would spray a shell every time the fighter was
 * repositioned, and repositioning is most of what a player does. A shell that
 * hits nothing costs nothing, so a drag that ends in a shot is harmless.
 */
export function createInput(
  canvas: HTMLCanvasElement,
  scene: Scene,
  emit: (intent: InputIntent) => void,
  isOver: () => boolean = () => false,
): InputHandle {
  let down = false;
  let keyLane = 0.5;

  const screenSize = (): Size => ({
    width: canvas.clientWidth || DESIGN.width,
    height: canvas.clientHeight || DESIGN.height,
  });

  const designPoint = (event: PointerEvent): Point => {
    const bounds = canvas.getBoundingClientRect();
    return scene.toDesign({ x: event.clientX - bounds.left, y: event.clientY - bounds.top }, screenSize());
  };

  const onPointerDown = (event: PointerEvent): void => {
    down = true;
    if (isOver()) return;
    canvas.setPointerCapture?.(event.pointerId);
    emit({ kind: 'aim', lane: laneAt(designPoint(event).x) });
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (!down || isOver()) return;
    emit({ kind: 'aim', lane: laneAt(designPoint(event).x) });
  };

  const onPointerUp = (event: PointerEvent): void => {
    if (!down) return;
    down = false;
    canvas.releasePointerCapture?.(event.pointerId);
    if (isOver()) {
      emit({ kind: 'restart' });
      return;
    }
    // Aim once more first: a fast drag should shoot from where it ended, not
    // from wherever the last move event happened to land.
    emit({ kind: 'aim', lane: laneAt(designPoint(event).x) });
    emit({ kind: 'fire' });
  };

  const onPointerCancel = (): void => {
    down = false;
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      keyLane = Math.min(1, Math.max(0, keyLane + (event.key === 'ArrowLeft' ? -KEY_STEP : KEY_STEP)));
      emit({ kind: 'aim', lane: keyLane });
      return;
    }
    if (event.key !== ' ' && event.key !== 'Enter') return;
    emit(isOver() ? { kind: 'restart' } : { kind: 'fire' });
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

- [ ] **Step 4: Run the test**

Run: `npx vitest run games/sky/src/view/input.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(sky): drag to move, fire on release

One shot per touch. Firing on touch-down would spray a shell every time the
fighter was repositioned, and repositioning is most of what a player does. A
shell that hits nothing costs nothing, so a drag ending in a shot is harmless."
```

---

### Task 15: The sound pack

Synthesised, like Seesaw's prototype pack: the same `SoundPack` interface, so recorded samples swap in later with one line.

**Files:**
- Create: `games/sky/src/audio/sky-sounds.ts`, `games/sky/src/audio/sky-sounds.test.ts`

**Interfaces:**
- Consumes: `AudioBus`, `SoundPack`, `tone`, `noiseBurst` from `@bundle/core`.
- Produces: `SOUND_EVENTS: readonly string[]`, `createSkySoundPack(bus: AudioBus): SoundPack`.

- [ ] **Step 1: Write the failing test**

```ts
// games/sky/src/audio/sky-sounds.test.ts
import { describe, it, expect } from 'vitest';
import { createAudioBus } from '@bundle/core';
import { fakeContext } from '../../../../packages/core/src/audio/fake-context.js';
import { createSkySoundPack, SOUND_EVENTS } from './sky-sounds.js';

const packOnFakes = async () => {
  const bus = createAudioBus(() => fakeContext() as unknown as AudioContext);
  await bus.unlock();
  return { bus, pack: createSkySoundPack(bus) };
};

describe('the sky sound pack', () => {
  it('has a voice for every sound the game asks for', async () => {
    const { pack } = await packOnFakes();
    for (const event of SOUND_EVENTS) expect(() => pack.play(event)).not.toThrow();
  });

  it('names the moments the design cares about', () => {
    for (const event of ['fire', 'destroy', 'damage', 'jam', 'escape', 'band', 'over']) {
      expect(SOUND_EVENTS).toContain(event);
    }
  });

  it('shrugs off an event it has never heard of', async () => {
    const { pack } = await packOnFakes();
    expect(() => pack.play('nonsense')).not.toThrow();
  });

  it('stays silent rather than throwing before the context is unlocked', () => {
    const bus = createAudioBus(() => null);
    const pack = createSkySoundPack(bus);
    expect(() => pack.play('destroy')).not.toThrow();
  });

  it('needs nothing fetched', async () => {
    const { pack } = await packOnFakes();
    await expect(pack.preload()).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run games/sky/src/audio/sky-sounds.test.ts`
Expected: FAIL — cannot resolve `./sky-sounds.js`.

- [ ] **Step 3: Write the sound pack**

```ts
// games/sky/src/audio/sky-sounds.ts
import { noiseBurst, tone, type AudioBus, type SoundPack } from '@bundle/core';

/**
 * Every sound the game can make, by name. A later pack backed by recorded
 * samples implements the same names and swaps in with one line of setup — the
 * arrangement Seesaw's animals already use.
 */
export const SOUND_EVENTS: readonly string[] = [
  'fire',
  'damage',
  'destroy',
  'jam',
  'escape',
  'heart',
  'band',
  'over',
  'best',
];

type Voice = (bus: AudioBus, delay: number) => void;

/** A shell leaving the gun: short, dry, and quiet enough to hear a hundred of. */
const fire: Voice = (bus, delay) => {
  tone(bus, { freq: 720, duration: 0.07, type: 'square', gain: 0.07, sweepTo: 420, delay });
};

/** A hit that did not finish the job. */
const damage: Voice = (bus, delay) => {
  tone(bus, { freq: 240, duration: 0.1, type: 'square', gain: 0.12, sweepTo: 180, delay });
  noiseBurst(bus, { duration: 0.08, gain: 0.05, filterHz: 900, delay });
};

/** The right answer: a bright two-note lift over a thump. This is the reward. */
const destroy: Voice = (bus, delay) => {
  noiseBurst(bus, { duration: 0.22, gain: 0.1, filterHz: 1600, sweepTo: 300, delay });
  tone(bus, { freq: 659.25, duration: 0.18, type: 'triangle', gain: 0.16, delay });
  tone(bus, { freq: 987.77, duration: 0.26, type: 'triangle', gain: 0.14, delay: delay + 0.09 });
};

/**
 * The gun overheating. A cough rather than a buzzer: the wrong plane is a
 * mistake to shrug at and try again, not a telling-off.
 */
const jam: Voice = (bus, delay) => {
  noiseBurst(bus, { duration: 0.18, gain: 0.09, filterHz: 420, sweepTo: 180, delay });
  tone(bus, { freq: 150, duration: 0.14, type: 'square', gain: 0.1, sweepTo: 96, delay: delay + 0.05 });
};

/** One got away: a low horn falling. */
const escape: Voice = (bus, delay) => {
  tone(bus, { freq: 330, duration: 0.42, type: 'sawtooth', gain: 0.12, sweepTo: 165, delay });
};

/** A heart going. */
const heart: Voice = (bus, delay) => {
  tone(bus, { freq: 196, duration: 0.3, type: 'triangle', gain: 0.14, sweepTo: 130, delay });
  noiseBurst(bus, { duration: 0.14, gain: 0.05, filterHz: 260, delay: delay + 0.04 });
};

/** A new band: three notes climbing, attention without alarm. */
const band: Voice = (bus, delay) => {
  [523.25, 659.25, 830.61].forEach((freq, index) => {
    tone(bus, { freq, duration: 0.26, type: 'triangle', gain: 0.15, delay: delay + index * 0.11 });
  });
};

/** The run ending: settling, not scolding. */
const over: Voice = (bus, delay) => {
  [587.33, 493.88, 392].forEach((freq, index) => {
    tone(bus, { freq, duration: 0.4, type: 'sine', gain: 0.14, delay: delay + index * 0.16 });
  });
};

/** A new best. */
const best: Voice = (bus, delay) => {
  [523.25, 659.25, 783.99, 1046.5].forEach((freq, index) => {
    tone(bus, { freq, duration: 0.34, type: 'triangle', gain: 0.17, delay: delay + index * 0.1 });
  });
};

const VOICES: Record<string, Voice> = { fire, damage, destroy, jam, escape, heart, band, over, best };

export function createSkySoundPack(bus: AudioBus): SoundPack {
  return {
    async preload() {
      // Synthesised on demand; nothing to fetch.
    },
    play(event, params) {
      VOICES[event]?.(bus, Math.max(0, params?.delay ?? 0));
    },
  };
}
```

- [ ] **Step 4: Run the test and the typechecker**

Run: `npx vitest run games/sky/src/audio && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(sky): the sound pack

Synthesised on demand behind the same SoundPack interface Seesaw's animals
use, so recorded samples swap in later with one line. The jam is a cough
rather than a buzzer: a wrong plane is a mistake to shrug at, not a
telling-off."
```

---
### Task 16: The driver and the game module

The driver is the seam everything around the rules talks through — scene, sound, input, the frame loop — so none of them need to know how a run is built. The module is what the shell mounts.

**Files:**
- Create: `games/sky/src/driver.ts`, `games/sky/src/driver.test.ts`
- Modify: `games/sky/src/index.ts` (replacing the stub from Task 2), `games/sky/src/index.test.ts` (adding to it)

**Interfaces:**
- Consumes: everything from Tasks 3–15; `GameHost`, `createTicker` from `@bundle/core`.
- Produces: `interface Driver { readonly state: RunState; step(dt: number): readonly RunEvent[]; aim(lane: number): void; fire(): void; restart(): void; model(): SceneModel; readonly summary: Summary | null }`, `createDriver(options: { startBand?: string; best: number }): Driver`; and on the module, `interface SkyTestHooks` reached through `session.__test`.

- [ ] **Step 1: Write the failing driver test**

```ts
// games/sky/src/driver.test.ts
import { describe, it, expect } from 'vitest';
import { createDriver } from './driver.js';

const FRAME = 1 / 60;

describe('the driver', () => {
  it('hands the scene a question already written out', () => {
    const driver = createDriver({ best: 0, seed: 1 });
    driver.step(FRAME);
    const model = driver.model();
    expect(model.sumText).toMatch(/^\d+ [+−] \d+$/);
    expect(model.summary).toBeNull();
    expect(model.run.aloft.length).toBeGreaterThan(0);
  });

  it('holds a summary once the run is over, and reports a new best', () => {
    const driver = createDriver({ best: 0, seed: 2, hearts: 1 });
    for (let i = 0; i < 60 * 60; i += 1) driver.step(FRAME);
    expect(driver.state.status).toBe('over');
    expect(driver.summary).not.toBeNull();
    expect(driver.summary!.beatenBest).toBe(driver.state.score > 0);
    expect(driver.summary!.seconds).toBeGreaterThan(0);
  });

  it('does not claim a new best when the old one stands', () => {
    const driver = createDriver({ best: 9999, seed: 3, hearts: 1 });
    for (let i = 0; i < 60 * 60; i += 1) driver.step(FRAME);
    expect(driver.summary!.beatenBest).toBe(false);
    expect(driver.summary!.best).toBe(9999);
  });

  it('starts a clean run when asked to go again', () => {
    const driver = createDriver({ best: 0, seed: 4, hearts: 1 });
    for (let i = 0; i < 60 * 60; i += 1) driver.step(FRAME);
    expect(driver.state.status).toBe('over');
    driver.restart();
    driver.step(FRAME);
    expect(driver.state.status).toBe('flying');
    expect(driver.state.score).toBe(0);
    expect(driver.state.hearts).toBe(1);
    expect(driver.summary).toBeNull();
  });

  it('opens at a band when told to', () => {
    const driver = createDriver({ best: 0, startBand: 'over-ten' });
    driver.step(FRAME);
    expect(driver.state.band.id).toBe('over-ten');
  });

  it('ignores a band id that means nothing', () => {
    const driver = createDriver({ best: 0, startBand: 'nonsense' });
    driver.step(FRAME);
    expect(driver.state.band.id).toBe('easy');
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run games/sky/src/driver.test.ts`
Expected: FAIL — cannot resolve `./driver.js`.

- [ ] **Step 3: Write the driver**

```ts
// games/sky/src/driver.ts
import { bandById, type BandId } from './logic/bands.data.js';
import { sumText } from './logic/equation.js';
import { createRun, type Run, type RunEvent, type RunState } from './logic/run.js';
import type { Summary } from './view/hud.js';
import type { SceneModel } from './view/scene.js';

export interface DriverOptions {
  /** The best score so far, for the summary card. */
  best: number;
  /** A band id from the URL. Anything unrecognised opens at the beginning. */
  startBand?: string;
  seed?: number;
  hearts?: number;
}

/**
 * Everything around the rules — scene, sound, input, the frame loop — talks to
 * the run through this, so none of them need to know how a run is built or when
 * a new one begins.
 */
export interface Driver {
  readonly state: RunState;
  step(dt: number): readonly RunEvent[];
  aim(lane: number): void;
  fire(): void;
  restart(): void;
  model(): SceneModel;
  readonly summary: Summary | null;
}

export function createDriver(options: DriverOptions): Driver {
  const asBand = (id: string | undefined): BandId | undefined => {
    const band = id ? bandById(id) : undefined;
    return band?.id;
  };

  const start = (): Run =>
    createRun({
      seed: options.seed ?? Math.floor(Date.now() % 100000),
      hearts: options.hearts,
      startBand: asBand(options.startBand),
    });

  let run = start();
  let best = options.best;
  let summary: Summary | null = null;
  /** Where the run's clock stood when it opened, so "time flown" is honest. */
  let opened = run.state.elapsed;

  return {
    get state() {
      return run.state;
    },
    get summary() {
      return summary;
    },

    step(dt) {
      const events = run.step(dt);
      if (events.some((event) => event.type === 'ended')) {
        const score = run.state.score;
        summary = {
          score,
          bestStreak: run.state.bestStreak,
          seconds: run.state.elapsed - opened,
          best: Math.max(best, score),
          beatenBest: score > best,
        };
        best = Math.max(best, score);
      }
      return events;
    },

    aim: (lane) => run.aim(lane),
    fire: () => run.fire(),

    restart() {
      run = start();
      opened = run.state.elapsed;
      summary = null;
    },

    model: () => ({
      run: run.state,
      sumText: run.state.sum ? sumText(run.state.sum) : '',
      summary,
    }),
  };
}
```

- [ ] **Step 4: Run the driver test**

Run: `npx vitest run games/sky/src/driver.test.ts`
Expected: PASS.

- [ ] **Step 5: Add the module test for the test hooks**

Append to `games/sky/src/index.test.ts`:

```ts
import { skyGame } from './index.js';

const mounted = async (startLevel?: string) => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const host = createTestHost();
  const session = await skyGame.mount(container, host, startLevel ? { startLevel } : undefined);
  return { container, host, session };
};

describe('playing through the module', () => {
  it('opens with a question and a sky', async () => {
    const { session } = await mounted();
    session.__test.step();
    expect(session.__test.sum()).toMatch(/\d/);
    expect(session.__test.numbers().length).toBeGreaterThan(0);
    expect(session.__test.numbers()).toContain(session.__test.answer());
    expect(session.__test.hearts()).toBe(3);
    session.unmount();
  });

  it('scores the plane wearing the answer', async () => {
    const { session } = await mounted();
    session.__test.step(60);
    const before = session.__test.score();
    session.__test.shootAnswer();
    expect(session.__test.score()).toBe(before + 1);
    expect(session.__test.hearts()).toBe(3);
    session.unmount();
  });

  it('jams on the wrong plane without costing a heart', async () => {
    const { session } = await mounted();
    session.__test.step(60);
    session.__test.shootWrong();
    expect(session.__test.jammed()).toBe(true);
    expect(session.__test.score()).toBe(0);
    expect(session.__test.hearts()).toBe(3);
    session.unmount();
  });

  it('opens straight into a band for ?game=sky&level=take-aways', async () => {
    const { session } = await mounted('take-aways');
    session.__test.step();
    expect(session.__test.band()).toBe('take-aways');
    session.unmount();
  });

  it('remembers the best score across sessions', async () => {
    const first = await mounted();
    first.session.__test.step(60);
    first.session.__test.shootAnswer();
    first.session.__test.shootAnswer();
    first.session.unmount();
    expect(first.host.storage.get('best', 0)).toBeGreaterThanOrEqual(2);
    first.container.remove();
  });
});
```

- [ ] **Step 6: Write the module**

Replace `games/sky/src/index.ts` with the full version:

```ts
// games/sky/src/index.ts
import { createTicker, type GameHost, type GameModule, type GameSession } from '@bundle/core';
import { createDriver, type Driver } from './driver.js';
import type { BandId } from './logic/bands.data.js';
import { planeX } from './logic/sky-state.js';
import { createSkySoundPack } from './audio/sky-sounds.js';
import { createScene } from './view/scene.js';
import { createInput, type InputIntent } from './view/input.js';
import { DESIGN } from '@bundle/core';
import { TIMING } from './view/timing.js';

export interface SkyOptions {
  /** A band id, so `?game=sky&level=take-aways` opens straight into subtraction. */
  startLevel?: string;
}

/** Test seam: play the game without synthesising pointer geometry. */
export interface SkyTestHooks {
  step(frames?: number): void;
  aim(lane: number): void;
  fire(): void;
  /** Line up under the plane wearing the answer and shoot it down. */
  shootAnswer(): void;
  /** Line up under a plane that is not the answer and shoot it. */
  shootWrong(): void;
  sum(): string;
  answer(): number | null;
  numbers(): readonly number[];
  hearts(): number;
  score(): number;
  band(): BandId;
  status(): 'flying' | 'over';
  jammed(): boolean;
  restart(): void;
}

export interface SkySession extends GameSession {
  readonly __test: SkyTestHooks;
}

export interface SkyModule extends GameModule<SkyOptions> {
  mount(container: HTMLElement, host: GameHost, options?: SkyOptions): Promise<SkySession>;
}

export const skyGame: SkyModule = {
  id: 'sky',
  title: 'Sky Patrol',

  async mount(container, host, options = {}): Promise<SkySession> {
    const sounds = createSkySoundPack(host.audio);
    await sounds.preload();

    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;';
    container.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    const scene = createScene();
    const best = host.storage.get('best', 0);
    const driver: Driver = createDriver({ best, startBand: options.startLevel });

    /** Set when the run ends, so the card waits for the last heart to be seen. */
    let endingFor: number | null = null;

    const applySettings = (): void => {
      host.audio.muted = host.settings.values.muted;
      host.audio.volume = host.settings.values.volume;
    };
    applySettings();
    const unsubscribeSettings = host.settings.subscribe(applySettings);

    const handleEvents = (events: readonly ReturnType<Driver['step']>[number][]): void => {
      for (const event of events) {
        switch (event.type) {
          case 'destroyed':
            sounds.play('destroy');
            break;
          case 'damaged':
            sounds.play('damage');
            break;
          case 'jammed':
            sounds.play('jam');
            break;
          case 'escaped':
            sounds.play('escape');
            sounds.play('heart', { delay: 0.1 });
            break;
          case 'band':
            sounds.play('band');
            break;
          case 'ended':
            endingFor = 0;
            sounds.play('over');
            if (driver.summary?.beatenBest) sounds.play('best', { delay: 0.5 });
            host.storage.set('best', Math.max(best, event.score));
            break;
          default:
            break;
        }
      }
    };

    const handleIntent = (intent: InputIntent): void => {
      void host.audio.unlock();
      switch (intent.kind) {
        case 'aim':
          driver.aim(intent.lane);
          break;
        case 'fire':
          if (driver.state.jam <= 0) sounds.play('fire');
          driver.fire();
          break;
        case 'restart':
          driver.restart();
          endingFor = null;
          break;
      }
    };

    const input = createInput(canvas, scene, handleIntent, () => driver.state.status === 'over');

    const resize = (): void => {
      const ratio = Math.min(globalThis.devicePixelRatio || 1, 3);
      const width = canvas.clientWidth || DESIGN.width;
      const height = canvas.clientHeight || DESIGN.height;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
    };
    resize();
    globalThis.addEventListener?.('resize', resize);

    const frame = (dt: number): void => {
      const events = driver.step(dt);
      handleEvents(events);
      scene.observe(events);
      if (endingFor !== null) endingFor += dt;
      // The card waits a beat, so the last heart is seen to go.
      const showCard = endingFor !== null && endingFor >= TIMING.summaryDelaySeconds;
      scene.update(dt, { ...driver.model(), summary: showCard ? driver.summary : null });
      if (ctx) scene.render(ctx, { width: canvas.width, height: canvas.height });
    };

    const ticker = createTicker(frame);
    ticker.start();

    /** The plane the question is about, for the test hooks. */
    const target = () => driver.state.aloft.find((plane) => plane.uid === driver.state.targetUid);

    const shootUntilGone = (uid: string): void => {
      for (let i = 0; i < 300; i += 1) {
        const plane = driver.state.aloft.find((entry) => entry.uid === uid);
        if (!plane) return;
        driver.aim(planeX(plane));
        driver.fire();
        const events = driver.step(1 / 60);
        handleEvents(events);
        scene.observe(events);
        if (events.some((event) => event.type === 'jammed')) return;
      }
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
        aim: (lane) => driver.aim(lane),
        fire: () => driver.fire(),
        shootAnswer() {
          const chosen = target();
          if (chosen) shootUntilGone(chosen.uid);
        },
        shootWrong() {
          const wrong = driver.state.aloft.find((plane) => plane.number !== driver.state.sum?.answer);
          if (wrong) shootUntilGone(wrong.uid);
        },
        sum: () => driver.model().sumText,
        answer: () => driver.state.sum?.answer ?? null,
        numbers: () => driver.state.aloft.map((plane) => plane.number),
        hearts: () => driver.state.hearts,
        score: () => driver.state.score,
        band: () => driver.state.band.id,
        status: () => driver.state.status,
        jammed: () => driver.state.jam > 0,
        restart: () => driver.restart(),
      },
    };
  },
};

export default skyGame;
export { BANDS, bandAt, bandById, type Band, type BandId } from './logic/bands.data.js';
export { PLANE_TYPES, PLANE_IDS, type PlaneTypeId } from './logic/planes.js';
export { createSkySoundPack, SOUND_EVENTS } from './audio/sky-sounds.js';
```

- [ ] **Step 7: Run the whole suite and the typechecker**

Run: `npm test && npm run typecheck`
Expected: PASS. If `handleEvents`'s parameter type is awkward, extract `type SkyEvent = ReturnType<Driver['step']>[number]` above the module and use `readonly SkyEvent[]` — do not widen it to `any`.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(sky): the driver and the game module

The driver is the one seam the scene, the sounds, the input and the frame loop
talk through, so none of them know how a run is built or when a new one
begins. The module carries __test hooks, so a test can shoot the right plane
without synthesising pointer geometry."
```

---

### Task 17: A played run, end to end

The tests that would catch a break nobody else would: the game played through the module the way a child plays it, including a run losing all three hearts and going again.

**Files:**
- Create: `games/sky/src/integration.test.ts`

**Interfaces:**
- Consumes: `skyGame`, `createTestHost`, `installCanvasStub`. Nothing new is produced.

- [ ] **Step 1: Write the integration test**

```ts
// games/sky/src/integration.test.ts
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { installCanvasStub } from '@bundle/core';
import { skyGame } from './index.js';
import { createTestHost } from './test-host.js';
import * as sounds from './audio/sky-sounds.js';

let restoreCanvas: () => void;
beforeAll(() => {
  restoreCanvas = installCanvasStub();
});
afterAll(() => restoreCanvas());

const recordSounds = () => {
  const played: string[] = [];
  vi.spyOn(sounds, 'createSkySoundPack').mockReturnValue({
    preload: async () => {},
    play: (event: string) => void played.push(event),
  });
  return played;
};

const mountGame = async (startLevel?: string) => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const host = createTestHost();
  const session = await skyGame.mount(container, host, startLevel ? { startLevel } : undefined);
  return { container, host, session };
};

describe('a run played through the module', () => {
  it('scores twenty planes without losing a heart when the sums are read', async () => {
    const { session } = await mountGame();
    session.__test.step(30);
    for (let i = 0; i < 20; i += 1) {
      session.__test.shootAnswer();
      session.__test.step(2);
    }
    expect(session.__test.score()).toBeGreaterThanOrEqual(18);
    expect(session.__test.hearts()).toBe(3);
    expect(session.__test.status()).toBe('flying');
    session.unmount();
  });

  it('plays the reward sound for a right answer and the cough for a wrong one', async () => {
    const played = recordSounds();
    const { session } = await mountGame();
    session.__test.step(30);
    session.__test.shootAnswer();
    expect(played).toContain('destroy');
    session.__test.shootWrong();
    expect(played).toContain('jam');
    session.unmount();
    vi.restoreAllMocks();
  });

  it('loses the run when the sums are ignored, then flies again', async () => {
    const { session } = await mountGame();
    // Let three targets get away without firing a shell.
    for (let i = 0; i < 60 * 90 && session.__test.status() === 'flying'; i += 1) {
      session.__test.step();
    }
    expect(session.__test.status()).toBe('over');
    expect(session.__test.hearts()).toBe(0);

    session.__test.restart();
    session.__test.step();
    expect(session.__test.status()).toBe('flying');
    expect(session.__test.hearts()).toBe(3);
    expect(session.__test.score()).toBe(0);
    session.unmount();
  });

  it('writes the best score down where the next session will find it', async () => {
    const { session, host } = await mountGame();
    session.__test.step(30);
    for (let i = 0; i < 3; i += 1) {
      session.__test.shootAnswer();
      session.__test.step(2);
    }
    // Let the run end so the best is written.
    for (let i = 0; i < 60 * 120 && session.__test.status() === 'flying'; i += 1) session.__test.step();
    expect(host.storage.get('best', 0)).toBeGreaterThanOrEqual(3);
    session.unmount();
  });

  it('keeps every number in the sky answerable, played or not', async () => {
    const { session } = await mountGame('over-ten');
    for (let i = 0; i < 60 * 60; i += 1) {
      session.__test.step();
      for (const number of session.__test.numbers()) {
        expect(number).toBeGreaterThanOrEqual(1);
        expect(number).toBeLessThanOrEqual(20);
      }
    }
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

- [ ] **Step 2: Run it**

Run: `npx vitest run games/sky/src/integration.test.ts`
Expected: PASS. If "scores twenty planes" falls short, the likely cause is `shootAnswer` giving up on a weaver that swayed out from under the shell — widen `shootUntilGone`'s loop before touching the expectation, and only then reconsider `TIMING`.

- [ ] **Step 3: Run the whole suite and the typechecker**

Run: `npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "test(sky): a run played end to end through the module

Reading the sums scores twenty planes without losing a heart; ignoring them
loses the run and it can be flown again. The best score is written where the
next session will find it."
```

---

### Task 18: README, and playing it on the actual iPad

The last task is the one that catches what no test can: how it feels in the hand.

**Files:**
- Modify: `README.md`

**Interfaces:** none.

- [ ] **Step 1: Run everything one more time**

Run: `npm test && npm run typecheck && npm run build`
Expected: all three clean. A build failure here is almost always a missing alias in `apps/shell/vite.config.ts` — the tests use `vitest.config.ts`'s aliases and will not catch it.

- [ ] **Step 2: Play it**

```bash
npm run dev
```

Open `http://localhost:5173/?game=sky`, and then `?game=sky&level=over-ten` and `?game=sky&level=take-aways`. Check each of these by hand, because each is a thing a test cannot see:

- The sum on the fighter is readable while the fighter is moving.
- Lining up under a plane feels like flying, not like dragging a slider.
- A wrong shot reads as *your gun jammed*, not as *the game broke*.
- The solved sum is legible for long enough to read before it fades.
- At two minutes, the sky is busy but the question is still findable.
- The band banner does not cover a plane you needed to see.
- The summary card reads as an achievement.

- [ ] **Step 3: Play it on the iPad**

```bash
npm run build && npm run preview
```

Open the **Network:** address in Safari on the iPad, in landscape, added to the Home Screen. Tap once for sound. Check specifically: a thumb at the bottom of the screen does not cover the fighter's sum, and firing on release does not fight iOS's own gestures at the screen edges.

- [ ] **Step 4: Write the README section**

Add a `## Sky Patrol` section after the Seesaw material, covering: the loop and what a heart costs; the three bands and their times; the five plane types and what each makes hard; that the sum is written about planes already flying and why (with the Seesaw arcade half named as the reason); the trap invariant; `?game=sky&level=<band>`; and the bot test as the thing that guards it. Add Sky Patrol to the "Layout" tree (`games/sky/`) and note under "Not built yet" that Sky Patrol has vector art and synthesised sound only.

While in there, fix what is already wrong: `README.md` has **"Telling the player what is being asked"**, **"Design rules worth keeping"** and **"Layout"** duplicated verbatim, and an "arcade half: Balance Rush" section describing a mode the same file later says was removed. Delete the duplicates and the stale section — a second game landing is exactly when a reader will be misled by them.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "docs: Sky Patrol, and tidy the duplicated README sections

Documents the second game: the loop, the three bands, the five plane types,
and why the sum is written about planes already flying rather than the answer
being spawned to order.

Also deletes three sections the README had twice over and an arcade-half
description the same file later says was removed."
```

---

## Self-Review

**Spec coverage.** Every section of the spec maps to a task: the loop and the heart rules to Task 8; sky-first coupling, the fair window and the trap invariant to Tasks 6, 7 and 9; the three bands to Tasks 3–4; the five plane types to Task 5; tempo to Task 3; controls to Task 14; feel to Tasks 11–13 and 15; structure to Tasks 2 and 10; testing to Task 9 and Task 17; the summary card and best score to Tasks 12 and 16. The spec's note that a sum survives a band change is asserted in Task 8's clock test, and that a blimp remembers its hits in Task 5's damage test and Task 8's blimp test.

Two places where the plan refines the spec's structure, both deliberate:

- **`logic/tempo.ts` is new** — the spec's file list folded the tempo curve into the bands. It is a curve over elapsed time, not curriculum, and belongs on its own.
- **`view/sprite-theme.ts` is dropped.** There are no art assets for this game, so a theme interface with one implementation would be a seam for its own sake. The vector art is one file and swapping it later is a change to that file.

Both are recorded in the spec so the two documents do not disagree.

**Placeholders.** None: every step names its files, its command and its expected result, and every code step carries the code.

**Type consistency.** `Plane`, `Sum`, `Band`, `Tempo`, `RunState`, `RunEvent`, `SceneModel`, `Summary` and `InputIntent` are each defined once and consumed under the same names throughout. `remaining` (Task 5) is used by `eligible` (Task 6); `hasTrap`/`trapNumber` (Task 7) by `ask` (Task 8); `planeSize` (Task 10) by `drawPlane` (Task 11); `sumText` (Task 4) by the driver and the scene. The run exposes `aim`/`fire`, and the input's intents are `aim`/`fire`/`restart` — deliberately the same verbs, so the wiring in Task 16 reads as a translation rather than a mapping.
