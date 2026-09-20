# Bramble Dash Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Bramble Dash, the bundle's third game: a rabbit runs forward wearing a sum, three lanes of obstacles come at it, exactly one wears the answer, and bursting through it is the reward.

**Architecture:** A pure logic layer owns the run — rows approaching, berries, fuel, the band clock — in normalised coordinates (`x` across the path and `progress` toward the rabbit, both 0..1), so every rule is testable without a canvas. A canvas layer maps those onto the 1152x768 design space and never writes back. The curriculum Sky Patrol already has (bands, equation writing, trap rules) moves into a shared `@bundle/math` rather than being copied.

**Tech Stack:** TypeScript (strict, `noUncheckedIndexedAccess`), Vite, Vitest, canvas 2D, Web Audio via `@bundle/core`'s shared bus. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-20-bramble-dash-design.md` — read it before Task 1 and keep it open; this plan argues from it.

## Global Constraints

- **Design space 1152x768** landscape, as the other two games. Gameplay stays inside it; scenery may paint past it.
- **Three lanes.** `LANES = 3`, and **exactly one lane per row wears the answer** — never none, never two.
- **Answers never exceed 20 and never fall below 1.** Every number in a row comes from the live band's answer set.
- **One tank of fuel**: `MAX_HEALTH = 100`, a wrong lane costs `MISS_COST = 10`, a berry gives `BERRY_GIVES = 10` and never takes the tank past full.
- **A berry arrives with at least half the gap to the next row left**, so taking one can never strand the rabbit in the wrong lane.
- **`src/logic/` is pure**: no DOM, no timers, no audio, no `Math.random` — randomness only through `createRng` from `@bundle/core`, seeded, so a run can be replayed exactly.
- **`src/view/` reads state and never writes it.**
- **The minus sign is `−` (U+2212), not a hyphen.**
- **Top-down, never perspective.** A number must be full size from the moment it appears.
- Run `npm test` and `npm run typecheck` before every commit. Both must be clean.

---

### Task 1: The shared curriculum — `@bundle/math`

The three bands, the equation writing and the trap rules are identical in both games. They move out of `games/sky` into a package both import. Sky Patrol keeps every one of its tests through the move, which is what proves the move was faithful.

**Files:**
- Create: `packages/math/package.json`, `packages/math/tsconfig.json`, `packages/math/src/index.ts`
- Move: `games/sky/src/logic/bands.data.ts` → `packages/math/src/bands.data.ts` (and its test)
- Move: `games/sky/src/logic/equation.ts` → `packages/math/src/equation.ts` (and its test)
- Create: `packages/math/src/traps.ts`, `packages/math/src/traps.test.ts`
- Modify: `games/sky/src/logic/spawner.ts` (trap rules move out), `games/sky/src/logic/spawner.test.ts`
- Modify: every `games/sky` file importing those modules
- Modify: `tsconfig.json`, `vitest.config.ts`, `apps/shell/vite.config.ts`

**Interfaces:**
- Consumes: `Rng` from `@bundle/core`.
- Produces, all from `@bundle/math`: `type BandId`, `interface Band`, `BANDS`, `bandAt(elapsed: number): Band`, `bandById(id: string): Band | undefined`, `answerSet(band: Band): readonly number[]`; `type Op`, `interface Sum { left: number; op: Op; right: number; answer: number }`, `CEILING`, `sumText(sum: Sum): string`, `additionsFor`, `subtractionsFor`, `drawAnswer(rng, band): number`, `writeSum(rng, band, answer, inTheSky): Sum | null`; `isTrapFor(sum: Sum, value: number): boolean`, `trapNumber(rng: Rng, sum: Sum, band: Band): number`.

- [ ] **Step 1: Create the package**

```json
// packages/math/package.json
{
  "name": "@bundle/math",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "src/index.ts"
}
```

```json
// packages/math/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src"]
}
```

- [ ] **Step 2: Move the files with git, so history follows them**

```bash
mkdir -p packages/math/src
git mv games/sky/src/logic/bands.data.ts packages/math/src/bands.data.ts
git mv games/sky/src/logic/bands.test.ts packages/math/src/bands.test.ts
git mv games/sky/src/logic/equation.ts packages/math/src/equation.ts
git mv games/sky/src/logic/equation.test.ts packages/math/src/equation.test.ts
```

In the moved files, change `import type { Band } from './bands.data.js'` to stay relative (it already is — both files now sit side by side, so no edit is needed) and change any `@bundle/core` import to stay as it is.

- [ ] **Step 3: Move the trap rules out of Sky Patrol's spawner**

Create `packages/math/src/traps.ts` with `isTrapFor` and `trapNumber` lifted verbatim from `games/sky/src/logic/spawner.ts`, comments included — the comment explaining *why* an operand is preferred is the reason the code is shaped that way and travels with it:

```ts
// packages/math/src/traps.ts
import type { Rng } from '@bundle/core';
import { answerSet, type Band } from './bands.data.js';
import type { Sum } from './equation.js';

/**
 * Whether a number is worth putting in front of a player while this sum is
 * live: an operand, or a near miss. Either forces the answer to be computed
 * instead of picked out as the only plausible number on screen.
 */
export const isTrapFor = (sum: Sum, value: number): boolean =>
  value !== sum.answer &&
  (value === sum.left || value === sum.right || Math.abs(value - sum.answer) <= 2);

/**
 * A trap to use. An operand first — taking the 7 when asked for 7 + 8 is the
 * characteristic error at this age, and it should be there to make — then a
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
```

Then delete `isTrapFor` and `trapNumber` from `games/sky/src/logic/spawner.ts` and re-export them so no Sky Patrol import changes:

```ts
// at the top of games/sky/src/logic/spawner.ts
import { isTrapFor, trapNumber } from '@bundle/math';
export { isTrapFor, trapNumber };
```

- [ ] **Step 4: Write the package's entry point**

```ts
// packages/math/src/index.ts
export {
  BANDS,
  bandAt,
  bandById,
  answerSet,
  type Band,
  type BandId,
} from './bands.data.js';
export {
  CEILING,
  additionsFor,
  subtractionsFor,
  drawAnswer,
  sumText,
  writeSum,
  type Op,
  type Sum,
} from './equation.js';
export { isTrapFor, trapNumber } from './traps.js';
```

- [ ] **Step 5: Register the package in three places**

`tsconfig.json` — add to `compilerOptions.paths`:

```json
"@bundle/math": ["packages/math/src/index.ts"]
```

`vitest.config.ts` — add to `resolve.alias`:

```ts
'@bundle/math': resolvePath('./packages/math/src/index.ts'),
```

`apps/shell/vite.config.ts` — add to `resolve.alias`:

```ts
'@bundle/math': resolvePath('../../packages/math/src/index.ts'),
```

- [ ] **Step 6: Point Sky Patrol's imports at the package**

In every `games/sky/src` file that imported `./bands.data.js` or `../logic/bands.data.js` (and the same for `equation.js`), change the import to `@bundle/math`. The files are:

```
games/sky/src/logic/equation.test.ts   (moved — delete its old import path)
games/sky/src/logic/run.ts
games/sky/src/logic/spawner.ts
games/sky/src/logic/targeting.test.ts
games/sky/src/logic/invariants.test.ts
games/sky/src/logic/run.test.ts
games/sky/src/logic/spawner.test.ts
games/sky/src/driver.ts
games/sky/src/index.ts
games/sky/src/view/scene.ts
games/sky/src/view/scene.test.ts
```

Find them rather than trusting this list:

```bash
grep -rln "bands.data.js\|logic/equation.js\|from './equation.js'" games/sky/src
```

- [ ] **Step 7: Write the traps test in its new home**

```ts
// packages/math/src/traps.test.ts
import { describe, it, expect } from 'vitest';
import { createRng } from '@bundle/core';
import { answerSet, BANDS } from './bands.data.js';
import { isTrapFor, trapNumber } from './traps.js';
import type { Sum } from './equation.js';

const OVER_TEN = BANDS[1]!;
const SEVEN_PLUS_EIGHT: Sum = { left: 7, op: '+', right: 8, answer: 15 };

describe('isTrapFor', () => {
  it('counts an operand, because taking one is the error of this age', () => {
    expect(isTrapFor(SEVEN_PLUS_EIGHT, 7)).toBe(true);
    expect(isTrapFor(SEVEN_PLUS_EIGHT, 8)).toBe(true);
  });

  it('counts a near miss', () => {
    expect(isTrapFor(SEVEN_PLUS_EIGHT, 14)).toBe(true);
    expect(isTrapFor(SEVEN_PLUS_EIGHT, 13)).toBe(true);
  });

  it('never counts the answer itself, or a number nowhere near it', () => {
    expect(isTrapFor(SEVEN_PLUS_EIGHT, 15)).toBe(false);
    expect(isTrapFor(SEVEN_PLUS_EIGHT, 2)).toBe(false);
  });
});

describe('trapNumber', () => {
  it('reaches for an operand first', () => {
    const rng = createRng(6);
    for (let i = 0; i < 40; i += 1) expect([7, 8]).toContain(trapNumber(rng, SEVEN_PLUS_EIGHT, OVER_TEN));
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
```

- [ ] **Step 8: Run the whole suite and the typechecker**

Run: `npm test && npm run typecheck`
Expected: PASS, with every Sky Patrol test still green. A Sky Patrol failure here means an import was missed, not that a rule changed — fix the import, never the test.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "refactor(math): the curriculum moves into a package both games share

The three bands, the equation writing and the trap rules are the same in Sky
Patrol and in the runner that is coming, so they belong in one place rather
than two. Sky Patrol keeps every one of its tests through the move, which is
what proves the move was faithful."
```

---

### Task 2: The shared HUD furniture

The fuel bar, the band banner, the summary card and the hand-lettered label helper are identical furniture in both games. Same treatment as Task 1: move them to core, let Sky Patrol's tests prove the move.

**Files:**
- Create: `packages/core/src/view/hud-kit.ts`, `packages/core/src/view/hud-kit.test.ts`
- Modify: `packages/core/src/index.ts`
- Modify: `games/sky/src/view/hud.ts` (keeps only what is Sky Patrol's own), `games/sky/src/view/hud.test.ts`

**Interfaces:**
- Consumes: `DESIGN`, `hand`, `Point` from `@bundle/core`.
- Produces from `@bundle/core`: `label(ctx, text, x, y, size, align): void`, `interface FuelModel { health: number; flash: number }`, `drawFuelBar(ctx, x, y, model: FuelModel, notchEvery: number): void`, `drawArrivingBanner(ctx, title, progress, settleFraction, homeY): void`, `interface RunSummary { score: number; bestStreak: number; seconds: number; best: number; beatenBest: boolean; headline: string; lines: readonly string[] }`, `drawSummaryCard(ctx, summary: RunSummary): void`.

- [ ] **Step 1: Write the failing test**

```ts
// packages/core/src/view/hud-kit.test.ts
import { describe, it, expect } from 'vitest';
import { recordingContext, depthOf } from './recording-context.js';
import { drawFuelBar, drawSummaryCard, drawArrivingBanner, label } from './hud-kit.js';

describe('the fuel bar', () => {
  it('writes how much is left', () => {
    const { ctx, texts } = recordingContext();
    drawFuelBar(ctx, 80, 30, { health: 65, flash: 0 }, 20);
    expect(texts).toContain('65%');
    expect(depthOf(ctx)).toBe(0);
  });

  it('draws at any level without leaving the context saved', () => {
    for (const health of [0, 5, 50, 100]) {
      const { ctx } = recordingContext();
      drawFuelBar(ctx, 80, 30, { health, flash: 0.5 }, 20);
      expect(depthOf(ctx)).toBe(0);
    }
  });
});

describe('an arriving banner', () => {
  it('writes its title and travels towards its home', () => {
    const early = recordingContext();
    drawArrivingBanner(early.ctx, 'Over Ten', 0.05, 0.26, 46);
    expect(early.texts).toContain('Over Ten');
    const late = recordingContext();
    drawArrivingBanner(late.ctx, 'Over Ten', 0.95, 0.26, 46);
    expect(late.translations[0]!.y).toBeLessThan(early.translations[0]!.y);
  });
});

describe('the summary card', () => {
  it('reads as an achievement and says how to go again', () => {
    const { ctx, texts } = recordingContext();
    drawSummaryCard(ctx, {
      score: 24,
      bestStreak: 9,
      seconds: 132,
      best: 20,
      beatenBest: true,
      headline: 'A new best!',
      lines: ['Planes down   24', 'Longest streak   9'],
    });
    const all = texts.join(' ');
    expect(all).toContain('A new best!');
    expect(all).toContain('Planes down   24');
    expect(all.toLowerCase()).toContain('tap');
    expect(all.toLowerCase()).not.toContain('fail');
    expect(depthOf(ctx)).toBe(0);
  });
});

describe('lettering', () => {
  it('writes text with a rim under it', () => {
    const { ctx, calls, texts } = recordingContext();
    label(ctx, 'hello', 10, 10, 20, 'center');
    expect(texts).toContain('hello');
    expect(calls).toContain('strokeText');
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run packages/core/src/view/hud-kit.test.ts`
Expected: FAIL — cannot resolve `./hud-kit.js`.

- [ ] **Step 3: Move the widgets into core**

Create `packages/core/src/view/hud-kit.ts` holding `label`, the health bar (renamed `drawFuelBar`, taking its `x`, `y` and notch spacing as arguments rather than reading Sky Patrol's `SKY` constants), the banner (renamed `drawArrivingBanner`, taking its settle fraction and home `y` as arguments), and the summary card (renamed `drawSummaryCard`, taking its headline and lines as data so each game words its own).

Copy the bodies and the comments across from `games/sky/src/view/hud.ts` unchanged — the comment explaining why a bar rather than a row of lives is the reason the widget exists, and travels with it.

```ts
// packages/core/src/view/hud-kit.ts — the signatures the bodies go into
import { DESIGN } from './viewport.js';
import { hand } from './type.js';

export const label = (
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  align: CanvasTextAlign,
): void => { /* body lifted from games/sky/src/view/hud.ts */ };

export interface FuelModel {
  /** 0 to 100. */
  health: number;
  /** 0..1 through the flash that follows a drop. */
  flash: number;
}

export function drawFuelBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  model: FuelModel,
  notchEvery: number,
): void { /* body lifted from healthBar */ }

export function drawArrivingBanner(
  ctx: CanvasRenderingContext2D,
  title: string,
  progress: number,
  settleFraction: number,
  homeY: number,
): void { /* body lifted from drawBanner */ }

export interface RunSummary {
  score: number;
  bestStreak: number;
  seconds: number;
  best: number;
  beatenBest: boolean;
  /** Each game words its own: "A new best!", "Good flying!", "Good running!" */
  headline: string;
  /** The rows of the card, already worded, so core never names a plane. */
  lines: readonly string[];
}

export function drawSummaryCard(ctx: CanvasRenderingContext2D, summary: RunSummary): void {
  /* body lifted from drawSummary, writing `headline` then each of `lines` */
}
```

- [ ] **Step 4: Export them from core**

Add to `packages/core/src/index.ts`:

```ts
export {
  label,
  drawFuelBar,
  drawArrivingBanner,
  drawSummaryCard,
  type FuelModel,
  type RunSummary,
} from './view/hud-kit.js';
```

- [ ] **Step 5: Make Sky Patrol's HUD use them**

`games/sky/src/view/hud.ts` keeps only what is Sky Patrol's own — `drawHud` (which positions the fuel bar and writes the score and streak), `drawSolved`, `drawMissed`'s caller, `drawLoss`, and a `drawSummary` that words the card and hands it to `drawSummaryCard`:

```ts
import { drawFuelBar, drawSummaryCard, label, type RunSummary } from '@bundle/core';

export function drawSummary(ctx: CanvasRenderingContext2D, summary: Summary): void {
  drawSummaryCard(ctx, {
    ...summary,
    headline: summary.beatenBest ? 'A new best!' : 'Good flying!',
    lines: [
      `Planes down   ${summary.score}`,
      `Longest streak   ${summary.bestStreak}`,
      `Time flown   ${minutes(summary.seconds)}`,
      `Best so far   ${summary.best}`,
    ],
  });
}
```

- [ ] **Step 6: Run the whole suite and the typechecker**

Run: `npm test && npm run typecheck`
Expected: PASS. Sky Patrol's HUD tests are the proof the move was faithful; if one fails, a body was changed in the move rather than copied.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor(core): the HUD furniture both games share moves into core

The fuel bar, the arriving banner and the summary card are the same widgets in
Sky Patrol and in the runner that is coming. They take their position and their
wording as arguments now, so core never names a plane or a rabbit."
```

---
### Task 3: The `games/bramble` package, registered and mounting

An empty game the shell can open. Nothing runs yet; the deliverable is that `?game=bramble` reaches a live canvas and the four registration points are right, because a path mistake here is miserable to debug from inside gameplay code later.

**Files:**
- Create: `games/bramble/package.json`, `games/bramble/tsconfig.json`, `games/bramble/src/index.ts`, `games/bramble/src/vite-env.d.ts`, `games/bramble/src/test-host.ts`, `games/bramble/src/index.test.ts`
- Modify: `tsconfig.json`, `vitest.config.ts`, `apps/shell/vite.config.ts`, `apps/shell/src/catalog.ts`

**Interfaces:**
- Consumes: `GameHost`, `GameModule`, `GameSession`, `createTicker` from `@bundle/core`.
- Produces: `brambleGame: BrambleModule` (default export too), `interface BrambleOptions { startLevel?: string }`, `createTestHost(options?): TestHost`.

- [ ] **Step 1: Write the failing test**

```ts
// games/bramble/src/index.test.ts
// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { installCanvasStub } from '@bundle/core';
import { brambleGame } from './index.js';
import { createTestHost } from './test-host.js';

let restoreCanvas: () => void;
beforeAll(() => { restoreCanvas = installCanvasStub(); });
afterAll(() => restoreCanvas());

describe('brambleGame', () => {
  it('names itself for the catalog', () => {
    expect(brambleGame.id).toBe('bramble');
    expect(brambleGame.title).toBe('Bramble Dash');
  });

  it('mounts a canvas and takes it away again', async () => {
    const container = document.createElement('div');
    const session = await brambleGame.mount(container, createTestHost());
    expect(container.querySelector('canvas')).not.toBeNull();
    session.unmount();
    expect(container.querySelector('canvas')).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run games/bramble/src/index.test.ts`
Expected: FAIL — cannot resolve `./index.js`.

- [ ] **Step 3: Create the package**

```json
// games/bramble/package.json
{
  "name": "@bundle/bramble",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "src/index.ts"
}
```

```json
// games/bramble/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src"]
}
```

```ts
// games/bramble/src/vite-env.d.ts
/// <reference types="vite/client" />
```

Copy `games/sky/src/test-host.ts` to `games/bramble/src/test-host.ts`, changing only the storage namespace from `'sky'` to `'bramble'`.

- [ ] **Step 4: Register in all four places**

`tsconfig.json` paths: `"@bundle/bramble": ["games/bramble/src/index.ts"]`

`vitest.config.ts` alias: `'@bundle/bramble': resolvePath('./games/bramble/src/index.ts'),`

`apps/shell/vite.config.ts` alias: `'@bundle/bramble': resolvePath('../../games/bramble/src/index.ts'),`

`apps/shell/src/catalog.ts` — import the module, give it the third tile, and **remove the `sorting` placeholder** so the bundle stays ten games:

```ts
import { brambleGame } from '@bundle/bramble';
// ...
{ id: 'bramble', title: 'Bramble Dash', blurb: 'Run the right way', colors: ['#8fce72', '#3f8f52'], module: brambleGame },
```

- [ ] **Step 5: Write the minimal module**

```ts
// games/bramble/src/index.ts
import { createTicker, type GameHost, type GameModule, type GameSession } from '@bundle/core';

export interface BrambleOptions {
  /** A band id, so `?game=bramble&level=take-aways` opens straight into subtraction. */
  startLevel?: string;
}

export interface BrambleModule extends GameModule<BrambleOptions> {
  mount(container: HTMLElement, host: GameHost, options?: BrambleOptions): Promise<GameSession>;
}

export const brambleGame: BrambleModule = {
  id: 'bramble',
  title: 'Bramble Dash',

  async mount(container, _host, _options = {}): Promise<GameSession> {
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

export default brambleGame;
```

- [ ] **Step 6: Run the tests and the typechecker**

Run: `npm test && npm run typecheck`
Expected: PASS. `apps/shell/src/shell.test.ts` derives its coming-soon count from the catalog, so a third playable game does not break it.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(bramble): the Bramble Dash package, registered and mounting

An empty canvas the shell can open at ?game=bramble. It takes the third tile
and retires the Sorting Station placeholder, whose skill Seesaw Park already
covers, so the bundle stays ten games."
```

---

### Task 4: Tempo and lanes

Two small pure modules: how the gaps tighten with the clock, and where the three lanes are.

**Files:**
- Create: `games/bramble/src/logic/tempo.ts`, `games/bramble/src/logic/tempo.test.ts`
- Create: `games/bramble/src/logic/lanes.ts`, `games/bramble/src/logic/lanes.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `interface Tempo { rowEvery: number; approachSeconds: number; berryChance: number }`, `tempoAt(elapsed: number): Tempo`; `LANES = 3`, `laneCentre(lane: number): number`, `laneAt(x: number): number`.

- [ ] **Step 1: Write the failing tests**

```ts
// games/bramble/src/logic/tempo.test.ts
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
```

```ts
// games/bramble/src/logic/lanes.test.ts
import { describe, it, expect } from 'vitest';
import { LANES, laneAt, laneCentre } from './lanes.js';

describe('lanes', () => {
  it('has three of them', () => {
    expect(LANES).toBe(3);
  });

  it('puts each lane centre inside its own third', () => {
    for (let lane = 0; lane < LANES; lane += 1) {
      expect(laneAt(laneCentre(lane))).toBe(lane);
    }
    expect(laneCentre(0)).toBeCloseTo(1 / 6, 5);
    expect(laneCentre(1)).toBeCloseTo(0.5, 5);
    expect(laneCentre(2)).toBeCloseTo(5 / 6, 5);
  });

  it('reads the edges of the path as the outside lanes', () => {
    expect(laneAt(0)).toBe(0);
    expect(laneAt(1)).toBe(LANES - 1);
    expect(laneAt(-2)).toBe(0);
    expect(laneAt(9)).toBe(LANES - 1);
  });

  it('splits at the thirds', () => {
    expect(laneAt(0.32)).toBe(0);
    expect(laneAt(0.34)).toBe(1);
    expect(laneAt(0.66)).toBe(1);
    expect(laneAt(0.68)).toBe(2);
  });
});
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `npx vitest run games/bramble/src/logic`
Expected: FAIL — cannot resolve `./tempo.js` or `./lanes.js`.

- [ ] **Step 3: Write the two modules**

```ts
// games/bramble/src/logic/tempo.ts
/**
 * How the path tightens as a run goes on. Elapsed time is the only input, so a
 * player doing well is not punished for it: skill shows up in the distance, not
 * in the difficulty.
 *
 * The ramp is in reading speed rather than reaction time. The rabbit steers as
 * quickly as it ever did; what shrinks is how long a row's numbers are on
 * screen before the rabbit reaches them.
 */
export interface Tempo {
  /** Seconds between one row and the next. */
  rowEvery: number;
  /** Seconds a row takes to travel from the horizon to the rabbit. */
  approachSeconds: number;
  /** Chance a gap between rows carries a berry. */
  berryChance: number;
}

const RAMP_SECONDS = 180;
/** More than one row on the path at a time, so the next can be read early. */
const LOOK_AHEAD = 1.6;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));
const lerp = (from: number, to: number, t: number): number => from + (to - from) * t;
/** Ease out, so the first minute tightens gently and the third is brisk. */
const ease = (t: number): number => 1 - (1 - t) * (1 - t);

export function tempoAt(elapsed: number): Tempo {
  const ramp = ease(clamp01(elapsed / RAMP_SECONDS));
  // Past the ramp it keeps creeping towards the floor, so a very long run still
  // asks more of the player rather than settling into a plateau.
  const beyond = clamp01((elapsed - RAMP_SECONDS) / RAMP_SECONDS);
  const rowEvery = lerp(3.5, 1.8, ramp) - 0.2 * beyond;
  return {
    rowEvery,
    approachSeconds: rowEvery * LOOK_AHEAD,
    berryChance: lerp(0.33, 0.2, ramp),
  };
}
```

```ts
// games/bramble/src/logic/lanes.ts
/**
 * Three lanes, and nothing else. The lane is the answer, so a second axis of
 * input would make this a dexterity game with sums attached.
 */
export const LANES = 3;

/** The middle of a lane, 0..1 across the path. */
export const laneCentre = (lane: number): number => (lane + 0.5) / LANES;

/**
 * Which lane a position is over. The rabbit moves continuously and this is what
 * decides where it counts as being when a row arrives — forgiving, because a
 * child steering with a finger should not lose a tenth of the tank to a pixel.
 */
export const laneAt = (x: number): number =>
  Math.min(LANES - 1, Math.max(0, Math.floor(x * LANES)));
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run games/bramble/src/logic && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(bramble): the tempo curve and the three lanes

The ramp is in reading speed rather than reaction time: the rabbit steers as
quickly as it ever did, and what shrinks is how long a row is on screen. More
than one row is always on the path, so the next can be read early."
```

---

### Task 5: A row of obstacles

The heart of the game: three lanes, exactly one wearing the answer, the other two plausible.

**Files:**
- Create: `games/bramble/src/logic/row.ts`, `games/bramble/src/logic/row.test.ts`

**Interfaces:**
- Consumes: `Rng` from `@bundle/core`; `Band`, `Sum`, `answerSet`, `drawAnswer`, `writeSum`, `isTrapFor`, `trapNumber` from `@bundle/math`; `LANES` from `./lanes.js`.
- Produces: `type ObstacleKind = 'rock' | 'bear' | 'log'`, `interface Row { uid: string; numbers: readonly number[]; answerLane: number; sum: Sum; kinds: readonly ObstacleKind[]; progress: number; approachSeconds: number; resolved: boolean }`, `buildRow(rng: Rng, band: Band, uid: string, approachSeconds: number): Row`, `remaining(row: Row): number`.

- [ ] **Step 1: Write the failing test**

```ts
// games/bramble/src/logic/row.test.ts
import { describe, it, expect } from 'vitest';
import { createRng } from '@bundle/core';
import { answerSet, BANDS, isTrapFor } from '@bundle/math';
import { LANES } from './lanes.js';
import { buildRow, remaining } from './row.js';

describe('building a row', () => {
  it('always puts the answer in exactly one lane', () => {
    const rng = createRng(11);
    for (const band of BANDS) {
      for (let i = 0; i < 400; i += 1) {
        const row = buildRow(rng, band, `r${i}`, 5);
        const answering = row.numbers.filter((number) => number === row.sum.answer);
        expect(answering, `${row.numbers.join(',')} for ${row.sum.answer}`).toHaveLength(1);
        expect(row.numbers[row.answerLane]).toBe(row.sum.answer);
      }
    }
  });

  it('fills every lane, so there is never a safe one', () => {
    const rng = createRng(12);
    for (let i = 0; i < 200; i += 1) {
      const row = buildRow(rng, BANDS[1]!, `r${i}`, 5);
      expect(row.numbers).toHaveLength(LANES);
      expect(row.kinds).toHaveLength(LANES);
      for (const number of row.numbers) expect(Number.isInteger(number)).toBe(true);
    }
  });

  it('makes both wrong lanes plausible, so elimination does not work', () => {
    const rng = createRng(13);
    for (let i = 0; i < 400; i += 1) {
      const row = buildRow(rng, BANDS[1]!, `r${i}`, 5);
      const wrong = row.numbers.filter((_, lane) => lane !== row.answerLane);
      for (const number of wrong) {
        expect(isTrapFor(row.sum, number), `${number} is not plausible for ${row.sum.answer}`).toBe(true);
      }
    }
  });

  it('never wears a number the band would not allow', () => {
    const rng = createRng(14);
    for (const band of BANDS) {
      const allowed = answerSet(band);
      for (let i = 0; i < 300; i += 1) {
        for (const number of buildRow(rng, band, 'r', 5).numbers) expect(allowed).toContain(number);
      }
    }
  });

  it('never repeats a number inside one row', () => {
    const rng = createRng(15);
    for (let i = 0; i < 400; i += 1) {
      const row = buildRow(rng, BANDS[2]!, `r${i}`, 5);
      expect(new Set(row.numbers).size).toBe(LANES);
    }
  });

  it('starts at the horizon, unresolved, and counts down its approach', () => {
    const row = buildRow(createRng(16), BANDS[0]!, 'r', 5);
    expect(row.progress).toBe(0);
    expect(row.resolved).toBe(false);
    expect(remaining(row)).toBeCloseTo(5, 5);
    row.progress = 0.5;
    expect(remaining(row)).toBeCloseTo(2.5, 5);
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run games/bramble/src/logic/row.test.ts`
Expected: FAIL — cannot resolve `./row.js`.

- [ ] **Step 3: Write the row**

```ts
// games/bramble/src/logic/row.ts
import type { Rng } from '@bundle/core';
import { answerSet, drawAnswer, isTrapFor, trapNumber, writeSum, type Band, type Sum } from '@bundle/math';
import { LANES } from './lanes.js';

/** What an obstacle looks like. Cosmetic: all three behave the same. */
export type ObstacleKind = 'rock' | 'bear' | 'log';

const KINDS: readonly ObstacleKind[] = ['rock', 'bear', 'log'];

export interface Row {
  readonly uid: string;
  /** One number per lane. Exactly one of them is the answer. */
  readonly numbers: readonly number[];
  readonly answerLane: number;
  readonly sum: Sum;
  readonly kinds: readonly ObstacleKind[];
  /** 0 at the horizon, 1 at the rabbit. */
  progress: number;
  approachSeconds: number;
  /** Set once the rabbit has met it, so it is only ever scored once. */
  resolved: boolean;
}

/** Seconds before this row reaches the rabbit. */
export const remaining = (row: Row): number => Math.max(0, (1 - row.progress) * row.approachSeconds);

/**
 * A wrong number for a lane: plausible, and not one already used in this row.
 * Two lanes wearing the same number would waste one of only three chances to
 * make the player read, and a number nobody could mistake for the answer lets
 * them pick by elimination without adding anything.
 */
const wrongNumber = (rng: Rng, band: Band, sum: Sum, taken: readonly number[]): number => {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const candidate = trapNumber(rng, sum, band);
    if (!taken.includes(candidate)) return candidate;
  }
  // Nothing plausible left that is not already up there: take the nearest
  // unused number the band allows rather than repeating one.
  const allowed = answerSet(band).filter((value) => !taken.includes(value) && value !== sum.answer);
  const nearest = [...allowed].sort(
    (a, b) => Math.abs(a - sum.answer) - Math.abs(b - sum.answer),
  )[0];
  return nearest ?? sum.answer;
};

export function buildRow(rng: Rng, band: Band, uid: string, approachSeconds: number): Row {
  const answer = drawAnswer(rng, band);
  // No numbers are "already in the sky" here as they are in Sky Patrol: the row
  // is built all at once, so the sum is written first and the lanes fill around
  // it.
  const sum = writeSum(rng, band, answer, []) ?? { left: answer, op: '+' as const, right: 0, answer };
  const answerLane = rng.int(LANES);

  const numbers: number[] = [];
  for (let lane = 0; lane < LANES; lane += 1) {
    numbers.push(lane === answerLane ? answer : wrongNumber(rng, band, sum, numbers));
  }

  return {
    uid,
    numbers,
    answerLane,
    sum,
    kinds: numbers.map(() => rng.pick(KINDS)),
    progress: 0,
    approachSeconds,
    resolved: false,
  };
}

/** Whether a number in a row is one a player could plausibly mistake for the answer. */
export const isPlausible = (row: Row, lane: number): boolean =>
  lane === row.answerLane || isTrapFor(row.sum, row.numbers[lane] ?? -1);
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run games/bramble/src/logic/row.test.ts && npm run typecheck`
Expected: PASS. If "both wrong lanes plausible" fails in the opening band, the answer set there is only 2–10 and a near miss may genuinely not exist — widen `isTrapFor`'s window in `@bundle/math` rather than loosening the test, and re-run Sky Patrol's suite afterwards.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(bramble): a row of three, exactly one wearing the answer

Every lane is filled, so there is never a safe one and every row is a forced
choice — the difference between a maths game and a dodging game. Both wrong
lanes are plausible, an operand first, so a child cannot pick by elimination
without adding anything."
```

---
### Task 6: Berries

A berry is the only steering choice in the game that is not an answer. It must never be able to cost fuel, or it is a trap wearing a berry's face.

**Files:**
- Create: `games/bramble/src/logic/berries.ts`, `games/bramble/src/logic/berries.test.ts`

**Interfaces:**
- Consumes: `Rng` from `@bundle/core`; `LANES` from `./lanes.js`.
- Produces: `interface Berry { uid: string; lane: number; progress: number; approachSeconds: number; taken: boolean }`, `makeBerry(rng: Rng, uid: string, approachSeconds: number): Berry`, `BERRY_LATEST_SHARE = 0.5`.

- [ ] **Step 1: Write the failing test**

```ts
// games/bramble/src/logic/berries.test.ts
import { describe, it, expect } from 'vitest';
import { createRng } from '@bundle/core';
import { LANES } from './lanes.js';
import { makeBerry, BERRY_LATEST_SHARE } from './berries.js';

describe('a berry', () => {
  it('sits in one of the lanes, at the horizon, uneaten', () => {
    const rng = createRng(3);
    for (let i = 0; i < 200; i += 1) {
      const berry = makeBerry(rng, `b${i}`, 5);
      expect(berry.lane).toBeGreaterThanOrEqual(0);
      expect(berry.lane).toBeLessThan(LANES);
      expect(berry.progress).toBe(0);
      expect(berry.taken).toBe(false);
    }
  });

  it('uses every lane sooner or later', () => {
    const rng = createRng(4);
    const seen = new Set(Array.from({ length: 300 }, (_, i) => makeBerry(rng, `b${i}`, 5).lane));
    expect(seen.size).toBe(LANES);
  });

  it('arrives early enough in the gap that taking it is always safe', () => {
    // Half the gap left after it lands, so the rabbit can always reach any lane
    // before the next row. A reward that could cost 10% is not a reward.
    expect(BERRY_LATEST_SHARE).toBeLessThanOrEqual(0.5);
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run games/bramble/src/logic/berries.test.ts`
Expected: FAIL — cannot resolve `./berries.js`.

- [ ] **Step 3: Write the berries**

```ts
// games/bramble/src/logic/berries.ts
import type { Rng } from '@bundle/core';
import { LANES } from './lanes.js';

/**
 * The latest point in the gap between rows at which a berry may land, as a
 * share of that gap. At a half, there is always at least half a gap left
 * afterwards — time to reach any lane before the next row. The choice a berry
 * offers is whether to bother, never whether to survive.
 */
export const BERRY_LATEST_SHARE = 0.5;

export interface Berry {
  readonly uid: string;
  readonly lane: number;
  /** 0 at the horizon, 1 at the rabbit. */
  progress: number;
  approachSeconds: number;
  taken: boolean;
}

export function makeBerry(rng: Rng, uid: string, approachSeconds: number): Berry {
  return { uid, lane: rng.int(LANES), progress: 0, approachSeconds, taken: false };
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run games/bramble/src/logic/berries.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(bramble): berries, and the rule that keeps them free

A berry lands no later than halfway through a gap, so taking one can never
strand the rabbit in the wrong lane when the next row arrives. A reward that
could cost 10% is a trap wearing a berry's face."
```

---

### Task 7: The run

Everything assembled: rows arriving, the rabbit steering, fuel, the stumble, berries, the band clock.

**Files:**
- Create: `games/bramble/src/logic/run.ts`, `games/bramble/src/logic/run.test.ts`

**Interfaces:**
- Consumes: `createRng`, `Rng` from `@bundle/core`; `bandAt`, `bandById`, `type Band`, `type BandId`, `type Sum` from `@bundle/math`; everything from Tasks 4–6.
- Produces: `type RunEvent`, `interface RunState`, `interface RunOptions { seed?: number; health?: number; startBand?: BandId }`, `interface Run { readonly state: RunState; step(dt: number): readonly RunEvent[]; steer(x: number): void }`, `createRun(options?): Run`, `MAX_HEALTH = 100`, `MISS_COST = 10`, `BERRY_GIVES = 10`, `STUMBLE_SECONDS = 0.8`, `currentRow(state: RunState): Row | undefined`.

- [ ] **Step 1: Write the failing test**

```ts
// games/bramble/src/logic/run.test.ts
import { describe, it, expect } from 'vitest';
import {
  createRun,
  currentRow,
  BERRY_GIVES,
  MAX_HEALTH,
  MISS_COST,
  type Run,
  type RunEvent,
} from './run.js';
import { laneCentre } from './lanes.js';

const FRAME = 1 / 60;

const run = (game: Run, seconds: number): RunEvent[] => {
  const events: RunEvent[] = [];
  for (let t = 0; t < seconds; t += FRAME) events.push(...game.step(FRAME));
  return events;
};

/** Runs until the next row is resolved, steering into the lane given. */
const meetNextRow = (game: Run, lane: (row: NonNullable<ReturnType<typeof currentRow>>) => number): RunEvent[] => {
  const events: RunEvent[] = [];
  for (let i = 0; i < 60 * 30; i += 1) {
    const row = currentRow(game.state);
    if (row) game.steer(laneCentre(lane(row)));
    const batch = game.step(FRAME);
    events.push(...batch);
    if (batch.some((event) => event.type === 'burst' || event.type === 'thump')) break;
  }
  return events;
};

describe('a run opening', () => {
  it('starts full, running, and with a sum to read', () => {
    const game = createRun({ seed: 1 });
    run(game, 1);
    expect(game.state.health).toBe(MAX_HEALTH);
    expect(game.state.status).toBe('running');
    expect(currentRow(game.state)).toBeDefined();
    expect(game.state.band.id).toBe('easy');
  });

  it('can open at a band, for ?game=bramble&level=take-aways', () => {
    const game = createRun({ seed: 2, startBand: 'take-aways' });
    run(game, 1);
    expect(game.state.band.id).toBe('take-aways');
  });

  it('keeps more than one row on the path once it is going', () => {
    const game = createRun({ seed: 3, health: 9999 });
    run(game, 12);
    expect(game.state.rows.length).toBeGreaterThanOrEqual(2);
  });
});

describe('meeting a row', () => {
  it('bursts the right one, scores, and moves on to the next sum', () => {
    const game = createRun({ seed: 4 });
    run(game, 1);
    const asked = currentRow(game.state)!.sum;
    const events = meetNextRow(game, (row) => row.answerLane);
    expect(events.some((event) => event.type === 'burst')).toBe(true);
    expect(game.state.score).toBe(1);
    expect(game.state.streak).toBe(1);
    expect(game.state.health).toBe(MAX_HEALTH);
    // A new question, not the one just answered.
    expect(currentRow(game.state)!.sum).not.toBe(asked);
  });

  it('thumps a wrong one, costs exactly a tenth, and stumbles', () => {
    const game = createRun({ seed: 5 });
    run(game, 1);
    const events = meetNextRow(game, (row) => (row.answerLane + 1) % 3);
    const thump = events.find((event) => event.type === 'thump');
    expect(thump).toBeDefined();
    expect(game.state.health).toBe(MAX_HEALTH - MISS_COST);
    expect(game.state.score).toBe(0);
    expect(game.state.streak).toBe(0);
    expect(game.state.stumble).toBeGreaterThan(0);
    // The sum that was missed is held, so the loss can be explained.
    expect(game.state.missed).not.toBeNull();
  });

  it('resolves each row exactly once', () => {
    const game = createRun({ seed: 6, health: 9999 });
    const events = run(game, 40);
    const met = events.filter((event) => event.type === 'burst' || event.type === 'thump');
    const uids = met.map((event) =>
      event.type === 'burst' || event.type === 'thump' ? event.row.uid : '',
    );
    expect(new Set(uids).size).toBe(uids.length);
  });

  it('always has a row to meet: standing still is still a choice', () => {
    const game = createRun({ seed: 7, health: 9999 });
    const events = run(game, 40);
    // Never steering still meets rows, and most of them are wrong.
    expect(events.some((event) => event.type === 'thump')).toBe(true);
  });
});

describe('berries', () => {
  it('gives back exactly a tenth, and never past full', () => {
    const game = createRun({ seed: 8, health: 9999 });
    game.state.health = 50;
    game.state.maxHealth = 100;
    let gained = false;
    for (let i = 0; i < 60 * 120 && !gained; i += 1) {
      const berry = game.state.berries[0];
      if (berry) game.steer(laneCentre(berry.lane));
      for (const event of game.step(FRAME)) {
        if (event.type !== 'berry') continue;
        expect(event.health).toBe(60);
        gained = true;
      }
    }
    expect(gained, 'no berry was ever collected').toBe(true);

    game.state.health = 95;
    for (let i = 0; i < 60 * 120; i += 1) {
      const berry = game.state.berries[0];
      if (berry) game.steer(laneCentre(berry.lane));
      game.step(FRAME);
      expect(game.state.health).toBeLessThanOrEqual(100);
    }
  });

  it('gives every berry at least half a gap before the next row', () => {
    const game = createRun({ seed: 9, health: 9999 });
    for (let i = 0; i < 60 * 180; i += 1) {
      for (const event of game.step(FRAME)) {
        if (event.type !== 'berryArrived') continue;
        // Landing this early means any lane is still reachable afterwards.
        expect(event.gapLeft).toBeGreaterThanOrEqual(game.state.tempo.rowEvery * 0.5 - 1e-6);
      }
    }
  });
});

describe('the run ending', () => {
  it('ends when the tank is empty, and stops dead', () => {
    const game = createRun({ seed: 10, health: MISS_COST });
    for (let i = 0; i < 60 * 60 && game.state.status === 'running'; i += 1) {
      const row = currentRow(game.state);
      if (row) game.steer(laneCentre((row.answerLane + 1) % 3));
      game.step(FRAME);
    }
    expect(game.state.status).toBe('over');
    expect(game.state.health).toBe(0);
    expect(run(game, 5)).toHaveLength(0);
  });

  it('counts the distance run, for the card', () => {
    const game = createRun({ seed: 11, health: 9999 });
    run(game, 30);
    expect(game.state.distance).toBeGreaterThan(0);
  });
});

describe('the clock', () => {
  it('announces a band change once', () => {
    const game = createRun({ seed: 12, health: 9999 });
    run(game, 44);
    const events = run(game, 3);
    expect(events.filter((event) => event.type === 'band')).toHaveLength(1);
  });
});

describe('steering', () => {
  it('runs to the finger rather than jumping there', () => {
    const game = createRun({ seed: 13 });
    game.steer(1);
    game.step(FRAME);
    expect(game.state.rabbitX).toBeGreaterThan(0.5);
    expect(game.state.rabbitX).toBeLessThan(1);
    for (let i = 0; i < 60; i += 1) game.step(FRAME);
    expect(game.state.rabbitX).toBeCloseTo(1, 2);
  });

  it('never leaves the path', () => {
    const game = createRun({ seed: 14 });
    game.steer(5);
    for (let i = 0; i < 120; i += 1) game.step(FRAME);
    expect(game.state.rabbitX).toBeLessThanOrEqual(1);
    game.steer(-5);
    for (let i = 0; i < 120; i += 1) game.step(FRAME);
    expect(game.state.rabbitX).toBeGreaterThanOrEqual(0);
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run games/bramble/src/logic/run.test.ts`
Expected: FAIL — cannot resolve `./run.js`.

- [ ] **Step 3: Write the run**

```ts
// games/bramble/src/logic/run.ts
import { createRng, type Rng } from '@bundle/core';
import { bandAt, bandById, type Band, type BandId, type Sum } from '@bundle/math';
import { makeBerry, BERRY_LATEST_SHARE, type Berry } from './berries.js';
import { laneAt, laneCentre } from './lanes.js';
import { buildRow, type Row } from './row.js';
import { tempoAt, type Tempo } from './tempo.js';

export type RunEvent =
  | { type: 'row'; row: Row }
  | { type: 'burst'; row: Row; lane: number; sum: Sum }
  | { type: 'thump'; row: Row; lane: number; sum: Sum; health: number }
  | { type: 'berryArrived'; berry: Berry; gapLeft: number }
  | { type: 'berry'; berry: Berry; health: number }
  | { type: 'band'; band: Band }
  | { type: 'ended'; score: number; distance: number };

export interface RunState {
  elapsed: number;
  /** The fuel the run flies on, 0 to 100. */
  health: number;
  maxHealth: number;
  score: number;
  streak: number;
  bestStreak: number;
  /** How far the rabbit has run, in paces, for the card. */
  distance: number;
  band: Band;
  tempo: Tempo;
  rows: Row[];
  berries: Berry[];
  /** Where the rabbit is, 0..1 across the path. */
  rabbitX: number;
  /** Where the finger is asking it to be. It runs there rather than jumping. */
  rabbitTarget: number;
  /** Seconds of tumble left. The world slows and the missed sum is held. */
  stumble: number;
  missed: Sum | null;
  status: 'running' | 'over';
}

export interface RunOptions {
  seed?: number;
  health?: number;
  /** Opens the run at a band's own pace, for `?game=bramble&level=take-aways`. */
  startBand?: BandId;
}

export interface Run {
  readonly state: RunState;
  step(dt: number): readonly RunEvent[];
  /** Point the rabbit somewhere across the path, 0..1. */
  steer(x: number): void;
}

/** A full tank at the start of a run. */
export const MAX_HEALTH = 100;
/** What one wrong lane costs. Ten of them and the run is over. */
export const MISS_COST = 10;
/** What a berry gives back. */
export const BERRY_GIVES = 10;
/** How long the rabbit tumbles, with the world slowed, after a wrong lane. */
export const STUMBLE_SECONDS = 0.8;
/** How much the world slows during a tumble. */
const STUMBLE_SLOWDOWN = 0.35;
/** How fast the rabbit closes on the finger. */
const STEER_RATE = 14;
/** Paces per second at a run, for the distance on the card. */
const PACE = 6;

/** The next row the rabbit has to answer. The sum it wears is this row's. */
export const currentRow = (state: RunState): Row | undefined => state.rows.find((row) => !row.resolved);

export function createRun(options: RunOptions = {}): Run {
  const rng: Rng = createRng(options.seed ?? 1);
  const opened = (options.startBand ? bandById(options.startBand)?.from : 0) ?? 0;
  let counter = 0;
  const nextUid = (kind: string): string => `${kind}-${(counter += 1)}`;

  const health = options.health ?? MAX_HEALTH;
  const state: RunState = {
    elapsed: opened,
    health,
    maxHealth: health,
    score: 0,
    streak: 0,
    bestStreak: 0,
    distance: 0,
    band: bandAt(opened),
    tempo: tempoAt(opened),
    rows: [],
    berries: [],
    rabbitX: 0.5,
    rabbitTarget: 0.5,
    stumble: 0,
    missed: null,
    status: 'running',
  };

  /** Seconds until the next row is sent, so a berry knows how much gap is left. */
  let untilNextRow = 0;
  /** Whether this gap has already had its berry. */
  let berryThisGap = false;

  const sendRow = (events: RunEvent[]): void => {
    const row = buildRow(rng, state.band, nextUid('row'), state.tempo.approachSeconds);
    state.rows.push(row);
    events.push({ type: 'row', row });
  };

  const sendBerry = (events: RunEvent[], gapLeft: number): void => {
    const berry = makeBerry(rng, nextUid('berry'), state.tempo.approachSeconds);
    state.berries.push(berry);
    events.push({ type: 'berryArrived', berry, gapLeft });
  };

  // The first row is already on its way when the run opens, so the rabbit has a
  // sum to read from the first frame rather than running at nothing.
  {
    const opening: RunEvent[] = [];
    sendRow(opening);
    untilNextRow = state.tempo.rowEvery;
  }

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

    // A tumble slows the world rather than stopping it: a runner cannot stand
    // still, but it can stagger, and the stagger is what ties the lost fuel to
    // the question it was lost on.
    if (state.stumble > 0) {
      state.stumble = Math.max(0, state.stumble - dt);
      if (state.stumble === 0) state.missed = null;
    }
    const worldDt = state.stumble > 0 ? dt * STUMBLE_SLOWDOWN : dt;
    state.distance += worldDt * PACE;

    state.rabbitX += (state.rabbitTarget - state.rabbitX) * (1 - Math.exp(-STEER_RATE * dt));

    for (const row of state.rows) row.progress += worldDt / row.approachSeconds;
    for (const berry of state.berries) berry.progress += worldDt / berry.approachSeconds;

    // Meeting a row. Every lane is occupied, so the rabbit always hits
    // something: there is no lane that is safe by default.
    for (const row of state.rows) {
      if (row.resolved || row.progress < 1) continue;
      row.resolved = true;
      const lane = laneAt(state.rabbitX);
      if (lane === row.answerLane) {
        state.score += 1;
        state.streak += 1;
        state.bestStreak = Math.max(state.bestStreak, state.streak);
        events.push({ type: 'burst', row, lane, sum: row.sum });
      } else {
        state.health = Math.max(0, state.health - MISS_COST);
        state.streak = 0;
        state.stumble = STUMBLE_SECONDS;
        state.missed = row.sum;
        events.push({ type: 'thump', row, lane, sum: row.sum, health: state.health });
      }
    }
    state.rows = state.rows.filter((row) => row.progress < 1.2);

    for (const berry of state.berries) {
      if (berry.taken || berry.progress < 1) continue;
      berry.taken = true;
      if (laneAt(state.rabbitX) !== berry.lane) continue;
      state.health = Math.min(state.maxHealth, state.health + BERRY_GIVES);
      events.push({ type: 'berry', berry, health: state.health });
    }
    state.berries = state.berries.filter((berry) => berry.progress < 1.2);

    if (state.health <= 0) {
      state.status = 'over';
      events.push({ type: 'ended', score: state.score, distance: state.distance });
      return events;
    }

    // The cadence. A berry lands in the first half of a gap, so there is always
    // time to reach any lane afterwards.
    untilNextRow -= worldDt;
    const gapLeft = untilNextRow;
    if (!berryThisGap && gapLeft <= state.tempo.rowEvery * BERRY_LATEST_SHARE && gapLeft > 0) {
      berryThisGap = true;
      if (rng.next() < state.tempo.berryChance) sendBerry(events, gapLeft);
    }
    if (untilNextRow <= 0) {
      sendRow(events);
      untilNextRow = state.tempo.rowEvery;
      berryThisGap = false;
    }

    return events;
  };

  return {
    state,
    step,
    steer(x) {
      state.rabbitTarget = Math.min(1, Math.max(0, x));
    },
  };
}

export { laneCentre };
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run games/bramble/src/logic/run.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Run the whole suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(bramble): the run — rows, fuel, berries and the stumble

Every lane of every row is occupied, so the rabbit always meets something and
standing still is a choice like any other. A wrong lane costs a tenth and the
world slows for 0.8s with the missed sum held: a runner cannot stop dead, but
it can stagger, and the stagger is what ties the lost fuel to the question."
```

---

### Task 8: The invariants, and proof the maths is load-bearing

No new production code. Every promise the spec makes becomes an executable claim about long seeded runs — including the pair that would catch this game going the way Seesaw's arcade half went.

**Files:**
- Create: `games/bramble/src/logic/invariants.test.ts`

- [ ] **Step 1: Write the invariant tests**

```ts
// games/bramble/src/logic/invariants.test.ts
import { describe, it, expect } from 'vitest';
import { answerSet, BANDS, isTrapFor } from '@bundle/math';
import { laneCentre } from './lanes.js';
import { createRun, currentRow, MAX_HEALTH, type Run } from './run.js';

const FRAME = 1 / 60;
const SEEDS = [1, 2, 3, 5, 8];
const EVERY_ALLOWED_NUMBER = new Set(BANDS.flatMap((band) => [...answerSet(band)]));

describe('a long run never breaks its promises', () => {
  it('never puts a number on the path that no sum could produce', () => {
    for (const seed of SEEDS) {
      const game = createRun({ seed, health: 99999 });
      for (let i = 0; i < 60 * 60 * 4; i += 1) {
        game.step(FRAME);
        for (const row of game.state.rows) {
          for (const number of row.numbers) expect(EVERY_ALLOWED_NUMBER.has(number)).toBe(true);
        }
      }
    }
  });

  it('always puts the answer in exactly one lane', () => {
    for (const seed of SEEDS) {
      const game = createRun({ seed, health: 99999 });
      for (let i = 0; i < 60 * 60 * 4; i += 1) {
        game.step(FRAME);
        for (const row of game.state.rows) {
          const answering = row.numbers.filter((number) => number === row.sum.answer);
          expect(answering, `${row.numbers.join(',')} for ${row.sum.answer}`).toHaveLength(1);
        }
      }
    }
  });

  it('always makes both wrong lanes plausible', () => {
    for (const seed of SEEDS) {
      const game = createRun({ seed, health: 99999 });
      for (let i = 0; i < 60 * 60 * 3; i += 1) {
        game.step(FRAME);
        for (const row of game.state.rows) {
          row.numbers.forEach((number, lane) => {
            if (lane === row.answerLane) return;
            expect(isTrapFor(row.sum, number), `${number} against ${row.sum.answer}`).toBe(true);
          });
        }
      }
    }
  });

  it('never leaves the rabbit without a sum to read', () => {
    const game = createRun({ seed: 21, health: 99999 });
    for (let i = 0; i < 60 * 60 * 6; i += 1) {
      game.step(FRAME);
      expect(currentRow(game.state)).toBeDefined();
    }
  });

  it('never sends a berry so late that taking it strands the rabbit', () => {
    for (const seed of SEEDS) {
      const game = createRun({ seed, health: 99999 });
      for (let i = 0; i < 60 * 60 * 3; i += 1) {
        for (const event of game.step(FRAME)) {
          if (event.type !== 'berryArrived') continue;
          expect(event.gapLeft).toBeGreaterThanOrEqual(game.state.tempo.rowEvery * 0.5 - 1e-6);
        }
      }
    }
  });
});

describe('the maths is load-bearing', () => {
  /** A player who reads the sum and runs into the lane wearing its answer. */
  const playWell = (game: Run, seconds: number): void => {
    for (let t = 0; t < seconds; t += FRAME) {
      const row = currentRow(game.state);
      if (row) game.steer(laneCentre(row.answerLane));
      game.step(FRAME);
    }
  };

  /** A player who never reads, and picks a lane at random for each row. */
  const playBlind = (game: Run, seconds: number): void => {
    let choice = 1;
    let lastUid = '';
    for (let t = 0; t < seconds; t += FRAME) {
      const row = currentRow(game.state);
      if (row && row.uid !== lastUid) {
        lastUid = row.uid;
        choice = Math.floor(((t * 9301 + 49297) % 233280) / 233280 * 3) % 3;
      }
      game.steer(laneCentre(choice));
      game.step(FRAME);
      if (game.state.status === 'over') return;
    }
  };

  /** A player who simply never steers. */
  const playStill = (game: Run, seconds: number): void => {
    for (let t = 0; t < seconds; t += FRAME) {
      game.step(FRAME);
      if (game.state.status === 'over') return;
    }
  };

  it('is winnable: reading the sums keeps the tank full for five minutes', () => {
    for (const seed of SEEDS) {
      const game = createRun({ seed });
      playWell(game, 300);
      expect(game.state.status, `seed ${seed}`).toBe('running');
      expect(game.state.health, `seed ${seed}`).toBe(MAX_HEALTH);
      expect(game.state.score, `seed ${seed}`).toBeGreaterThan(80);
    }
  });

  /**
   * The test this design exists to pass. Three lanes means guessing is right one
   * time in three and pays 10% on the other two, so a guesser should be finished
   * inside a minute. If this ever passes the game, the arithmetic has stopped
   * mattering — fix the game, never the test.
   */
  it('cannot be guessed: picking lanes at random empties the tank inside ninety seconds', () => {
    for (const seed of SEEDS) {
      const game = createRun({ seed });
      playBlind(game, 90);
      expect(game.state.status, `seed ${seed} guessed its way through`).toBe('over');
    }
  });

  it('cannot be ignored: never steering empties it too', () => {
    for (const seed of SEEDS) {
      const game = createRun({ seed });
      playStill(game, 90);
      expect(game.state.status, `seed ${seed} survived without steering`).toBe('over');
    }
  });
});
```

- [ ] **Step 2: Run the invariants**

Run: `npx vitest run games/bramble/src/logic/invariants.test.ts`
Expected: PASS.

When one fails, the failure is in the game, not the test:

| Failure | Where to look |
| --- | --- |
| A number no sum could produce | `buildRow`'s fallback in `wrongNumber` is reaching outside `answerSet` |
| Two lanes wearing the answer | `wrongNumber` is returning the answer — its `taken` list must include it |
| A wrong lane not plausible | `wrongNumber`'s fallback is firing too often; widen `isTrapFor` in `@bundle/math` and re-run Sky Patrol's suite |
| The rabbit with no sum | `untilNextRow` is not being reset, or rows are being filtered out before they resolve |
| **Guessing survives** | The miss cost is too small against the row rate. Check `MISS_COST` is 10 and that every lane really is occupied |
| Reading loses fuel | `laneAt` and `laneCentre` disagree, or `STEER_RATE` is too slow to cross two lanes inside one gap |

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "test(bramble): the invariants, and proof the arithmetic is load-bearing

Long seeded runs assert every promise: no unreachable number, exactly one
answer lane, both wrong lanes plausible, and no berry sent so late that taking
it strands the rabbit.

Three bots matter. One reads the sums and keeps a full tank for five minutes.
One picks lanes at random and one never steers, and both must be finished
inside ninety seconds — three lanes means guessing pays 10% two rows out of
three. If either survives, the arithmetic has stopped mattering."
```

---
### Task 9: Screen geometry and choreography

**Files:**
- Create: `games/bramble/src/view/geometry.ts`, `games/bramble/src/view/geometry.test.ts`, `games/bramble/src/view/timing.ts`

**Interfaces:**
- Consumes: `DESIGN`, `Point` from `@bundle/core`; `LANES`, `laneCentre` from `../logic/lanes.js`.
- Produces: `PATH` constants, `PATH_WIDTH`, `RUN_HEIGHT`, `pathPoint(x: number, progress: number): Point`, `laneWidth(): number`, `obstacleSize(): { width: number; height: number }`, `pathXTo(designX: number): number`; `TIMING`.

- [ ] **Step 1: Write the failing test**

```ts
// games/bramble/src/view/geometry.test.ts
import { describe, it, expect } from 'vitest';
import { DESIGN } from '@bundle/core';
import { LANES, laneCentre } from '../logic/lanes.js';
import { obstacleSize, PATH, pathPoint, pathXTo, laneWidth } from './geometry.js';

describe('the path', () => {
  it('leaves the top bar clear, so a row never starts under the fuel bar', () => {
    expect(PATH.horizonY).toBeGreaterThan(PATH.hudY + 40);
  });

  it('gives the rabbit room below the last row', () => {
    expect(PATH.rabbitY).toBeGreaterThan(PATH.horizonY);
    expect(PATH.rabbitY).toBeLessThan(DESIGN.height);
  });

  it('fits an obstacle inside its lane with room to spare', () => {
    expect(obstacleSize().width).toBeLessThan(laneWidth());
    // Big enough for a two-digit number to read across a room.
    expect(obstacleSize().width).toBeGreaterThan(110);
  });

  it('keeps every lane on screen', () => {
    for (let lane = 0; lane < LANES; lane += 1) {
      const centre = pathPoint(laneCentre(lane), 0).x;
      expect(centre - obstacleSize().width / 2).toBeGreaterThanOrEqual(0);
      expect(centre + obstacleSize().width / 2).toBeLessThanOrEqual(DESIGN.width);
    }
  });

  it('maps the path onto the screen and back', () => {
    expect(pathXTo(pathPoint(0.25, 0).x)).toBeCloseTo(0.25, 5);
    expect(pathPoint(0, 0).x).toBe(PATH.left);
    expect(pathPoint(0.5, 1).y).toBe(PATH.rabbitY);
  });

  it('clamps a touch outside the path to its edge', () => {
    expect(pathXTo(-400)).toBe(0);
    expect(pathXTo(DESIGN.width + 400)).toBe(1);
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run games/bramble/src/view/geometry.test.ts`
Expected: FAIL — cannot resolve `./geometry.js`.

- [ ] **Step 3: Write the geometry and the choreography**

```ts
// games/bramble/src/view/geometry.ts
import { DESIGN, type Point } from '@bundle/core';
import { LANES } from '../logic/lanes.js';

/**
 * Where everything sits, in design coordinates.
 *
 * The path runs straight down the screen rather than away to a horizon. In a
 * perspective runner an obstacle's number is smallest exactly when the player
 * most needs to read it and biggest when it is too late to act — the arithmetic
 * would lose to the eyesight. Straight down keeps every number full size from
 * the moment it appears.
 */
export const PATH = {
  /** The top bar: the fuel bar on the left, score on the right. */
  hudY: 46,
  /** Where a row appears. */
  horizonY: 120,
  /** Where the rabbit runs, and where a row is met. */
  rabbitY: 620,
  left: 180,
  right: DESIGN.width - 180,
  rabbitWidth: 108,
  rabbitHeight: 96,
} as const;

export const PATH_WIDTH = PATH.right - PATH.left;
export const RUN_HEIGHT = PATH.rabbitY - PATH.horizonY;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

export const pathPoint = (x: number, progress: number): Point => ({
  x: PATH.left + x * PATH_WIDTH,
  y: PATH.horizonY + progress * RUN_HEIGHT,
});

export const laneWidth = (): number => PATH_WIDTH / LANES;

/** One size for every obstacle, whatever its kind, and whatever its distance. */
export const obstacleSize = (): { width: number; height: number } => ({
  width: laneWidth() * 0.72,
  height: laneWidth() * 0.46,
});

/** Turns a touch's design x into a position across the path. */
export const pathXTo = (designX: number): number => clamp01((designX - PATH.left) / PATH_WIDTH);
```

```ts
// games/bramble/src/view/timing.ts
/**
 * How the game feels, in one place. Retuning choreography should never mean
 * hunting through the renderer.
 */
export const TIMING = {
  /** How long the burst of leaves lasts. */
  burstSeconds: 0.5,
  /** How long the solved sum hangs where the obstacle was. The teaching beat. */
  solvedSeconds: 1.0,
  /** How long the centre-screen explanation of a thump stays up. */
  thumpSeconds: 1.4,
  /** How long the fuel bar flashes after it drops. */
  flashSeconds: 0.7,
  /** How long a band's name is shown large before it flies to the top bar. */
  bandAnnounceSeconds: 2.1,
  /** The share of that spent flying up. */
  bandSettleFraction: 0.26,
  /** Beat before the card appears, so the last of the fuel is seen to go. */
  summaryDelaySeconds: 1.2,
  /** How fast the ground texture scrolls, in path-lengths per second. */
  groundScroll: 0.55,
} as const;
```

- [ ] **Step 4: Run the test and the typechecker**

Run: `npx vitest run games/bramble/src/view && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(bramble): screen geometry and choreography

The path runs straight down rather than away to a horizon. In a perspective
runner a number is smallest exactly when it most needs reading, which hands the
game to eyesight over arithmetic."
```

---

### Task 10: Drawing the rabbit, the obstacles and the berries

Vector art. No sprites exist for this game, so a theme interface with one implementation would be a seam for its own sake.

**Files:**
- Create: `games/bramble/src/view/art.ts`, `games/bramble/src/view/art.test.ts`

**Interfaces:**
- Consumes: `hand`, `label`, `Point` from `@bundle/core`; `ObstacleKind` from `../logic/row.js`; `PATH`, `obstacleSize`, `pathPoint` from `./geometry.js`.
- Produces: `drawPath(ctx, scroll: number): void`, `drawObstacle(ctx, at: Point, kind: ObstacleKind, number: number): void`, `drawBerry(ctx, at: Point): void`, `drawRabbit(ctx, x: number, options: { sum: string; stumbling: boolean; bob: number }): void`, `drawBurst(ctx, at: Point, progress: number): void`.

- [ ] **Step 1: Write the failing test**

```ts
// games/bramble/src/view/art.test.ts
import { describe, it, expect } from 'vitest';
import { depthOf, recordingContext } from '@bundle/core';
import { drawBerry, drawBurst, drawObstacle, drawPath, drawRabbit } from './art.js';

describe('drawing an obstacle', () => {
  it('writes its number on it, whatever kind it is', () => {
    for (const kind of ['rock', 'bear', 'log'] as const) {
      const { ctx, texts } = recordingContext();
      drawObstacle(ctx, { x: 400, y: 300 }, kind, 15);
      expect(texts).toContain('15');
      expect(depthOf(ctx)).toBe(0);
    }
  });

  it('draws the three kinds differently, so the path is not a row of clones', () => {
    const shapes = (['rock', 'bear', 'log'] as const).map((kind) => {
      const { ctx, calls } = recordingContext();
      drawObstacle(ctx, { x: 400, y: 300 }, kind, 9);
      return calls.join(',');
    });
    expect(new Set(shapes).size).toBe(3);
  });
});

describe('drawing the rabbit', () => {
  it('carries the sum on a sign clear of its body', () => {
    const { ctx, texts } = recordingContext();
    drawRabbit(ctx, 0.5, { sum: '6 + 9', stumbling: false, bob: 0 });
    expect(texts).toContain('6 + 9');
    expect(depthOf(ctx)).toBe(0);
  });

  it('looks different mid-tumble', () => {
    const upright = recordingContext();
    drawRabbit(upright.ctx, 0.5, { sum: '6 + 9', stumbling: false, bob: 0 });
    const tumbling = recordingContext();
    drawRabbit(tumbling.ctx, 0.5, { sum: '6 + 9', stumbling: true, bob: 0 });
    expect(tumbling.calls).toContain('rotate');
    expect(upright.calls).not.toContain('rotate');
  });
});

describe('the rest of the scenery', () => {
  it('draws the path, a berry and a burst without leaving the context saved', () => {
    const { ctx, calls } = recordingContext();
    drawPath(ctx, 0.4);
    drawBerry(ctx, { x: 300, y: 300 });
    drawBurst(ctx, { x: 300, y: 300 }, 0.5);
    expect(calls).toContain('fill');
    expect(depthOf(ctx)).toBe(0);
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run games/bramble/src/view/art.test.ts`
Expected: FAIL — cannot resolve `./art.js`.

- [ ] **Step 3: Write the art**

```ts
// games/bramble/src/view/art.ts
import { hand, label, type Point } from '@bundle/core';
import type { ObstacleKind } from '../logic/row.js';
import { obstacleSize, PATH, PATH_WIDTH, pathPoint, RUN_HEIGHT, laneWidth } from './geometry.js';
import { LANES } from '../logic/lanes.js';

/** The track, with lane lines and a texture that scrolls to say "moving". */
export function drawPath(ctx: CanvasRenderingContext2D, scroll: number): void {
  ctx.save();
  ctx.fillStyle = '#cbe6a4';
  ctx.fillRect(PATH.left, PATH.horizonY - 40, PATH_WIDTH, RUN_HEIGHT + 200);

  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 4;
  for (let lane = 1; lane < LANES; lane += 1) {
    const x = PATH.left + lane * laneWidth();
    ctx.beginPath();
    ctx.moveTo(x, PATH.horizonY - 40);
    ctx.lineTo(x, PATH.rabbitY + 160);
    ctx.stroke();
  }

  // Tufts of grass sliding down the track: the only thing on screen that says
  // the rabbit is moving rather than the world standing still.
  ctx.fillStyle = 'rgba(120,170,90,0.45)';
  const rows = 9;
  for (let i = 0; i < rows; i += 1) {
    const y = PATH.horizonY + (((i / rows + scroll) % 1) * (RUN_HEIGHT + 160)) - 40;
    for (let lane = 0; lane < LANES; lane += 1) {
      const x = PATH.left + (lane + 0.28 + 0.44 * ((i * 7) % 3) / 3) * laneWidth();
      ctx.beginPath();
      ctx.ellipse(x, y, 14, 5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

const OBSTACLE_SKIN: Record<ObstacleKind, { body: string; trim: string }> = {
  rock: { body: '#b9bec6', trim: '#7d848d' },
  bear: { body: '#a9754c', trim: '#6f4726' },
  log: { body: '#c08b5c', trim: '#8a5c33' },
};

export function drawObstacle(
  ctx: CanvasRenderingContext2D,
  at: Point,
  kind: ObstacleKind,
  number: number,
): void {
  const { width, height } = obstacleSize();
  const skin = OBSTACLE_SKIN[kind];
  ctx.save();
  ctx.translate(at.x, at.y);

  ctx.fillStyle = skin.body;
  if (kind === 'rock') {
    ctx.beginPath();
    ctx.moveTo(-width / 2, height / 2);
    ctx.lineTo(-width * 0.34, -height * 0.4);
    ctx.lineTo(width * 0.1, -height / 2);
    ctx.lineTo(width / 2, height * 0.16);
    ctx.lineTo(width * 0.3, height / 2);
    ctx.closePath();
    ctx.fill();
  } else if (kind === 'log') {
    ctx.beginPath();
    ctx.roundRect?.(-width / 2, -height / 2, width, height, height * 0.4);
    ctx.fill();
    ctx.fillStyle = skin.trim;
    ctx.beginPath();
    ctx.ellipse(-width / 2, 0, height * 0.18, height / 2, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // A bear: a round body and two ears. Cute rather than frightening — it is
    // an obstacle in a child's game, not a threat.
    ctx.beginPath();
    ctx.arc(-width * 0.26, -height * 0.34, height * 0.22, 0, Math.PI * 2);
    ctx.arc(width * 0.26, -height * 0.34, height * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, 0, width / 2, height / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = skin.trim;
    ctx.beginPath();
    ctx.ellipse(0, height * 0.18, width * 0.2, height * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  label(ctx, String(number), 0, 0, height * 0.62, 'center');
  ctx.restore();
}

export function drawBerry(ctx: CanvasRenderingContext2D, at: Point): void {
  ctx.save();
  ctx.translate(at.x, at.y);
  ctx.fillStyle = '#3f8f52';
  ctx.fillRect(-3, -30, 6, 16);
  ctx.fillStyle = '#d6335c';
  for (const [dx, dy] of [[-12, 0], [12, 0], [0, -12]] as const) {
    ctx.beginPath();
    ctx.arc(dx, dy, 15, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath();
  ctx.arc(-16, -5, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawRabbit(
  ctx: CanvasRenderingContext2D,
  x: number,
  options: { sum: string; stumbling: boolean; bob: number },
): void {
  const at = pathPoint(x, 1);
  const { rabbitWidth: w, rabbitHeight: h } = PATH;

  ctx.save();
  ctx.translate(at.x, at.y + Math.sin(options.bob * Math.PI * 2) * 5);
  if (options.stumbling) ctx.rotate(Math.sin(options.bob * 18) * 0.28);

  ctx.fillStyle = '#f4f1ea';
  // Ears first, so the body sits over them.
  ctx.beginPath();
  ctx.ellipse(-w * 0.16, -h * 0.52, w * 0.09, h * 0.26, -0.15, 0, Math.PI * 2);
  ctx.ellipse(w * 0.16, -h * 0.52, w * 0.09, h * 0.26, 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0, 0, w * 0.34, h * 0.36, 0, 0, Math.PI * 2);
  ctx.fill();
  // A tail, and an eye, which is all a rabbit needs to read as one.
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(0, h * 0.3, w * 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2b2b2b';
  ctx.beginPath();
  ctx.arc(w * 0.12, -h * 0.06, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // The sum rides on a sign above the rabbit, clear of its body — the lesson
  // from Sky Patrol, where the fighter's own nose covered the operator.
  const signWidth = Math.max(160, options.sum.length * 28);
  const signY = at.y - h * 0.95;
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.94)';
  ctx.strokeStyle = options.stumbling ? '#e8543f' : '#3f8f52';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect?.(at.x - signWidth / 2, signY - 28, signWidth, 56, 16);
  ctx.fill();
  ctx.stroke();
  ctx.font = hand(700, 42);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = options.stumbling ? '#b52d17' : '#1e2a38';
  ctx.fillText(options.sum, at.x, signY);
  ctx.restore();
}

/** Leaves flying where an obstacle burst. */
export function drawBurst(ctx: CanvasRenderingContext2D, at: Point, progress: number): void {
  ctx.save();
  ctx.globalAlpha = Math.max(0, 1 - progress);
  ctx.fillStyle = '#7bbf5a';
  for (let i = 0; i < 8; i += 1) {
    const angle = (i / 8) * Math.PI * 2;
    const distance = 20 + progress * 70;
    ctx.beginPath();
    ctx.ellipse(
      at.x + Math.cos(angle) * distance,
      at.y + Math.sin(angle) * distance,
      11, 6, angle, 0, Math.PI * 2,
    );
    ctx.fill();
  }
  ctx.restore();
}
```

- [ ] **Step 4: Run the test and the typechecker**

Run: `npx vitest run games/bramble/src/view/art.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(bramble): vector art for the rabbit, the obstacles and the berries

The sum rides on a sign above the rabbit rather than across it — the lesson
from Sky Patrol, where the fighter's own nose covered the operator. The bears
are round and earred rather than frightening: they are obstacles in a child's
game, not threats."
```

---
### Task 11: The HUD and the scene

The HUD is thin, because the fuel bar, the banner and the card live in core now. The scene turns a `RunState` into a frame and owns nothing the rules care about.

**Files:**
- Create: `games/bramble/src/view/hud.ts`, `games/bramble/src/view/hud.test.ts`
- Create: `games/bramble/src/view/scene.ts`, `games/bramble/src/view/scene.test.ts`

**Interfaces:**
- Consumes: `DESIGN`, `drawArrivingBanner`, `drawFuelBar`, `drawSummaryCard`, `label`, `type Point`, `type Size`, `fitToScreen`, `visibleBounds` from `@bundle/core`; the art from Task 10; `TIMING`, `PATH` from Tasks 9.
- Produces: `interface HudModel { health: number; score: number; streak: number; flash: number }`, `drawHud(ctx, model: HudModel): void`, `drawSolved(ctx, at: Point, text: string, progress: number): void`, `drawThump(ctx, text: string, progress: number): void`, `interface Summary { score: number; bestStreak: number; seconds: number; distance: number; best: number; beatenBest: boolean }`, `drawSummary(ctx, summary: Summary): void`; `interface SceneModel { run: RunState; sumText: string; stumbling: boolean; summary: Summary | null }`, `interface Scene`, `createScene(): Scene`.

- [ ] **Step 1: Write the failing HUD test**

```ts
// games/bramble/src/view/hud.test.ts
import { describe, it, expect } from 'vitest';
import { depthOf, recordingContext } from '@bundle/core';
import { drawHud, drawSolved, drawSummary, drawThump } from './hud.js';

describe('the top bar', () => {
  it('shows the fuel and the score', () => {
    const { ctx, texts } = recordingContext();
    drawHud(ctx, { health: 70, score: 12, streak: 0, flash: 0 });
    expect(texts).toContain('70%');
    expect(texts).toContain('12');
    expect(depthOf(ctx)).toBe(0);
  });

  it('names a streak only once it is one', () => {
    const quiet = recordingContext();
    drawHud(quiet.ctx, { health: 100, score: 2, streak: 1, flash: 0 });
    expect(quiet.texts.some((text) => text.includes('in a row'))).toBe(false);
    const hot = recordingContext();
    drawHud(hot.ctx, { health: 100, score: 9, streak: 4, flash: 0 });
    expect(hot.texts.some((text) => text.includes('4 in a row'))).toBe(true);
  });
});

describe('explaining a row', () => {
  it('writes the whole sum where the obstacle burst', () => {
    const { ctx, texts } = recordingContext();
    drawSolved(ctx, { x: 400, y: 400 }, '6 + 9 = 15', 0.2);
    expect(texts).toContain('6 + 9 = 15');
    expect(depthOf(ctx)).toBe(0);
  });

  it('says what was missed, in the middle of the screen', () => {
    const { ctx, texts } = recordingContext();
    drawThump(ctx, '6 + 9 = 15', 0.2);
    expect(texts).toContain('6 + 9 = 15');
    expect(texts.join(' ')).toContain('Bumped');
    expect(depthOf(ctx)).toBe(0);
  });
});

describe('the summary card', () => {
  it('reads as how far you ran, and says how to go again', () => {
    const { ctx, texts } = recordingContext();
    drawSummary(ctx, { score: 30, bestStreak: 11, seconds: 95, distance: 570, best: 20, beatenBest: true });
    const all = texts.join(' ');
    expect(all).toContain('30');
    expect(all).toContain('570');
    expect(all.toLowerCase()).toContain('tap');
    expect(all.toLowerCase()).not.toContain('fail');
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run games/bramble/src/view/hud.test.ts`
Expected: FAIL — cannot resolve `./hud.js`.

- [ ] **Step 3: Write the HUD**

```ts
// games/bramble/src/view/hud.ts
import { DESIGN, drawFuelBar, drawSummaryCard, hand, label, type Point } from '@bundle/core';
import { BERRY_GIVES } from '../logic/run.js';
import { PATH } from './geometry.js';

export interface HudModel {
  health: number;
  score: number;
  streak: number;
  /** 0..1 through the flash that follows a drop. */
  flash: number;
}

export function drawHud(ctx: CanvasRenderingContext2D, model: HudModel): void {
  ctx.save();
  // One notch per berry's worth, so the bar prices both a mistake and a reward.
  drawFuelBar(ctx, PATH.left, PATH.hudY - 18, { health: model.health, flash: model.flash }, BERRY_GIVES);
  label(ctx, String(model.score), DESIGN.width - PATH.left, PATH.hudY, 40, 'right');
  if (model.streak >= 3) label(ctx, `${model.streak} in a row!`, DESIGN.width / 2, PATH.hudY, 26, 'center');
  ctx.restore();
}

/**
 * The solved sum, where the obstacle burst. This is the teaching beat: the
 * child sees the whole thing finished, which is their confirmation.
 */
export function drawSolved(ctx: CanvasRenderingContext2D, at: Point, text: string, progress: number): void {
  ctx.save();
  ctx.globalAlpha = Math.max(0, 1 - progress * progress);
  ctx.translate(at.x, at.y - progress * 44);
  label(ctx, text, 0, 0, 42, 'center');
  ctx.restore();
}

/**
 * What just cost a tenth of the tank, said in the middle of the screen where
 * the player is already looking. The rabbit's sign holds it too, but this is
 * the one that gets read.
 */
export function drawThump(ctx: CanvasRenderingContext2D, text: string, progress: number): void {
  ctx.save();
  ctx.globalAlpha = progress > 0.8 ? (1 - progress) / 0.2 : 1;
  ctx.translate(DESIGN.width / 2, DESIGN.height * 0.3);
  const width = Math.max(420, text.length * 34);
  const height = 150;
  ctx.fillStyle = 'rgba(232,84,63,0.95)';
  ctx.beginPath();
  ctx.roundRect?.(-width / 2, -height / 2, width, height, 24);
  ctx.fill();
  ctx.font = hand(700, 32);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.fillText('Bumped it!', 0, -34);
  ctx.font = hand(700, 58);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, 0, 26);
  ctx.restore();
}

export interface Summary {
  score: number;
  bestStreak: number;
  seconds: number;
  distance: number;
  best: number;
  beatenBest: boolean;
}

const minutes = (seconds: number): string => {
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
};

export function drawSummary(ctx: CanvasRenderingContext2D, summary: Summary): void {
  drawSummaryCard(ctx, {
    score: summary.score,
    bestStreak: summary.bestStreak,
    seconds: summary.seconds,
    best: summary.best,
    beatenBest: summary.beatenBest,
    headline: summary.beatenBest ? 'A new best!' : 'Good running!',
    lines: [
      `Obstacles burst   ${summary.score}`,
      `Longest streak   ${summary.bestStreak}`,
      `Paces run   ${Math.round(summary.distance)}`,
      `Time running   ${minutes(summary.seconds)}`,
      `Best so far   ${summary.best}`,
    ],
  });
}
```

- [ ] **Step 4: Write the failing scene test**

```ts
// games/bramble/src/view/scene.test.ts
import { describe, it, expect } from 'vitest';
import { DESIGN, depthOf, recordingContext } from '@bundle/core';
import { sumText } from '@bundle/math';
import { createRun, currentRow } from '../logic/run.js';
import { createScene, type SceneModel } from './scene.js';

const FRAME = 1 / 60;
const SCREEN = { width: 1152, height: 768 };

const modelOf = (game: ReturnType<typeof createRun>, overrides: Partial<SceneModel> = {}): SceneModel => {
  const row = currentRow(game.state);
  return {
    run: game.state,
    sumText: row ? sumText(row.sum) : '',
    stumbling: game.state.stumble > 0,
    summary: null,
    ...overrides,
  };
};

describe('the scene', () => {
  it('draws the path, every number on it, and the sum on the rabbit', () => {
    const game = createRun({ seed: 1 });
    for (let i = 0; i < 120; i += 1) game.step(FRAME);
    const scene = createScene();
    scene.update(FRAME, modelOf(game));
    const { ctx, texts } = recordingContext();
    scene.render(ctx, SCREEN);
    expect(depthOf(ctx)).toBe(0);
    for (const row of game.state.rows) {
      for (const number of row.numbers) expect(texts).toContain(String(number));
    }
    expect(texts).toContain(sumText(currentRow(game.state)!.sum));
  });

  it('explains a thump in the middle of the screen, then lets it go', () => {
    const game = createRun({ seed: 2 });
    game.step(FRAME);
    const row = currentRow(game.state)!;
    const scene = createScene();
    scene.observe([{ type: 'thump', row, lane: 0, sum: row.sum, health: 90 }]);
    scene.update(FRAME, modelOf(game));
    const during = recordingContext();
    scene.render(during.ctx, SCREEN);
    expect(during.texts.join(' ')).toContain('Bumped it!');

    for (let i = 0; i < 180; i += 1) scene.update(FRAME, modelOf(game));
    const after = recordingContext();
    scene.render(after.ctx, SCREEN);
    expect(after.texts.join(' ')).not.toContain('Bumped it!');
  });

  it('shows the finished sum where an obstacle burst', () => {
    const game = createRun({ seed: 3 });
    game.step(FRAME);
    const row = currentRow(game.state)!;
    const scene = createScene();
    scene.observe([{ type: 'burst', row, lane: row.answerLane, sum: row.sum }]);
    scene.update(FRAME, modelOf(game));
    const { ctx, texts } = recordingContext();
    scene.render(ctx, SCREEN);
    expect(texts.some((text) => text.includes('='))).toBe(true);
  });

  it('paints past the design rect, so an odd-shaped screen has no bars', () => {
    const game = createRun({ seed: 4 });
    const scene = createScene();
    scene.update(FRAME, modelOf(game));
    const { ctx, calls } = recordingContext();
    scene.render(ctx, { width: 2600, height: 1200 });
    expect(calls).toContain('fillRect');
    expect(depthOf(ctx)).toBe(0);
  });

  it('round-trips a screen point into the design space', () => {
    const scene = createScene();
    const point = scene.toDesign({ x: 1152, y: 768 }, { width: 2304, height: 1536 });
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

- [ ] **Step 5: Write the scene**

```ts
// games/bramble/src/view/scene.ts
import { DESIGN, drawArrivingBanner, fitToScreen, visibleBounds, type Point, type Size } from '@bundle/core';
import { sumText } from '@bundle/math';
import type { RunEvent, RunState } from '../logic/run.js';
import { laneCentre } from '../logic/lanes.js';
import { drawBerry, drawBurst, drawObstacle, drawPath, drawRabbit } from './art.js';
import { drawHud, drawSolved, drawSummary, drawThump, type Summary } from './hud.js';
import { PATH, pathPoint } from './geometry.js';
import { TIMING } from './timing.js';

export interface SceneModel {
  run: RunState;
  /** The sum the rabbit wears, already written out. */
  sumText: string;
  stumbling: boolean;
  summary: Summary | null;
}

interface Fading {
  at: Point;
  text: string;
  life: number;
}

export interface Scene {
  update(dt: number, model: SceneModel): void;
  observe(events: readonly RunEvent[]): void;
  render(ctx: CanvasRenderingContext2D, screen: Size): void;
  toDesign(point: Point, screen: Size): Point;
}

export function createScene(): Scene {
  const bursts: Fading[] = [];
  const solved: Fading[] = [];
  let thump: { text: string; life: number } | null = null;
  let banner: { title: string; life: number } | null = null;
  let flash = 0;
  let scroll = 0;
  let bob = 0;
  let model: SceneModel | null = null;

  const scene: Scene = {
    observe(events) {
      for (const event of events) {
        switch (event.type) {
          case 'burst': {
            const at = pathPoint(laneCentre(event.lane), 1);
            bursts.push({ at, text: '', life: 0 });
            solved.push({ at, text: `${sumText(event.sum)} = ${event.sum.answer}`, life: 0 });
            break;
          }
          case 'thump':
            flash = TIMING.flashSeconds;
            thump = { text: `${sumText(event.sum)} = ${event.sum.answer}`, life: 0 };
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
      // The ground only scrolls while the rabbit is actually running.
      scroll += dt * TIMING.groundScroll * (next.stumbling ? 0.35 : 1);
      bob += dt * (next.stumbling ? 1.4 : 3.2);
      if (flash > 0) flash = Math.max(0, flash - dt);
      for (const entry of bursts) entry.life += dt;
      while (bursts.length > 0 && bursts[0]!.life > TIMING.burstSeconds) bursts.shift();
      for (const entry of solved) entry.life += dt;
      while (solved.length > 0 && solved[0]!.life > TIMING.solvedSeconds) solved.shift();
      if (thump) {
        thump.life += dt;
        if (thump.life > TIMING.thumpSeconds) thump = null;
      }
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

      // Meadow across everything visible, so an odd-shaped screen is filled
      // with grass rather than letterboxed.
      ctx.fillStyle = '#a8d98b';
      ctx.fillRect(bounds.left, bounds.top, bounds.right - bounds.left, bounds.bottom - bounds.top);

      drawPath(ctx, scroll);

      for (const berry of current.run.berries) {
        if (berry.taken) continue;
        drawBerry(ctx, pathPoint(laneCentre(berry.lane), berry.progress));
      }
      for (const row of current.run.rows) {
        if (row.resolved) continue;
        row.numbers.forEach((number, lane) => {
          drawObstacle(ctx, pathPoint(laneCentre(lane), row.progress), row.kinds[lane] ?? 'rock', number);
        });
      }
      for (const entry of bursts) drawBurst(ctx, entry.at, entry.life / TIMING.burstSeconds);
      for (const entry of solved) drawSolved(ctx, entry.at, entry.text, entry.life / TIMING.solvedSeconds);

      drawRabbit(ctx, current.run.rabbitX, {
        sum: current.sumText,
        stumbling: current.stumbling,
        bob,
      });

      drawHud(ctx, {
        health: current.run.health,
        score: current.run.score,
        streak: current.run.streak,
        flash: flash / TIMING.flashSeconds,
      });
      if (banner) {
        drawArrivingBanner(
          ctx,
          banner.title,
          banner.life / TIMING.bandAnnounceSeconds,
          TIMING.bandSettleFraction,
          PATH.hudY,
        );
      }
      if (thump) drawThump(ctx, thump.text, thump.life / TIMING.thumpSeconds);
      if (current.summary) drawSummary(ctx, current.summary);

      ctx.restore();
    },

    toDesign(point, screen) {
      return fitToScreen(screen).toDesign(point);
    },
  };

  return scene;
}
```

- [ ] **Step 6: Run the tests and the typechecker**

Run: `npx vitest run games/bramble/src/view && npm run typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(bramble): the HUD and the scene

The HUD is thin because the fuel bar, the banner and the card live in core. The
scene turns a RunState into a frame and owns only presentation: the bursts, the
finished sums, the ground scrolling under a rabbit that is actually running."
```

---

### Task 12: Input, sound, the driver and the module

The last of the wiring: a finger steers the rabbit, the events make noises, and the shell can mount the whole thing.

**Files:**
- Create: `games/bramble/src/view/input.ts`, `games/bramble/src/view/input.test.ts`
- Create: `games/bramble/src/audio/bramble-sounds.ts`, `games/bramble/src/audio/bramble-sounds.test.ts`
- Create: `games/bramble/src/driver.ts`, `games/bramble/src/driver.test.ts`
- Modify: `games/bramble/src/index.ts` (replacing the stub), `games/bramble/src/index.test.ts`

**Interfaces:**
- Consumes: everything above.
- Produces: `type InputIntent = { kind: 'steer'; x: number } | { kind: 'restart' }`, `createInput(canvas, scene, emit, isOver): InputHandle`; `SOUND_EVENTS`, `createBrambleSoundPack(bus): SoundPack`; `interface Driver`, `createDriver(options: { best: number; startBand?: string; seed?: number; health?: number }): Driver`; `interface BrambleTestHooks` on `session.__test`.

- [ ] **Step 1: Write the failing input test**

```ts
// games/bramble/src/view/input.test.ts
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { createRun } from '../logic/run.js';
import { createScene } from './scene.js';
import { pathXTo } from './geometry.js';
import { createInput, type InputIntent } from './input.js';

/** jsdom has no PointerEvent, so an Event wearing the fields we read will do. */
const pointer = (kind: string, x: number, y: number): Event => {
  const event = new Event(kind, { bubbles: true }) as Event & {
    clientX: number;
    clientY: number;
    pointerId: number;
  };
  event.clientX = x;
  event.clientY = y;
  event.pointerId = 1;
  return event;
};

const harness = (isOver = () => false) => {
  const canvas = document.createElement('canvas');
  Object.defineProperty(canvas, 'clientWidth', { value: 1152 });
  Object.defineProperty(canvas, 'clientHeight', { value: 768 });
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1152, height: 768 }) as DOMRect;
  const scene = createScene();
  const game = createRun({ seed: 1 });
  scene.update(1 / 60, { run: game.state, sumText: '', stumbling: false, summary: null });
  const intents: InputIntent[] = [];
  const handle = createInput(canvas, scene, (intent) => intents.push(intent), isOver);
  return { canvas, intents, handle };
};

describe('input', () => {
  it('steers to where the finger goes down', () => {
    const { canvas, intents } = harness();
    canvas.dispatchEvent(pointer('pointerdown', 300, 700));
    expect(intents).toEqual([{ kind: 'steer', x: pathXTo(300) }]);
  });

  it('follows a drag', () => {
    const { canvas, intents } = harness();
    canvas.dispatchEvent(pointer('pointerdown', 300, 700));
    canvas.dispatchEvent(pointer('pointermove', 800, 700));
    expect(intents.at(-1)).toEqual({ kind: 'steer', x: pathXTo(800) });
  });

  it('ignores a drag that never began on the canvas', () => {
    const { canvas, intents } = harness();
    canvas.dispatchEvent(pointer('pointermove', 800, 700));
    expect(intents).toHaveLength(0);
  });

  it('restarts on a tap once the run is over', () => {
    const { canvas, intents } = harness(() => true);
    canvas.dispatchEvent(pointer('pointerdown', 300, 700));
    canvas.dispatchEvent(pointer('pointerup', 300, 700));
    expect(intents).toEqual([{ kind: 'restart' }]);
  });

  it('steers with the arrow keys, for testing on a Mac', () => {
    const { intents } = harness();
    globalThis.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    expect(intents.some((intent) => intent.kind === 'steer')).toBe(true);
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

- [ ] **Step 2: Write the input**

Copy `games/sky/src/view/input.ts` and cut it down: there is no fire here, so a pointer down or move emits `{ kind: 'steer', x }` and pointer-up emits nothing (except `restart` when the run is over). Arrow keys step `keyX` by `1 / LANES` and emit a steer; space and Enter restart when over.

- [ ] **Step 3: Write the sound pack**

Copy the shape of `games/sky/src/audio/sky-sounds.ts`. The events are `burst`, `thump`, `berry`, `band`, `over`, `best`, and `hop` (a soft note each time the rabbit changes lane). Keep the same principle: a thump is a soft bump, not a buzzer — a wrong lane is a mistake to shrug at, not a telling-off.

Its test mirrors `games/sky/src/audio/sky-sounds.test.ts`: every named event plays without throwing, an unknown event is shrugged off, and a locked bus stays silent rather than throwing.

- [ ] **Step 4: Write the driver**

Mirror `games/sky/src/driver.ts`: it owns the `Run`, builds the `SceneModel` (including `sumText` from `currentRow`, and the missed sum while `stumble > 0`), holds the `Summary` once `ended` arrives, and restarts.

```ts
    model: () => {
      const row = currentRow(run.state);
      return {
        run: run.state,
        // Through the stumble the sign keeps the sum that was missed, finished,
        // so the fuel and the question are one event rather than two.
        sumText: run.state.missed
          ? `${sumText(run.state.missed)} = ${run.state.missed.answer}`
          : row
            ? sumText(row.sum)
            : '',
        stumbling: run.state.stumble > 0,
        summary,
      };
    },
```

Its test mirrors `games/sky/src/driver.test.ts`: a written-out sum from the first frame, a summary once the tank empties, `beatenBest` only when the score beats what it was given, a clean run after `restart()`, and an unrecognised band id opening at the beginning.

- [ ] **Step 5: Write the module**

Mirror `games/sky/src/index.ts`: mount a canvas, preload the sound pack, create the scene and driver, wire `createInput`, run a `createTicker` frame that steps the driver, plays the sounds, feeds `scene.observe` and `scene.update`, and renders. Persist `best` — the best score — in `host.storage`.

The `__test` hooks:

```ts
export interface BrambleTestHooks {
  step(frames?: number): void;
  steer(x: number): void;
  /** Run into the lane wearing the answer, and meet the row. */
  takeRightLane(): void;
  /** Run into a lane that is not the answer, and meet the row. */
  takeWrongLane(): void;
  sum(): string;
  health(): number;
  score(): number;
  band(): BandId;
  status(): 'running' | 'over';
  restart(): void;
}
```

`takeRightLane` and `takeWrongLane` steer to `laneCentre(...)` and step until a `burst` or `thump` arrives, so a test never has to synthesise pointer geometry.

- [ ] **Step 6: Run the whole suite, the typechecker and the build**

Run: `npm test && npm run typecheck && npm run build`
Expected: all three clean. A build failure is almost always a missing alias in `apps/shell/vite.config.ts`; the tests use `vitest.config.ts` and will not catch it.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(bramble): input, sound, the driver and the module

Bramble Dash is playable at ?game=bramble. Steering is the whole input, so a
pointer down or move is the only gesture the game has; a tap once the tank is
empty starts a new run."
```

---

### Task 13: A run played end to end

**Files:**
- Create: `games/bramble/src/integration.test.ts`

- [ ] **Step 1: Write the integration test**

```ts
// games/bramble/src/integration.test.ts
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { installCanvasStub } from '@bundle/core';
import { brambleGame } from './index.js';
import { createTestHost } from './test-host.js';
import * as sounds from './audio/bramble-sounds.js';

let restoreCanvas: () => void;
beforeAll(() => {
  restoreCanvas = installCanvasStub();
});
afterAll(() => restoreCanvas());

const mountGame = async (startLevel?: string) => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const host = createTestHost();
  const session = await brambleGame.mount(container, host, startLevel ? { startLevel } : undefined);
  return { container, host, session };
};

describe('a run played through the module', () => {
  it('opens with a sum to read and a full tank', async () => {
    const { session } = await mountGame();
    session.__test.step(10);
    expect(session.__test.sum()).toMatch(/\d/);
    expect(session.__test.health()).toBe(100);
    expect(session.__test.status()).toBe('running');
    session.unmount();
  });

  it('bursts twenty rows without losing a drop when the sums are read', async () => {
    const { session } = await mountGame();
    session.__test.step(10);
    for (let i = 0; i < 20; i += 1) session.__test.takeRightLane();
    expect(session.__test.score()).toBe(20);
    expect(session.__test.health()).toBe(100);
    session.unmount();
  });

  it('costs exactly a tenth for a wrong lane', async () => {
    const { session } = await mountGame();
    session.__test.step(10);
    session.__test.takeWrongLane();
    expect(session.__test.health()).toBe(90);
    expect(session.__test.score()).toBe(0);
    session.unmount();
  });

  it('plays the burst sound for a right lane and the bump for a wrong one', async () => {
    const played: string[] = [];
    vi.spyOn(sounds, 'createBrambleSoundPack').mockReturnValue({
      preload: async () => {},
      play: (event: string) => void played.push(event),
    });
    const { session } = await mountGame();
    session.__test.step(10);
    session.__test.takeRightLane();
    expect(played).toContain('burst');
    session.__test.takeWrongLane();
    expect(played).toContain('thump');
    session.unmount();
    vi.restoreAllMocks();
  });

  it('opens straight into a band for ?game=bramble&level=take-aways', async () => {
    const { session } = await mountGame('take-aways');
    session.__test.step(10);
    expect(session.__test.band()).toBe('take-aways');
    session.unmount();
  });

  it('ends after ten wrong lanes, and runs again', async () => {
    const { session } = await mountGame();
    session.__test.step(10);
    for (let i = 0; i < 10 && session.__test.status() === 'running'; i += 1) {
      session.__test.takeWrongLane();
    }
    expect(session.__test.status()).toBe('over');
    expect(session.__test.health()).toBe(0);

    session.__test.restart();
    session.__test.step(10);
    expect(session.__test.status()).toBe('running');
    expect(session.__test.health()).toBe(100);
    expect(session.__test.score()).toBe(0);
    session.unmount();
  });

  it('writes the best score where the next session will find it', async () => {
    const { session, host } = await mountGame();
    session.__test.step(10);
    for (let i = 0; i < 4; i += 1) session.__test.takeRightLane();
    const scored = session.__test.score();
    for (let i = 0; i < 10 && session.__test.status() === 'running'; i += 1) {
      session.__test.takeWrongLane();
    }
    expect(host.storage.get('best', 0)).toBeGreaterThanOrEqual(scored);
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

- [ ] **Step 2: Run it, then the whole suite**

Run: `npx vitest run games/bramble/src/integration.test.ts && npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "test(bramble): a run played end to end through the module

Reading the sums bursts twenty rows without losing a drop; ten wrong lanes end
the run and it can be run again. The best score is written where the next
session will find it."
```

---

### Task 14: README, and playing it

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Run everything**

Run: `npm test && npm run typecheck && npm run build`
Expected: all three clean.

- [ ] **Step 2: Play it**

```bash
npm run dev:ipad
```

Open `?game=bramble`, then `?game=bramble&level=over-ten` and `&level=take-aways`. Judge by hand what no test can see:

- The sum on the sign is readable while the rabbit is moving.
- A row's numbers can be read early enough to choose before it arrives.
- Steering feels like running, not like dragging a slider.
- A thump reads as *you picked the wrong one*, not as *the game broke*.
- The berry is a tempting detour rather than a trap — you can always still make the next lane.
- At two minutes, the rows are brisk but the numbers are still readable.

- [ ] **Step 3: Play it on the iPad**

Open `/ipad.html` on the Mac at Vite's Network address and scan the QR code with the iPad camera. In landscape, added to the Home Screen, tap once for sound. Check especially that a thumb resting at the bottom does not cover the rabbit or its sign.

- [ ] **Step 4: Write the README section**

Add `## Bramble Dash` after the Sky Patrol section: the loop and what a bump costs, the three lanes and why all of them are filled, the berry rule, the three bands (a pointer to Sky Patrol's table rather than a copy), why the view is top-down, `?game=bramble&level=<band>`, and the three bots that guard it. Add `games/bramble/` and `packages/math/` to the Layout tree, and note under "Not built yet" that Bramble Dash has vector art and synthesised sound only.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "docs: Bramble Dash

The third game: what a bump costs, why every lane is filled, the berry rule
that keeps a reward from becoming a trap, and why the path runs straight down
rather than away to a horizon."
```

---

## Self-Review

**Spec coverage.** Every section maps to a task: the loop and the fuel economy to Task 7; the row and its trap rule to Task 5; berries and their safety rule to Tasks 6 and 7; the bands to Task 1; pace and the top-down decision to Tasks 4 and 9; controls to Task 12; feel to Tasks 10 and 11; structure to Tasks 1, 2 and 3; testing to Tasks 8 and 13. The spec's "exactly one lane wears the answer" is asserted in Task 5 and again over long runs in Task 8; "a berry arrives with at least half the gap left" in Tasks 6, 7 and 8.

Two places where the plan goes beyond the spec, both deliberate:

- **Task 2 moves the HUD furniture into core.** The spec only promised to share the curriculum. The fuel bar, banner and card are identical in both games and would otherwise be written twice, so they move on the same terms — the widgets take position and wording as arguments, so core never names a plane or a rabbit.
- **`isPlausible` on a row** is exported for tests rather than used by the game. It earns its place by making the elimination rule checkable from outside.

**Placeholders.** None: every step names its files, its command and its expected result. Tasks 12's input, sound and driver steps say "mirror the Sky Patrol file" and name exactly what differs, because the shapes are genuinely identical and duplicating eighty lines of known-good code into a plan invites it to drift from the original.

**Type consistency.** `Row`, `Berry`, `Tempo`, `RunState`, `RunEvent`, `SceneModel`, `Summary`, `HudModel` and `InputIntent` are each defined once and used under the same names throughout. `currentRow(state)` (Task 7) is what Tasks 11, 12 and 13 read the live sum from; `laneCentre`/`laneAt` (Task 4) are used by the row, the run, the scene and every bot; `MISS_COST` and `BERRY_GIVES` (Task 7) are what the HUD notches and the tests are written against.
