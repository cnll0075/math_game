# Cargo Yard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Cargo Yard, the bundle's seventh game: drag weighted crates from a queue onto three trains so each is loaded to exactly its target, as crates arrive faster and faster, until the queue overflows.

**Architecture:** A pure, seeded simulation in `games/train/src/logic/` (tempo, choosing numbers, the run, bots) stepped by `dt` with no DOM. A driver wraps the run with phases (playing, paused, over), the best score and the summary. A canvas view reads the driver's model and never writes to it; drag input turns gestures into `load` intents. Art is cut from the supplied sheet by a Python script; sounds are synthesised.

**Tech Stack:** TypeScript (strict), npm workspaces, Vite 6, Vitest 2 (node and jsdom environments), canvas 2D, `@bundle/core` (createRng, createTicker, createSpring, label, drawArrivingBanner, drawSummaryCard, recordingContext, installCanvasStub, tone, noiseBurst, fitToScreen, visibleBounds, DESIGN), Python 3 with numpy and Pillow for the art script.

**Spec:** `docs/superpowers/specs/2026-10-15-cargo-yard-design.md`

## Global Constraints

- Package `@bundle/train`, folder `games/train/`, module id `'train'`, title `'Cargo Yard'`, catalog blurb `'Load the trains exactly'`.
- Design space 1152×768 (`DESIGN` from `@bundle/core`); everything is drawn in design pixels.
- Bands: `little` "Little Loads" from 0:00, targets 5–10, crates 1–5; `bigger` "Bigger Loads" from 1:00, targets 5–15, crates 1–7; `heavy` "Heavy Loads" from 2:00, targets 5–20, crates 1–9.
- Pace: a crate every 2 s at the start; every 15 s the gap is divided by 1.1; never under 0.75 s.
- Repair 5 s, then 1.5 s for a fresh train to roll in; a sent train's replacement also takes 1.5 s.
- Star train: from 0:30, about one train in eight, never two at once, 5 s to fill, target a sum of two or three queued crates; filled in time clears `floor(n/2)` crates from the end of the queue nearest the line.
- The queue holds 12 crates; the run ends when a crate arrives with no room.
- Every crate fits (weight ≤ gap) at least one waiting train when it arrives, unless no train is waiting. The three waiting trains never share a target.
- Colour of a track says nothing about its target.
- Best score (trains sent) in `host.storage` under key `'best'`. `?game=train&level=<band id>` opens a run in that band.
- Code style: match `games/fishing` and `games/sky` — named exports, `.js` import suffixes, explanatory doc comments in plain English, no default exports except the module's `export default`.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

- A crate dropped on a train that is rolling in, broken, or not a train at all must slide back with nothing changed — not vanish, not count.
- A second finger, or a tap during the summary card, must not drop or load anything; a drag that is still held when the run ends must be dropped harmlessly.
- Pausing must freeze everything that counts — the arrival clock, star countdowns, repairs — and the clock shown must not jump on resume.
- A long frame (tab in the background, an iPad waking) must not spawn a burst of crates past the end in one step without ending the run, nor skip a band banner.
- Starting in `heavy` from the URL must give a first train makeable with the first two crates (targets up to 20 but crates only up to 9).

Each line has a pinned test in its owning task (Tasks 3, 4, 7 and 9).

---

## File Structure

```
games/train/
  package.json, tsconfig.json
  assets/                       sprites cut by scripts/cut-train.py (Task 6)
  assets/source/board.png       the sheet, moved from the repo root
  src/index.ts                  GameModule + __test hooks (Task 10)
  src/driver.ts                 phases, best, summary (Task 7)
  src/intent.ts                 load / pause / next (Task 7)
  src/test-host.ts              GameHost wired to fakes (Task 1)
  src/vite-env.d.ts             (Task 1)
  src/logic/tempo.ts            bands and pace (Task 1)
  src/logic/choose.ts           targets, crates, opening, star targets (Task 2)
  src/logic/run.ts              the run (Tasks 3 and 4)
  src/logic/bot.ts              players for tests (Task 5)
  src/logic/guards.test.ts      survival guards (Task 5)
  src/view/sprites.ts           loading the cut pictures (Task 6)
  src/view/geometry.ts          where everything is (Task 8)
  src/view/timing.ts            choreography constants (Task 8)
  src/view/art.ts               drawing pieces (Task 8)
  src/view/hud.ts               top bar, cards (Task 8)
  src/view/scene.ts             the scene (Task 8)
  src/view/input.ts             drag and taps (Task 9)
  src/audio/train-sounds.ts     synthesised sounds (Task 10)
scripts/cut-train.py            (Task 6)
```

Registration (Task 1 and Task 10): `tsconfig.json` paths, `vitest.config.ts` alias, `apps/shell/vite.config.ts` alias, `apps/shell/src/catalog.ts` tile replacing the `measure` placeholder, `apps/shell/src/shell.test.ts` playable list, `README.md`.

---

### Task 1: Package, registration and the tempo

**Files:**
- Create: `games/train/package.json`, `games/train/tsconfig.json`, `games/train/src/vite-env.d.ts`, `games/train/src/test-host.ts`, `games/train/src/logic/tempo.ts`
- Test: `games/train/src/logic/tempo.test.ts`
- Modify: `tsconfig.json` (paths), `vitest.config.ts` (alias), `apps/shell/vite.config.ts` (alias)

**Interfaces:**
- Produces:
  - `type BandId = 'little' | 'bigger' | 'heavy'`
  - `interface Band { id: BandId; title: string; from: number; targets: readonly [number, number]; crates: readonly [number, number] }`
  - `BANDS: readonly Band[]`, `PACE`, `bandAt(elapsed: number): Band`, `bandById(id: string | undefined): Band | undefined`, `paceStep(elapsed: number): number`, `arrivalGap(elapsed: number): number`
  - `createTestHost(): TestHost` (storage namespace `'train'`)

- [ ] **Step 1: Scaffold the package**

`games/train/package.json`:
```json
{
  "name": "@bundle/train",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "src/index.ts"
}
```

`games/train/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src"]
}
```

`games/train/src/vite-env.d.ts`:
```ts
/// <reference types="vite/client" />
```

`games/train/src/test-host.ts` — copy `games/fishing/src/test-host.ts` exactly, changing only `store.namespace('fishing')` to `store.namespace('train')`.

Add to `tsconfig.json` `paths`: `"@bundle/train": ["games/train/src/index.ts"]`.
Add to `vitest.config.ts` alias: `'@bundle/train': resolvePath('./games/train/src/index.ts'),`.
Add to `apps/shell/vite.config.ts` alias: `'@bundle/train': resolvePath('../../games/train/src/index.ts'),`.

Run `npm install` from the repo root so the workspace links the new package.

- [ ] **Step 2: Write the failing test**

`games/train/src/logic/tempo.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { arrivalGap, bandAt, bandById, BANDS, PACE, paceStep } from './tempo.js';

describe('the bands', () => {
  it('grow the targets and the crates by the minute', () => {
    expect(bandAt(0)).toMatchObject({ id: 'little', targets: [5, 10], crates: [1, 5] });
    expect(bandAt(59.9).id).toBe('little');
    expect(bandAt(60)).toMatchObject({ id: 'bigger', targets: [5, 15], crates: [1, 7] });
    expect(bandAt(120)).toMatchObject({ id: 'heavy', targets: [5, 20], crates: [1, 9] });
    expect(bandAt(900).id).toBe('heavy');
  });

  it('are found by id, for the URL', () => {
    expect(bandById('heavy')?.from).toBe(120);
    expect(bandById('nonsense')).toBeUndefined();
    expect(bandById(undefined)).toBeUndefined();
    expect(BANDS.map((band) => band.title)).toEqual(['Little Loads', 'Bigger Loads', 'Heavy Loads']);
  });
});

describe('the pace', () => {
  it('starts at a crate every two seconds and comes ten per cent faster every fifteen', () => {
    expect(arrivalGap(0)).toBe(2);
    expect(arrivalGap(14.9)).toBe(2);
    expect(arrivalGap(15)).toBeCloseTo(2 / 1.1);
    expect(arrivalGap(30)).toBeCloseTo(2 / 1.1 ** 2);
    expect(paceStep(44.9)).toBe(2);
  });

  it('levels off at three quarters of a second, about two and a half minutes in', () => {
    expect(arrivalGap(150)).toBeGreaterThan(PACE.floorGap);
    expect(arrivalGap(165)).toBe(PACE.floorGap);
    expect(arrivalGap(10_000)).toBe(0.75);
  });
});
```

- [ ] **Step 3: Run it to see it fail**

Run: `npx vitest run games/train/src/logic/tempo.test.ts`
Expected: FAIL — cannot find module `./tempo.js`.

- [ ] **Step 4: Implement**

`games/train/src/logic/tempo.ts`:
```ts
/**
 * How the yard tightens with time. Everything here is a function of how long
 * the run has gone on, so a child who is doing well and one who is struggling
 * meet the same yard at the same minute: skill shows in how long a run lasts.
 */
export type BandId = 'little' | 'bigger' | 'heavy';

export interface Band {
  id: BandId;
  title: string;
  /** Seconds into the run it starts. */
  from: number;
  /** A new train's target is any whole number in this range. */
  targets: readonly [number, number];
  /** And a new crate's weight. */
  crates: readonly [number, number];
}

export const BANDS: readonly Band[] = [
  { id: 'little', title: 'Little Loads', from: 0, targets: [5, 10], crates: [1, 5] },
  { id: 'bigger', title: 'Bigger Loads', from: 60, targets: [5, 15], crates: [1, 7] },
  { id: 'heavy', title: 'Heavy Loads', from: 120, targets: [5, 20], crates: [1, 9] },
];

export const PACE = {
  /** Seconds between crates when the run opens. */
  startGap: 2,
  /** Every this many seconds, crates come faster, */
  stepSeconds: 15,
  /** by this much: the gap is divided by it. */
  speedUp: 1.1,
  /** And never closer together than this. */
  floorGap: 0.75,
} as const;

export const bandAt = (elapsed: number): Band => {
  let band = BANDS[0]!;
  for (const next of BANDS) if (elapsed >= next.from) band = next;
  return band;
};

export const bandById = (id: string | undefined): Band | undefined => BANDS.find((band) => band.id === id);

/** How many times the pace has stepped up. */
export const paceStep = (elapsed: number): number => Math.floor(Math.max(0, elapsed) / PACE.stepSeconds);

/** Seconds between one crate and the next, at this point in the run. */
export const arrivalGap = (elapsed: number): number =>
  Math.max(PACE.floorGap, PACE.startGap / PACE.speedUp ** paceStep(elapsed));
```

- [ ] **Step 5: Run the tests and the typecheck**

Run: `npx vitest run games/train/src/logic/tempo.test.ts && npm run typecheck`
Expected: PASS, typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add games/train tsconfig.json vitest.config.ts apps/shell/vite.config.ts package-lock.json
git commit -m "feat(train): the Cargo Yard package and its tempo

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Choosing the numbers

**Files:**
- Create: `games/train/src/logic/choose.ts`
- Test: `games/train/src/logic/choose.test.ts`

**Interfaces:**
- Consumes: `Band` from `./tempo.js`; `Rng`, `createRng` from `@bundle/core`.
- Produces:
  - `chooseTarget(rng: Rng, band: Band, taken: readonly number[]): number`
  - `chooseCrate(rng: Rng, band: Band, gaps: readonly number[]): number`
  - `openingTarget(rng: Rng, band: Band): number`
  - `openingCrates(rng: Rng, band: Band, target: number): [number, number]`
  - `starTarget(rng: Rng, band: Band, queue: readonly number[], taken: readonly number[]): number | null`

- [ ] **Step 1: Write the failing test**

`games/train/src/logic/choose.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { createRng } from '@bundle/core';
import { chooseCrate, chooseTarget, openingCrates, openingTarget, starTarget } from './choose.js';
import { BANDS, bandById } from './tempo.js';

const SEEDS = Array.from({ length: 200 }, (_, index) => index + 1);
const little = bandById('little')!;
const heavy = bandById('heavy')!;

describe('a new train', () => {
  it('takes a target in band that no waiting train has', () => {
    for (const band of BANDS) {
      for (const seed of SEEDS) {
        const target = chooseTarget(createRng(seed), band, [6, 7]);
        expect(target).toBeGreaterThanOrEqual(band.targets[0]);
        expect(target).toBeLessThanOrEqual(band.targets[1]);
        expect([6, 7]).not.toContain(target);
      }
    }
  });
});

describe('a new crate', () => {
  it('always fits some waiting train', () => {
    for (const seed of SEEDS) {
      const weight = chooseCrate(createRng(seed), heavy, [2, 3]);
      expect(weight).toBeLessThanOrEqual(3);
      expect(weight).toBeGreaterThanOrEqual(1);
    }
  });

  it('is any crate in band when the gaps are all big, or no train is waiting', () => {
    const seen = new Set<number>();
    for (const seed of SEEDS) seen.add(chooseCrate(createRng(seed), little, []));
    expect([...seen].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
    for (const seed of SEEDS) expect(chooseCrate(createRng(seed), little, [15])).toBeLessThanOrEqual(5);
  });
});

describe('the opening', () => {
  it('gives the first train a target the first two crates make, even in the heavy band', () => {
    for (const band of BANDS) {
      for (const seed of SEEDS) {
        const rng = createRng(seed);
        const target = openingTarget(rng, band);
        const [a, b] = openingCrates(rng, band, target);
        expect(a + b).toBe(target);
        for (const weight of [a, b]) {
          expect(weight).toBeGreaterThanOrEqual(band.crates[0]);
          expect(weight).toBeLessThanOrEqual(band.crates[1]);
        }
      }
    }
  });
});

describe('a star train', () => {
  it('wants a sum of two or three crates in the queue, in band and not taken', () => {
    for (const seed of SEEDS) {
      const target = starTarget(createRng(seed), little, [1, 4, 2], [5]);
      expect(target).not.toBeNull();
      // Pairs and triples of 1, 4, 2 make 3, 5, 6 and 7: 5 is taken and 3 is below the band.
      expect([6, 7]).toContain(target);
    }
  });

  it('is not offered when the queue cannot make one', () => {
    expect(starTarget(createRng(1), little, [2], [])).toBeNull();
    expect(starTarget(createRng(1), little, [1, 1], [])).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run games/train/src/logic/choose.test.ts`
Expected: FAIL — cannot find module `./choose.js`.

- [ ] **Step 3: Implement**

`games/train/src/logic/choose.ts`:
```ts
import type { Rng } from '@bundle/core';
import type { Band } from './tempo.js';

/** Every whole number from `low` to `high`. */
const span = ([low, high]: readonly [number, number]): number[] =>
  Array.from({ length: high - low + 1 }, (_, index) => low + index);

/** Any target in band that no waiting train already has, so "which train?" always has a real answer. */
export function chooseTarget(rng: Rng, band: Band, taken: readonly number[]): number {
  const free = span(band.targets).filter((target) => !taken.includes(target));
  return rng.pick(free.length > 0 ? free : span(band.targets));
}

/**
 * A crate that fits at least one waiting train: never heavier than every gap.
 * With no train waiting, any crate in band.
 */
export function chooseCrate(rng: Rng, band: Band, gaps: readonly number[]): number {
  const all = span(band.crates);
  const fitting = all.filter((weight) => gaps.some((gap) => weight <= gap));
  return rng.pick(fitting.length > 0 ? fitting : all);
}

/** The first train's target: one the first two crates can make, whatever the band. */
export function openingTarget(rng: Rng, band: Band): number {
  const [low, high] = band.crates;
  return rng.pick(span(band.targets).filter((target) => target >= low * 2 && target <= high * 2));
}

/** The first two crates of a run, which make the first train's target between them. */
export function openingCrates(rng: Rng, band: Band, target: number): [number, number] {
  const [low, high] = band.crates;
  const first = rng.pick(span(band.crates).filter((weight) => target - weight >= low && target - weight <= high));
  return [first, target - first];
}

/**
 * A star train's target: the sum of two or three crates already queued, so a
 * child who spots them can make it in time. Null when the queue cannot.
 */
export function starTarget(rng: Rng, band: Band, queue: readonly number[], taken: readonly number[]): number | null {
  const sums = new Set<number>();
  for (let a = 0; a < queue.length; a += 1) {
    for (let b = a + 1; b < queue.length; b += 1) {
      sums.add(queue[a]! + queue[b]!);
      for (let c = b + 1; c < queue.length; c += 1) sums.add(queue[a]! + queue[b]! + queue[c]!);
    }
  }
  const [low, high] = band.targets;
  const allowed = [...sums].filter((sum) => sum >= low && sum <= high && !taken.includes(sum)).sort((x, y) => x - y);
  return allowed.length > 0 ? rng.pick(allowed) : null;
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run games/train/src/logic/choose.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add games/train/src/logic/choose.ts games/train/src/logic/choose.test.ts
git commit -m "feat(train): choosing targets, crates and star targets

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The run — queue, loading, sending, breaking, repairs, the end

**Files:**
- Create: `games/train/src/logic/run.ts`
- Test: `games/train/src/logic/run.test.ts`

**Interfaces:**
- Consumes: `bandAt`, `bandById`, `arrivalGap`, `paceStep`, `Band`, `BandId` from `./tempo.js`; everything from `./choose.js`; `createRng` from `@bundle/core`.
- Produces:
  - `TRACK_COUNT = 3`, `QUEUE_SLOTS = 12`, `TIMES = { rollIn: 1.5, repair: 5, star: 5, starFrom: 30, starChance: 1 / 8, firstCrate: 0.6 }`
  - `interface Crate { id: number; weight: number }`
  - `type TrackPhase = 'rolling' | 'waiting' | 'broken'`
  - `interface Track { phase: TrackPhase; timer: number; target: number; load: number[]; star: number; train: number }`
  - `interface RunState { elapsed: number; queue: Crate[]; tracks: Track[]; sent: number; loaded: number; broken: number; untilCrate: number; band: BandId; step: number; over: boolean }`
  - `type RunEvent` (below)
  - `interface Run { readonly state: RunState; step(dt: number): RunEvent[]; load(crate: number, track: number): RunEvent[] }`
  - `createRun(options: { seed: number; startBand?: BandId }): Run`
  - `loadOf(track: Track): number`, `gapOf(track: Track): number`

```ts
export type RunEvent =
  | { type: 'crate'; crate: Crate }
  | { type: 'band'; band: Band }
  | { type: 'speed'; gap: number }
  | { type: 'arrived'; track: number; target: number; star: boolean }
  | { type: 'loaded'; track: number; crate: Crate; load: number; target: number }
  | { type: 'sent'; track: number; target: number; load: number[]; bonus: boolean }
  | { type: 'cleared'; crates: Crate[] }
  | { type: 'broke'; track: number; target: number; load: number[] }
  | { type: 'repaired'; track: number }
  | { type: 'starTick'; track: number; seconds: number }
  | { type: 'starFaded'; track: number }
  | { type: 'over'; elapsed: number; sent: number };
```

This task builds everything except star trains; `star` stays 0 here and Task 4 adds it.

- [ ] **Step 1: Write the failing tests**

`games/train/src/logic/run.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { createRun, gapOf, loadOf, QUEUE_SLOTS, TIMES, type Run, type RunEvent } from './run.js';

const FRAME = 1 / 60;
const run = (startBand?: 'little' | 'bigger' | 'heavy', seed = 3): Run => createRun({ seed, startBand });
const steps = (target: Run, seconds: number): RunEvent[] => {
  const events: RunEvent[] = [];
  for (let t = 0; t < seconds - 1e-9; t += FRAME) events.push(...target.step(FRAME));
  return events;
};
const types = (events: readonly RunEvent[]) => events.map((event) => event.type);

/** Put crates of these weights straight into the queue, for a test that needs them. */
const queue = (target: Run, weights: number[]) => {
  let id = 900;
  target.state.queue.push(...weights.map((weight) => ({ id: id++, weight })));
};

describe('the opening', () => {
  it('has three trains waiting on three different targets, and a first crate within a second', () => {
    const yard = run();
    expect(yard.state.tracks.map((track) => track.phase)).toEqual(['waiting', 'waiting', 'waiting']);
    expect(new Set(yard.state.tracks.map((track) => track.target)).size).toBe(3);
    const events = steps(yard, 1);
    expect(types(events)).toContain('crate');
  });

  it('brings first the two crates that make one train exactly, in any band', () => {
    for (const band of ['little', 'bigger', 'heavy'] as const) {
      for (let seed = 1; seed <= 30; seed += 1) {
        const yard = run(band, seed);
        steps(yard, 3);
        const [a, b] = yard.state.queue;
        expect(yard.state.tracks.some((track) => track.target === a!.weight + b!.weight)).toBe(true);
      }
    }
  });

  it('starts the clock at the band it was asked for', () => {
    expect(run('heavy').state.elapsed).toBe(120);
    expect(run().state.band).toBe('little');
  });
});

describe('the crates', () => {
  it('arrive every two seconds at first, each fitting some waiting train', () => {
    const yard = run();
    const events = steps(yard, 10.5);
    const crates = events.filter((event) => event.type === 'crate');
    expect(crates).toHaveLength(5);
    for (const event of crates) {
      if (event.type !== 'crate') continue;
      expect(yard.state.tracks.some((track) => track.phase === 'waiting' && event.crate.weight <= track.target)).toBe(true);
    }
  });

  it('end the run when one arrives with the queue full', () => {
    const yard = run();
    const events = steps(yard, 60);
    expect(yard.state.over).toBe(true);
    expect(yard.state.queue).toHaveLength(QUEUE_SLOTS);
    expect(events.filter((event) => event.type === 'over')).toHaveLength(1);
    expect(yard.step(1)).toEqual([]);
  });

  it('do not pour in past the end in one long frame', () => {
    const yard = run();
    const events = yard.step(120);
    expect(yard.state.over).toBe(true);
    expect(yard.state.queue).toHaveLength(QUEUE_SLOTS);
    expect(events.filter((event) => event.type === 'over')).toHaveLength(1);
  });
});

describe('loading', () => {
  it('puts a crate under the target on the train', () => {
    const yard = run();
    yard.state.tracks[0]!.target = 9;
    queue(yard, [4]);
    const events = yard.load(900, 0);
    expect(events).toEqual([{ type: 'loaded', track: 0, crate: { id: 900, weight: 4 }, load: 4, target: 9 }]);
    expect(yard.state.queue.find((crate) => crate.id === 900)).toBeUndefined();
    expect(gapOf(yard.state.tracks[0]!)).toBe(5);
  });

  it('sends a train loaded exactly, and rolls in a fresh one with a new target', () => {
    const yard = run();
    const track = yard.state.tracks[1]!;
    track.target = 7;
    queue(yard, [3, 4]);
    yard.load(900, 1);
    const events = yard.load(901, 1);
    expect(types(events)).toEqual(['loaded', 'sent']);
    expect(yard.state.sent).toBe(1);
    expect(track.phase).toBe('rolling');
    const arrival = steps(yard, TIMES.rollIn + 0.05).find((event) => event.type === 'arrived');
    expect(arrival).toMatchObject({ type: 'arrived', track: 1 });
    expect(track.phase).toBe('waiting');
    expect(loadOf(track)).toBe(0);
  });

  it('breaks a train loaded too heavy, keeps it out for the repair, and then rolls in a fresh one', () => {
    const yard = run();
    const track = yard.state.tracks[2]!;
    track.target = 5;
    queue(yard, [3, 4]);
    yard.load(900, 2);
    expect(types(yard.load(901, 2))).toEqual(['loaded', 'broke']);
    expect(track.phase).toBe('broken');
    expect(yard.state.broken).toBe(1);
    expect(types(steps(yard, TIMES.repair - 0.1))).not.toContain('repaired');
    expect(types(steps(yard, 0.2))).toContain('repaired');
    expect(track.phase).toBe('rolling');
    steps(yard, TIMES.rollIn);
    expect(track.phase).toBe('waiting');
  });

  it('refuses a crate for a train that is not waiting, or a crate that is not in the queue', () => {
    const yard = run();
    yard.state.tracks[0]!.phase = 'broken';
    queue(yard, [2]);
    expect(yard.load(900, 0)).toEqual([]);
    expect(yard.load(12345, 1)).toEqual([]);
    expect(yard.load(900, 7)).toEqual([]);
    expect(yard.state.queue.some((crate) => crate.id === 900)).toBe(true);
  });

  it('never gives two waiting trains the same target', () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      const yard = run('little', seed);
      for (let round = 0; round < 40; round += 1) {
        const waiting = yard.state.tracks.filter((track) => track.phase === 'waiting');
        const target = waiting[0];
        if (target) {
          queue(yard, [gapOf(target)]);
          yard.load(yard.state.queue.at(-1)!.id, yard.state.tracks.indexOf(target));
        }
        steps(yard, 0.5);
        const targets = yard.state.tracks.filter((track) => track.phase === 'waiting').map((track) => track.target);
        expect(new Set(targets).size).toBe(targets.length);
      }
    }
  });
});

describe('the clock', () => {
  it('announces each band once, and each speed-up while the pace still has room to rise', () => {
    const yard = run();
    yard.state.queue.length = 0;
    const events: RunEvent[] = [];
    for (let t = 0; t < 200; t += FRAME) {
      yard.state.queue.length = 0;
      events.push(...yard.step(FRAME));
    }
    expect(events.filter((event) => event.type === 'band').map((event) => (event.type === 'band' ? event.band.id : ''))).toEqual(['bigger', 'heavy']);
    const speeds = events.filter((event) => event.type === 'speed');
    expect(speeds.length).toBe(11);
  });

  it('announces a band even when a long frame jumps right over its start', () => {
    const yard = run();
    yard.state.queue.length = 0;
    const events = yard.step(65);
    expect(events.some((event) => event.type === 'band')).toBe(true);
  });
});
```

(The speed-up count: steps 1–10 still shrink the gap; at step 11 (165 s) `2/1.1^11 = 0.70` is floored to 0.75, which is still smaller than step 10's 0.771, so it is announced; from step 12 on the gap stays 0.75 and is not. That makes 11.)

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run games/train/src/logic/run.test.ts`
Expected: FAIL — cannot find module `./run.js`.

- [ ] **Step 3: Implement**

`games/train/src/logic/run.ts`:
```ts
import { createRng } from '@bundle/core';
import { chooseCrate, chooseTarget, openingCrates, openingTarget, starTarget } from './choose.js';
import { arrivalGap, bandAt, bandById, paceStep, type Band, type BandId } from './tempo.js';

export const TRACK_COUNT = 3;
/** How many crates fit along the floor before the marker. One more ends the run. */
export const QUEUE_SLOTS = 12;

export const TIMES = {
  /** A fresh train rolls in this long after the last one left or was mended. */
  rollIn: 1.5,
  /** The crew takes this long to mend a train that was loaded too heavy. */
  repair: 5,
  /** A star train has this long to be filled for the bonus. */
  star: 5,
  /** No star trains before this far into a run, */
  starFrom: 30,
  /** and then about one train in this many. */
  starChance: 1 / 8,
  /** The first crate comes out of the port this soon. */
  firstCrate: 0.6,
} as const;

export interface Crate {
  id: number;
  weight: number;
}

/**
 * `rolling` — no train to load: one is on its way in.
 * `waiting` — a train is in, with a target, taking crates.
 * `broken` — loaded too heavy; the crew is mending it.
 */
export type TrackPhase = 'rolling' | 'waiting' | 'broken';

export interface Track {
  phase: TrackPhase;
  /** Seconds left rolling in or being mended. */
  timer: number;
  /** What the waiting train wants. Meaningless unless waiting. */
  target: number;
  /** The crates in its wagon, by weight, in the order they went in. */
  load: number[];
  /** Seconds left to fill a star train for the bonus; 0 when it is not one. */
  star: number;
  /** Counts up with every new train, so the view can tell one train from the next. */
  train: number;
}

export interface RunState {
  /** Seconds since the start of the yard's day: a run opened in a later band starts later. */
  elapsed: number;
  /** Waiting crates, from the port end to the marker end. */
  queue: Crate[];
  tracks: Track[];
  sent: number;
  /** Crates loaded on any train, for the coach. */
  loaded: number;
  broken: number;
  untilCrate: number;
  band: BandId;
  /** How many times the pace has stepped up. */
  step: number;
  over: boolean;
}

export type RunEvent =
  | { type: 'crate'; crate: Crate }
  | { type: 'band'; band: Band }
  | { type: 'speed'; gap: number }
  | { type: 'arrived'; track: number; target: number; star: boolean }
  | { type: 'loaded'; track: number; crate: Crate; load: number; target: number }
  | { type: 'sent'; track: number; target: number; load: number[]; bonus: boolean }
  | { type: 'cleared'; crates: Crate[] }
  | { type: 'broke'; track: number; target: number; load: number[] }
  | { type: 'repaired'; track: number }
  | { type: 'starTick'; track: number; seconds: number }
  | { type: 'starFaded'; track: number }
  | { type: 'over'; elapsed: number; sent: number };

export interface Run {
  readonly state: RunState;
  step(dt: number): RunEvent[];
  /** Load the queued crate with this id onto this track. Nothing happens unless that train is waiting. */
  load(crate: number, track: number): RunEvent[];
}

export interface RunOptions {
  seed: number;
  startBand?: BandId;
}

export const loadOf = (track: Track): number => track.load.reduce((sum, weight) => sum + weight, 0);
export const gapOf = (track: Track): number => track.target - loadOf(track);

/** Longest single step the run takes; a long frame is cut into these. */
const MAX_STEP = 1 / 30;

export function createRun(options: RunOptions): Run {
  const rng = createRng(options.seed);
  const opening = bandById(options.startBand) ?? bandAt(0);
  let nextCrate = 1;

  const firstTrack = rng.int(TRACK_COUNT);
  const firstTarget = openingTarget(rng, opening);
  const tracks: Track[] = [];
  for (let index = 0; index < TRACK_COUNT; index += 1) {
    const taken = [firstTarget, ...tracks.map((track) => track.target)];
    const target = index === firstTrack ? firstTarget : chooseTarget(rng, opening, taken);
    tracks.push({ phase: 'waiting', timer: 0, target, load: [], star: 0, train: index + 1 });
  }
  let nextTrain = TRACK_COUNT + 1;
  /** The first two crates make the first train exactly: the run always opens with something to do. */
  const openers = openingCrates(rng, opening, firstTarget);

  const state: RunState = {
    elapsed: opening.from,
    queue: [],
    tracks,
    sent: 0,
    loaded: 0,
    broken: 0,
    untilCrate: TIMES.firstCrate,
    band: opening.id,
    step: paceStep(opening.from),
    over: false,
  };

  const waitingTargets = (except?: Track): number[] =>
    state.tracks.filter((track) => track !== except && track.phase === 'waiting').map((track) => track.target);

  const arrive = (track: Track, index: number, events: RunEvent[]): void => {
    const band = bandAt(state.elapsed);
    track.phase = 'waiting';
    track.timer = 0;
    track.load = [];
    track.star = 0;
    track.train = nextTrain++;
    track.target = chooseTarget(rng, band, waitingTargets(track));
    events.push({ type: 'arrived', track: index, target: track.target, star: false });
  };

  const rollIn = (track: Track): void => {
    track.phase = 'rolling';
    track.timer = TIMES.rollIn;
    track.load = [];
    track.star = 0;
  };

  const spawnCrate = (events: RunEvent[]): void => {
    if (state.queue.length >= QUEUE_SLOTS) {
      state.over = true;
      events.push({ type: 'over', elapsed: state.elapsed, sent: state.sent });
      return;
    }
    const gaps = state.tracks.filter((track) => track.phase === 'waiting').map(gapOf);
    const weight = openers.shift() ?? chooseCrate(rng, bandAt(state.elapsed), gaps);
    const crate = { id: nextCrate++, weight };
    state.queue.push(crate);
    events.push({ type: 'crate', crate });
  };

  const advance = (dt: number, events: RunEvent[]): void => {
    const before = state.elapsed;
    state.elapsed += dt;

    const band = bandAt(state.elapsed);
    if (band.id !== state.band) {
      state.band = band.id;
      events.push({ type: 'band', band });
    }
    const step = paceStep(state.elapsed);
    if (step > state.step) {
      const gap = arrivalGap(state.elapsed);
      if (gap < arrivalGap(before)) events.push({ type: 'speed', gap });
      state.step = step;
    }

    state.tracks.forEach((track, index) => {
      if (track.phase === 'waiting') return;
      track.timer -= dt;
      if (track.timer > 0) return;
      if (track.phase === 'broken') {
        rollIn(track);
        events.push({ type: 'repaired', track: index });
      } else {
        arrive(track, index, events);
      }
    });

    state.untilCrate -= dt;
    while (state.untilCrate <= 0 && !state.over) {
      spawnCrate(events);
      state.untilCrate += arrivalGap(state.elapsed);
    }
  };

  return {
    state,

    step(dt) {
      const events: RunEvent[] = [];
      let left = Math.max(0, dt);
      while (left > 1e-9 && !state.over) {
        const slice = Math.min(MAX_STEP, left);
        advance(slice, events);
        left -= slice;
      }
      return events;
    },

    load(crateId, index) {
      const track = state.tracks[index];
      const at = state.queue.findIndex((crate) => crate.id === crateId);
      if (state.over || !track || track.phase !== 'waiting' || at < 0) return [];
      const [crate] = state.queue.splice(at, 1) as [Crate];
      track.load.push(crate.weight);
      state.loaded += 1;
      const load = loadOf(track);
      const events: RunEvent[] = [{ type: 'loaded', track: index, crate, load, target: track.target }];
      if (load === track.target) {
        state.sent += 1;
        events.push({ type: 'sent', track: index, target: track.target, load: [...track.load], bonus: false });
        rollIn(track);
      } else if (load > track.target) {
        state.broken += 1;
        events.push({ type: 'broke', track: index, target: track.target, load: [...track.load] });
        track.phase = 'broken';
        track.timer = TIMES.repair;
        track.load = [];
        track.star = 0;
      }
      return events;
    },
  };
}
```

Note the band banner test: `advance` runs in slices of at most 1/30 s, so a 65 s frame passes through 60 s inside some slice and the band change is seen.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run games/train/src/logic/run.test.ts`
Expected: PASS. If `'arrive every two seconds at first'` counts 6 rather than 5, the first crate comes at 0.6 s then at 2.6, 4.6, 6.6, 8.6 — five within 10.5 s; check `untilCrate` starts at `TIMES.firstCrate` and is incremented by `arrivalGap`, not reset.

- [ ] **Step 5: Commit**

```bash
git add games/train/src/logic/run.ts games/train/src/logic/run.test.ts
git commit -m "feat(train): the run — crates, loading, sending, breaking, the end

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Star trains and the bonus

**Files:**
- Modify: `games/train/src/logic/run.ts` (`arrive`, `advance`, `load`)
- Test: `games/train/src/logic/run.test.ts` (new `describe('star trains')`)

**Interfaces:**
- Consumes: `starTarget` from `./choose.js`.
- Produces: tracks with `star > 0` while a star train waits; events `arrived { star: true }`, `starTick`, `starFaded`, `sent { bonus: true }`, `cleared`.

- [ ] **Step 1: Write the failing tests**

Append to `games/train/src/logic/run.test.ts`:
```ts
describe('star trains', () => {
  /** A run past 0:30 whose next train will be a star, given a queue that can make one. */
  const starRun = (seed = 5): Run => {
    const yard = createRun({ seed, startBand: 'bigger' });
    yard.state.queue.length = 0;
    queue(yard, [2, 3, 4, 1, 5, 2]);
    return yard;
  };

  /** Send track 0's train and step until a star train rolls in on some track. */
  const awaitStar = (yard: Run): number => {
    for (let tries = 0; tries < 400; tries += 1) {
      const index = yard.state.tracks.findIndex((track) => track.star > 0);
      if (index >= 0) return index;
      const track = yard.state.tracks.find((entry) => entry.phase === 'waiting' && entry.star === 0)!;
      const at = yard.state.tracks.indexOf(track);
      yard.state.queue.unshift({ id: 5000 + tries, weight: gapOf(track) });
      yard.load(5000 + tries, at);
      for (let t = 0; t < TIMES.rollIn + 0.1; t += FRAME) {
        yard.step(FRAME);
        yard.state.queue.splice(6);
      }
    }
    throw new Error('no star train in 400 trains');
  };

  it('come about one train in eight, never before 0:30, never two at once', () => {
    let stars = 0;
    let trains = 0;
    for (let seed = 1; seed <= 40; seed += 1) {
      const yard = starRun(seed);
      for (let round = 0; round < 30; round += 1) {
        const track = yard.state.tracks.find((entry) => entry.phase === 'waiting')!;
        yard.state.queue.unshift({ id: 7000 + round, weight: gapOf(track) });
        yard.load(7000 + round, yard.state.tracks.indexOf(track));
        const events = steps(yard, TIMES.rollIn + 0.1);
        yard.state.queue.splice(6);
        for (const event of events) {
          if (event.type !== 'arrived') continue;
          trains += 1;
          if (event.star) stars += 1;
        }
        expect(yard.state.tracks.filter((entry) => entry.star > 0).length).toBeLessThanOrEqual(1);
      }
    }
    expect(stars / trains).toBeGreaterThan(0.06);
    expect(stars / trains).toBeLessThan(0.2);

    const early = createRun({ seed: 1 });
    const events = steps(early, 29);
    expect(events.some((event) => event.type === 'arrived' && event.star)).toBe(false);
  });

  it('want a sum of two or three crates in the queue', () => {
    const yard = starRun();
    const index = awaitStar(yard);
    const weights = yard.state.queue.map((crate) => crate.weight);
    const sums = new Set<number>();
    weights.forEach((a, i) => weights.forEach((b, j) => {
      if (j <= i) return;
      sums.add(a + b);
      weights.forEach((c, k) => { if (k > j) sums.add(a + b + c); });
    }));
    expect(sums.has(yard.state.tracks[index]!.target)).toBe(true);
  });

  it('tick down five seconds, then fade into an ordinary train with the same target', () => {
    const yard = starRun();
    const index = awaitStar(yard);
    const target = yard.state.tracks[index]!.target;
    const events: RunEvent[] = [];
    for (let t = 0; t < TIMES.star + 0.1; t += FRAME) {
      events.push(...yard.step(FRAME));
      yard.state.queue.splice(6);
    }
    expect(events.filter((event) => event.type === 'starTick' && event.track === index).map((event) => (event.type === 'starTick' ? event.seconds : 0))).toEqual([4, 3, 2, 1]);
    expect(events).toContainEqual({ type: 'starFaded', track: index });
    expect(yard.state.tracks[index]).toMatchObject({ phase: 'waiting', star: 0, target });
  });

  it('filled in time, clear the half of the queue nearest the line', () => {
    const yard = starRun();
    const index = awaitStar(yard);
    const track = yard.state.tracks[index]!;
    yard.state.queue.length = 0;
    queue(yard, [1, 1, 1, 1, 1, 1, track.target]);
    const filler = yard.state.queue.at(-1)!;
    const events = yard.load(filler.id, index);
    expect(events).toContainEqual(expect.objectContaining({ type: 'sent', bonus: true }));
    const cleared = events.find((event) => event.type === 'cleared');
    // Six left after the filler went; half of them, the three nearest the line, go.
    expect(cleared).toEqual({ type: 'cleared', crates: [{ id: 903, weight: 1 }, { id: 904, weight: 1 }, { id: 905, weight: 1 }] });
    expect(yard.state.queue.map((crate) => crate.id)).toEqual([900, 901, 902]);
  });

  it('too heavy, break like any other train, and leave no star behind', () => {
    const yard = starRun();
    const index = awaitStar(yard);
    const track = yard.state.tracks[index]!;
    queue(yard, [track.target + 1]);
    const events = yard.load(yard.state.queue.at(-1)!.id, index);
    expect(events.map((event) => event.type)).toEqual(['loaded', 'broke']);
    expect(track.star).toBe(0);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run games/train/src/logic/run.test.ts -t "star trains"`
Expected: FAIL — `no star train in 400 trains`.

- [ ] **Step 3: Implement**

In `run.ts`, replace `arrive` with:
```ts
  const arrive = (track: Track, index: number, events: RunEvent[]): void => {
    const band = bandAt(state.elapsed);
    const taken = waitingTargets(track);
    track.phase = 'waiting';
    track.timer = 0;
    track.load = [];
    track.star = 0;
    track.train = nextTrain++;
    // A star train now and then, once the run is under way, one at a time,
    // and only when the queue already holds crates that make its target.
    const starAllowed =
      state.elapsed >= TIMES.starFrom && !state.tracks.some((other) => other.star > 0) && rng.next() < TIMES.starChance;
    const star = starAllowed ? starTarget(rng, band, state.queue.map((crate) => crate.weight), taken) : null;
    if (star !== null) {
      track.target = star;
      track.star = TIMES.star;
    } else {
      track.target = chooseTarget(rng, band, taken);
    }
    events.push({ type: 'arrived', track: index, target: track.target, star: star !== null });
  };
```

In `advance`, replace the tracks loop's early return for waiting tracks with the star countdown:
```ts
    state.tracks.forEach((track, index) => {
      if (track.phase === 'waiting') {
        if (track.star <= 0) return;
        const shown = Math.ceil(track.star);
        track.star = Math.max(0, track.star - dt);
        const now = Math.ceil(track.star);
        if (track.star <= 0) {
          events.push({ type: 'starFaded', track: index });
        } else if (now < shown) {
          events.push({ type: 'starTick', track: index, seconds: now });
        }
        return;
      }
      track.timer -= dt;
      if (track.timer > 0) return;
      if (track.phase === 'broken') {
        rollIn(track);
        events.push({ type: 'repaired', track: index });
      } else {
        arrive(track, index, events);
      }
    });
```

In `load`, replace the exact branch with:
```ts
      if (load === track.target) {
        const bonus = track.star > 0;
        state.sent += 1;
        events.push({ type: 'sent', track: index, target: track.target, load: [...track.load], bonus });
        if (bonus) {
          // The half of the queue nearest the line, rounding down: seven leave four.
          const crates = state.queue.splice(state.queue.length - Math.floor(state.queue.length / 2));
          events.push({ type: 'cleared', crates });
        }
        rollIn(track);
      }
```

(`rollIn` and the broken branch already set `track.star = 0`.)

- [ ] **Step 4: Run all run tests**

Run: `npx vitest run games/train/src/logic`
Expected: PASS. If the star share lands outside 0.06–0.2, check `starTarget` is only consulted when `starAllowed`, so a refused draw does not re-roll.

- [ ] **Step 5: Commit**

```bash
git add games/train/src/logic/run.ts games/train/src/logic/run.test.ts
git commit -m "feat(train): star trains, and the bonus that clears half the queue

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Bots and the guards

**Files:**
- Create: `games/train/src/logic/bot.ts`
- Test: `games/train/src/logic/bot.test.ts`, `games/train/src/logic/guards.test.ts`

**Interfaces:**
- Consumes: `Run`, `RunState`, `gapOf`, `createRun` from `./run.js`; `createRng`, `Rng` from `@bundle/core`.
- Produces:
  - `type Policy = 'careful' | 'random' | 'idle'`
  - `interface Move { crate: number; track: number }`
  - `chooseMove(state: RunState, policy: Policy, rng: Rng): Move | null`
  - `playOut(run: Run, policy: Policy, options?: { every?: number; seed?: number; maxSeconds?: number }): { seconds: number; sent: number; broken: number }`

- [ ] **Step 1: Write the failing tests**

`games/train/src/logic/bot.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { createRng } from '@bundle/core';
import { chooseMove } from './bot.js';
import { createRun } from './run.js';

const yardWith = (targets: number[], loads: number[][], weights: number[]) => {
  const run = createRun({ seed: 1 });
  run.state.tracks.forEach((track, index) => {
    track.target = targets[index]!;
    track.load = loads[index]!;
  });
  run.state.queue = weights.map((weight, index) => ({ id: index + 1, weight }));
  return run.state;
};

describe('the careful bot', () => {
  it('fills a gap exactly when it can', () => {
    const state = yardWith([9, 10, 12], [[5], [], []], [2, 4, 3]);
    expect(chooseMove(state, 'careful', createRng(1))).toEqual({ crate: 2, track: 0 });
  });

  it('otherwise loads the biggest crate that fits somewhere', () => {
    const state = yardWith([9, 10, 12], [[], [], []], [2, 4, 3]);
    expect(chooseMove(state, 'careful', createRng(1))).toMatchObject({ crate: 2 });
  });

  it('goes for a star train first', () => {
    const state = yardWith([9, 10, 12], [[], [], []], [2, 4, 3, 6]);
    state.tracks[2]!.star = 3;
    state.tracks[2]!.target = 10;
    expect(chooseMove(state, 'careful', createRng(1))).toMatchObject({ track: 2 });
  });

  it('never breaks a train', () => {
    const state = yardWith([5, 6, 7], [[4], [5], [6]], [3, 4]);
    expect(chooseMove(state, 'careful', createRng(1))).toBeNull();
  });
});
```

`games/train/src/logic/guards.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { playOut } from './bot.js';
import { createRun } from './run.js';

const SEEDS = Array.from({ length: 12 }, (_, index) => index + 1);
const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;

/**
 * The tests that keep the yard fair. A child who loads well, at a child's
 * pace, must last a good while; a child who freezes must not be left watching
 * for long; and loading without reading the numbers must cost dearly. If any
 * of these stops holding, retune the yard, never the test.
 */
describe('the guards', () => {
  const careful = SEEDS.map((seed) => playOut(createRun({ seed }), 'careful', { every: 1.2, seed }));

  it('a careful player loading a crate every 1.2 seconds lasts at least two minutes', () => {
    const lasted = careful.filter((result) => result.seconds >= 120);
    expect(lasted.length, careful.map((result) => Math.round(result.seconds)).join(', ')).toBeGreaterThanOrEqual(SEEDS.length - 2);
    for (const result of careful) expect(result.broken).toBe(0);
  });

  it('a player who does nothing is out in under thirty seconds', () => {
    for (const seed of SEEDS) expect(playOut(createRun({ seed }), 'idle').seconds).toBeLessThan(30);
  });

  it('loading without reading the numbers breaks trains and ends much sooner', () => {
    const random = SEEDS.map((seed) => playOut(createRun({ seed }), 'random', { every: 1.2, seed }));
    expect(mean(random.map((result) => result.broken))).toBeGreaterThan(3);
    expect(mean(random.map((result) => result.seconds))).toBeLessThan(mean(careful.map((result) => result.seconds)) * 0.6);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run games/train/src/logic/bot.test.ts games/train/src/logic/guards.test.ts`
Expected: FAIL — cannot find module `./bot.js`.

- [ ] **Step 3: Implement**

`games/train/src/logic/bot.ts`:
```ts
import { createRng, type Rng } from '@bundle/core';
import { gapOf, type Run, type RunState } from './run.js';

/**
 * Players for the tests. `careful` reads every number: a star train first,
 * then a crate that fills a gap exactly, then the biggest crate that fits, and
 * never one that is too heavy. `random` loads without reading. `idle` freezes.
 */
export type Policy = 'careful' | 'random' | 'idle';

export interface Move {
  crate: number;
  track: number;
}

export function chooseMove(state: RunState, policy: Policy, rng: Rng): Move | null {
  if (policy === 'idle' || state.queue.length === 0) return null;
  const waiting = state.tracks.flatMap((track, index) => (track.phase === 'waiting' ? [{ track, index }] : []));
  if (waiting.length === 0) return null;
  if (policy === 'random') return { crate: rng.pick(state.queue).id, track: rng.pick(waiting).index };

  const moves = waiting.flatMap(({ track, index }) =>
    state.queue.filter((crate) => crate.weight <= gapOf(track)).map((crate) => ({ crate, track, index })),
  );
  if (moves.length === 0) return null;
  const score = ({ crate, track }: (typeof moves)[number]): number =>
    (track.star > 0 ? 1000 : 0) + (crate.weight === gapOf(track) ? 100 : 0) + crate.weight;
  const best = moves.reduce((top, move) => (score(move) > score(top) ? move : top));
  return { crate: best.crate.id, track: best.index };
}

export interface PlayOptions {
  /** Seconds between moves: a child's pace, not a bot's. */
  every?: number;
  seed?: number;
  maxSeconds?: number;
}

/** Play a run out with a policy. Returns how long it lasted, and what happened. */
export function playOut(run: Run, policy: Policy, options: PlayOptions = {}): { seconds: number; sent: number; broken: number } {
  const every = options.every ?? 1.2;
  const rng = createRng(options.seed ?? 1);
  const opened = run.state.elapsed;
  const dt = 1 / 60;
  let wait = every;
  for (let t = 0; t < (options.maxSeconds ?? 900) && !run.state.over; t += dt) {
    wait -= dt;
    if (wait <= 0) {
      const move = chooseMove(run.state, policy, rng);
      if (move) {
        run.load(move.crate, move.track);
        wait = every;
      }
    }
    run.step(dt);
  }
  return { seconds: run.state.elapsed - opened, sent: run.state.sent, broken: run.state.broken };
}
```

- [ ] **Step 4: Run them, and tune if a guard fails**

Run: `npx vitest run games/train/src/logic`
Expected: PASS.

If `a careful player ... lasts at least two minutes` fails, print the survival times (the assertion message lists them). The spec fixes the pace, so tune only what the spec leaves open, in this order, re-running after each:
1. In `chooseCrate`, give a weight that exactly fills some gap double the chance (push it into `fitting` twice).
2. Raise `TIMES.starChance` from 1/8 to 1/6.

Record any change in the spec's Pace or Star train section in the same commit.

- [ ] **Step 5: Commit**

```bash
git add games/train/src/logic
git commit -m "test(train): bots, and the guards that keep the yard fair

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: The art

**Files:**
- Move: `Colorful Train Cargo Game Asset Sheet.png` → `games/train/assets/source/board.png` (`git mv` is not possible for an untracked file: use `mkdir -p` and `mv`, then `git add`)
- Create: `scripts/cut-train.py`, `games/train/assets/*.png`, `games/train/assets/backdrop.jpg`
- Create: `games/train/src/view/sprites.ts`
- Test: `games/train/src/view/sprites.test.ts`

**Interfaces:**
- Produces:
  - `type SpriteName` (every name in the script's `SPRITES` plus `'backdrop'` and `'sign'`)
  - `type Sprites = Record<SpriteName, HTMLImageElement | null>`
  - `loadSprites(): { sprites: Sprites; ready: Promise<void> }`, `NO_SPRITES: Sprites`

The sheet is 1536×1024. All boxes below are in sheet pixels and were measured on it; the script refuses any other size. The trains on the sheet face **left** (engine on the left); the yard's trains face right, so the script flips them.

- [ ] **Step 1: Move the sheet**

```bash
mkdir -p games/train/assets/source
mv "Colorful Train Cargo Game Asset Sheet.png" games/train/assets/source/board.png
```

- [ ] **Step 2: Write the cutting script**

`scripts/cut-train.py` — start from `scripts/cut-fishing.py`'s helpers (`whiteish`, `flood_from_edges`, `keep_largest`, and its feathered-alpha `cut` function): copy those functions unchanged. Then:

```python
"""Cut the train asset sheet into the pieces Cargo Yard draws.

The sheet (1536x1024) holds an example scene, three trains, their broken and
leaving states, ten cargo pieces, four workers, a broken track, props, UI
pieces and effect icons, each on white. Every sprite is cut by flooding the
white in from the edge of its box. Out of the scene comes `backdrop.jpg`, with
its trains, signs and HUD painted out so the game can draw its own, and
`sign.png`, the red train's sign with its number wiped.

Usage: python3 scripts/cut-train.py   (needs numpy and Pillow)
"""

SOURCE = 'games/train/assets/source/board.png'
OUT = 'games/train/assets'

# name: (left, top, right, bottom) on the sheet. Trains are flipped to face right.
SPRITES = {
    'train-red': (902, 56, 1198, 154),
    'train-blue': (902, 222, 1198, 318),
    'train-green': (902, 382, 1202, 478),
    'train-broken': (1258, 156, 1502, 304),
    'train-leaving': (1268, 330, 1504, 452),
    'cargo-1': (28, 562, 102, 642),
    'cargo-2': (126, 558, 210, 642),
    'cargo-3': (233, 558, 320, 642),
    'cargo-4': (343, 558, 430, 642),
    'cargo-5': (458, 553, 532, 642),
    'cargo-6': (20, 707, 112, 792),
    'cargo-7': (128, 707, 220, 788),
    'cargo-8': (238, 703, 327, 792),
    'cargo-9': (348, 703, 437, 792),
    'cargo-10': (453, 703, 542, 792),
    'worker-wrench': (578, 572, 662, 692),
    'worker-carry': (683, 577, 782, 672),
    'worker-wheel': (598, 697, 732, 812),
    'worker-clipboard': (752, 687, 817, 812),
    'broken-track': (858, 600, 1052, 752),
    'station': (1083, 578, 1272, 722),
    'crane': (1298, 578, 1387, 702),
    'crate-stack': (1438, 602, 1517, 662),
    'barrier': (1368, 668, 1442, 712),
    'signal': (1472, 678, 1508, 752),
    'lighthouse': (1188, 708, 1292, 832),
    'seagull': (1403, 762, 1452, 817),
    'pill': (13, 878, 137, 942),
    'stopwatch': (148, 878, 197, 937),
    'pause': (283, 948, 327, 987),
    'progress': (303, 878, 487, 927),
    'repair': (523, 878, 577, 932),
    'hazard': (578, 883, 702, 922),
    'tick': (748, 893, 797, 942),
    'cross': (823, 893, 872, 942),
    'warning': (893, 888, 942, 937),
    'star': (960, 888, 1008, 937),
    'bolt': (1023, 883, 1082, 937),
}
FLIP = {'train-red', 'train-blue', 'train-green', 'train-broken', 'train-leaving'}

# The scene, and what is painted out of it, each by copying a patch of the
# same scene from `dx` pixels to the side: the track rows are regular, so a
# train is replaced by the empty track beside it.
SCENE_BOX = (16, 36, 868, 503)
PAINT_OUT = [
    # (left, top, right, bottom, dx): fill this box from the box shifted by dx.
    (356, 182, 462, 262, -112),   # red train, back half: from the empty track to its left
    (462, 182, 562, 262, 140),    # red train, front half: from between it and the sign
    (356, 268, 462, 346, -112),   # blue train
    (462, 268, 562, 346, 140),
    (356, 352, 462, 430, -112),   # green train
    (462, 352, 562, 430, 140),
    (700, 222, 780, 272, -90),    # the three signs
    (700, 293, 780, 346, -90),
    (700, 360, 780, 412, -90),
    (426, 462, 552, 486, 140),    # "Overflow Line"
    (368, 46, 542, 100, -190),    # the HUD pills: sky from their left
    (562, 46, 680, 100, -190),
    (804, 44, 860, 98, -60),
]
SIGN_BOX = (703, 224, 778, 270)
SIGN_NUMBER = (735, 230, 774, 262)   # wiped with the sign's own dark fill
SIGN_FILL = (58, 58, 66)
```

Then a `main()` that: checks the sheet is 1536×1024; cuts each `SPRITES` entry (flipping those in `FLIP` with `Image.FLIP_LEFT_RIGHT`) to `OUT/<name>.png`; makes `backdrop.jpg` by cropping `SCENE_BOX` and, for each `PAINT_OUT` entry in order, pasting `scene.crop((l+dx, t, r+dx, b))` at `(l, t)` (in sheet coordinates, before the crop), saving at quality 90; makes `sign.png` by cutting `SIGN_BOX` from the **original** sheet, filling `SIGN_NUMBER` with `SIGN_FILL`, and flood-cutting it like a sprite.

- [ ] **Step 3: Run it and look at every piece**

```bash
python3 -m venv /tmp/cut-venv && /tmp/cut-venv/bin/pip -q install numpy pillow
/tmp/cut-venv/bin/python scripts/cut-train.py
```

Open `games/train/assets/backdrop.jpg` and a contact sheet of the PNGs (compose them on a mid-blue background with Pillow and view the image). Check:
- no train, sign, HUD pill or "Overflow Line" text left in the backdrop, and no obvious seams along the tracks;
- every sprite whole, nothing from a neighbour, white gone from around it but not from inside (the jellyfish-style rule: white *inside* an outline stays).

Adjust a box by a few pixels where a piece is clipped or carries a neighbour, and re-run. This step is done when every piece looks right.

- [ ] **Step 4: Write the failing sprite test**

`games/train/src/view/sprites.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { loadSprites } from './sprites.js';

describe('the sprites', () => {
  it('knows every picture cut from the sheet, and settles without a browser to load in', async () => {
    const { sprites, ready } = loadSprites();
    await ready;
    for (const name of ['backdrop', 'sign', 'train-red', 'train-blue', 'train-green', 'cargo-1', 'cargo-10', 'worker-wrench', 'broken-track', 'star', 'bolt', 'signal']) {
      expect(sprites).toHaveProperty(name, null);
    }
  });
});
```

- [ ] **Step 5: Implement `sprites.ts`**

Copy `games/fishing/src/view/sprites.ts` and replace the `SpriteName` union with:
```ts
export type SpriteName =
  | 'backdrop'
  | 'sign'
  | 'train-red'
  | 'train-blue'
  | 'train-green'
  | 'train-broken'
  | 'train-leaving'
  | `cargo-${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10}`
  | 'worker-wrench'
  | 'worker-carry'
  | 'worker-wheel'
  | 'worker-clipboard'
  | 'broken-track'
  | 'station'
  | 'crane'
  | 'crate-stack'
  | 'barrier'
  | 'signal'
  | 'lighthouse'
  | 'seagull'
  | 'pill'
  | 'stopwatch'
  | 'pause'
  | 'progress'
  | 'repair'
  | 'hazard'
  | 'tick'
  | 'cross'
  | 'warning'
  | 'star'
  | 'bolt';
```
and its doc comment's script name to `scripts/cut-train.py`. Remove the `import type { ItemId, SpeciesId }` line.

- [ ] **Step 6: Run the test**

Run: `npx vitest run games/train/src/view/sprites.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add scripts/cut-train.py games/train/assets games/train/src/view/sprites.ts games/train/src/view/sprites.test.ts
git commit -m "feat(train): the art, cut from the asset sheet

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Intents and the driver

**Files:**
- Create: `games/train/src/intent.ts`, `games/train/src/driver.ts`, `games/train/src/view/timing.ts`
- Test: `games/train/src/driver.test.ts`

**Interfaces:**
- Consumes: `createRun`, `Run`, `RunEvent`, `RunState` from `./logic/run.js`; `bandAt`, `bandById`, `Band` from `./logic/tempo.js`.
- Produces:
  - `type Intent = { kind: 'load'; crate: number; track: number } | { kind: 'pause' } | { kind: 'next' }`
  - `type Phase = 'playing' | 'paused' | 'over'`
  - `interface Summary { sent: number; seconds: number; best: number; beatenBest: boolean }`
  - `type DriverEvent = RunEvent | { type: 'start'; band: Band } | { type: 'paused' } | { type: 'resumed' }`
  - `interface SceneModel { run: RunState; phase: Phase; since: number; seconds: number; summary: Summary | null; coach: boolean }`
  - `interface Driver { readonly phase: Phase; readonly run: Run; readonly summary: Summary | null; readonly readyForNext: boolean; step(dt: number): DriverEvent[]; act(intent: Intent): DriverEvent[]; model(): SceneModel }`
  - `createDriver(options: { best: number; startBand?: string; seed?: () => number }): Driver`
  - `TIMING` with `bannerSeconds: 2.4`, `bannerSettleFraction: 0.3`, `overHoldSeconds: 1.2`, `floatSeconds: 1.2`, `coachSeconds: 20`

- [ ] **Step 1: Write the failing tests**

`games/train/src/driver.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { createDriver, type DriverEvent } from './driver.js';
import { gapOf } from './logic/run.js';
import { TIMING } from './view/timing.js';

const FRAME = 1 / 60;
const steps = (driver: ReturnType<typeof createDriver>, seconds: number): DriverEvent[] => {
  const events: DriverEvent[] = [];
  for (let t = 0; t < seconds - 1e-9; t += FRAME) events.push(...driver.step(FRAME));
  return events;
};

describe('the driver', () => {
  it('opens with the band banner, and loads what it is told', () => {
    const driver = createDriver({ best: 0, seed: () => 4 });
    const events = steps(driver, 3);
    expect(events[0]).toMatchObject({ type: 'start', band: { id: 'little' } });
    const state = driver.run.state;
    const index = state.tracks.findIndex((track) => track.target === state.queue[0]!.weight + state.queue[1]!.weight);
    driver.act({ kind: 'load', crate: state.queue[0]!.id, track: index });
    const sent = driver.act({ kind: 'load', crate: state.queue[0]!.id, track: index });
    expect(sent.map((event) => event.type)).toContain('sent');
  });

  it('opens in the band from the URL, and at the beginning for anything else', () => {
    expect(createDriver({ best: 0, startBand: 'heavy', seed: () => 1 }).run.state.band).toBe('heavy');
    expect(createDriver({ best: 0, startBand: 'nope', seed: () => 1 }).run.state.band).toBe('little');
  });

  it('pauses everything that counts, and the clock does not jump on resuming', () => {
    const driver = createDriver({ best: 0, seed: () => 4 });
    steps(driver, 1);
    driver.act({ kind: 'pause' });
    const before = { elapsed: driver.run.state.elapsed, queue: driver.run.state.queue.length, until: driver.run.state.untilCrate };
    expect(steps(driver, 10)).toEqual([]);
    expect(driver.run.state.elapsed).toBe(before.elapsed);
    expect(driver.run.state.queue.length).toBe(before.queue);
    expect(driver.act({ kind: 'load', crate: driver.run.state.queue[0]!.id, track: 0 })).toEqual([]);
    expect(driver.act({ kind: 'next' })).toEqual([{ type: 'resumed' }]);
    expect(driver.phase).toBe('playing');
    driver.step(FRAME);
    expect(driver.run.state.elapsed).toBeCloseTo(before.elapsed + FRAME);
  });

  it('ends with a summary, keeps the best, and a tap after a beat starts again', () => {
    const driver = createDriver({ best: 2, seed: () => 4 });
    steps(driver, 3);
    // Send one train, then let the queue overflow.
    const state = driver.run.state;
    const track = state.tracks.find((entry) => entry.phase === 'waiting')!;
    state.queue.unshift({ id: 999, weight: gapOf(track) });
    driver.act({ kind: 'load', crate: 999, track: state.tracks.indexOf(track) });
    steps(driver, 60);
    expect(driver.phase).toBe('over');
    expect(driver.summary).toMatchObject({ sent: 1, best: 2, beatenBest: false });
    expect(driver.act({ kind: 'next' })).toEqual([]);
    steps(driver, TIMING.overHoldSeconds);
    expect(driver.readyForNext).toBe(true);
    const again = driver.act({ kind: 'next' });
    expect(again[0]).toMatchObject({ type: 'start' });
    expect(driver.phase).toBe('playing');
    expect(driver.run.state.sent).toBe(0);
  });

  it('coaches until the first crate is loaded, and not for ever', () => {
    const driver = createDriver({ best: 0, seed: () => 4 });
    steps(driver, 1);
    expect(driver.model().coach).toBe(true);
    steps(driver, TIMING.coachSeconds);
    expect(driver.model().coach).toBe(false);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run games/train/src/driver.test.ts`
Expected: FAIL — cannot find module `./driver.js`.

- [ ] **Step 3: Implement**

`games/train/src/intent.ts`:
```ts
/** Everything a gesture or a key can mean. Input produces these; the driver acts on them. */
export type Intent =
  /** A crate from the queue dropped on a track. */
  | { kind: 'load'; crate: number; track: number }
  /** The pause button. */
  | { kind: 'pause' }
  /** Carry on: out of the pause, or another run after the summary. */
  | { kind: 'next' };
```

`games/train/src/view/timing.ts`:
```ts
/**
 * How the game feels, in one place. Retuning choreography should never mean
 * hunting through the renderer.
 */
export const TIMING = {
  /** A band's banner arrives, holds and settles in this long. */
  bannerSeconds: 2.4,
  bannerSettleFraction: 0.3,
  /** After the run ends, the summary holds this long before a tap is taken. */
  overHoldSeconds: 1.2,
  /** "Train ready!" and the like rise and fade in this long. */
  floatSeconds: 1.2,
  /** The coach line shows until the first crate is loaded, or this long. */
  coachSeconds: 20,
} as const;
```

`games/train/src/driver.ts`:
```ts
import type { Intent } from './intent.js';
import { createRun, type Run, type RunEvent, type RunState } from './logic/run.js';
import { bandAt, bandById, type Band } from './logic/tempo.js';
import { TIMING } from './view/timing.js';

/**
 * `playing` — the yard runs.
 * `paused` — everything that counts stands still; a tap carries on.
 * `over` — the queue reached the marker; the summary, then a tap starts again.
 */
export type Phase = 'playing' | 'paused' | 'over';

export type DriverEvent = RunEvent | { type: 'start'; band: Band } | { type: 'paused' } | { type: 'resumed' };

export interface Summary {
  sent: number;
  /** Seconds the run lasted. */
  seconds: number;
  best: number;
  beatenBest: boolean;
}

/** Everything the scene draws from. */
export interface SceneModel {
  run: RunState;
  phase: Phase;
  /** Seconds in this phase. */
  since: number;
  /** Seconds this run has lasted, for the clock. */
  seconds: number;
  summary: Summary | null;
  /** Whether the line along the bottom says how to play. */
  coach: boolean;
}

export interface DriverOptions {
  /** The most trains sent in one run so far. */
  best: number;
  /** A band id from the URL. Anything unrecognised opens at the beginning. */
  startBand?: string;
  /** Seeds each run, so tests can replay one. Random when absent. */
  seed?: () => number;
}

export interface Driver {
  readonly phase: Phase;
  readonly run: Run;
  readonly summary: Summary | null;
  readonly readyForNext: boolean;
  step(dt: number): DriverEvent[];
  act(intent: Intent): DriverEvent[];
  model(): SceneModel;
}

export function createDriver(options: DriverOptions): Driver {
  const seed = options.seed ?? (() => Math.floor(Math.random() * 2 ** 31));
  const startBand = bandById(options.startBand)?.id;
  let best = options.best;
  let run: Run = createRun({ seed: seed(), startBand });
  let opened = run.state.elapsed;
  let phase: Phase = 'playing';
  let since = 0;
  let summary: Summary | null = null;
  let pending: DriverEvent[] = [{ type: 'start', band: bandAt(run.state.elapsed) }];

  const begin = (): DriverEvent[] => {
    run = createRun({ seed: seed(), startBand });
    opened = run.state.elapsed;
    phase = 'playing';
    since = 0;
    summary = null;
    return [{ type: 'start', band: bandAt(run.state.elapsed) }];
  };

  const settle = (events: RunEvent[]): DriverEvent[] => {
    if (!run.state.over || phase !== 'playing') return events;
    const sent = run.state.sent;
    summary = { sent, seconds: run.state.elapsed - opened, best: Math.max(best, sent), beatenBest: sent > best };
    best = Math.max(best, sent);
    phase = 'over';
    since = 0;
    return events;
  };

  return {
    get phase() {
      return phase;
    },
    get run() {
      return run;
    },
    get summary() {
      return summary;
    },
    get readyForNext() {
      return phase === 'paused' || (phase === 'over' && since >= TIMING.overHoldSeconds);
    },

    step(dt) {
      const events: DriverEvent[] = pending;
      pending = [];
      since += dt;
      if (phase !== 'playing') return events;
      return [...events, ...settle(run.step(dt))];
    },

    act(intent) {
      switch (intent.kind) {
        case 'load':
          return phase === 'playing' ? settle(run.load(intent.crate, intent.track)) : [];
        case 'pause':
          if (phase !== 'playing') return [];
          phase = 'paused';
          since = 0;
          return [{ type: 'paused' }];
        case 'next':
          if (phase === 'paused') {
            phase = 'playing';
            since = 0;
            return [{ type: 'resumed' }];
          }
          return phase === 'over' && since >= TIMING.overHoldSeconds ? begin() : [];
      }
    },

    model: () => ({
      run: run.state,
      phase,
      since,
      seconds: run.state.elapsed - opened,
      summary,
      coach: run.state.loaded === 0 && run.state.elapsed - opened < TIMING.coachSeconds,
    }),
  };
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run games/train/src/driver.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add games/train/src/intent.ts games/train/src/driver.ts games/train/src/driver.test.ts games/train/src/view/timing.ts
git commit -m "feat(train): the driver — pause, the summary, the best run

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: The scene

**Files:**
- Create: `games/train/src/view/geometry.ts`, `games/train/src/view/art.ts`, `games/train/src/view/hud.ts`, `games/train/src/view/scene.ts`
- Test: `games/train/src/view/geometry.test.ts`, `games/train/src/view/scene.test.ts`

**Interfaces:**
- Consumes: `SceneModel`, `DriverEvent` from `../driver.js`; `Sprites`, `NO_SPRITES` from `./sprites.js`; `TIMING` from `./timing.js`; `QUEUE_SLOTS`, `TIMES`, `loadOf`, `Track`, `Crate` from `../logic/run.js`; core's `label`, `drawArrivingBanner`, `drawSummaryCard`, `fitToScreen`, `visibleBounds`, `createSpring`, `hand`.
- Produces:
  - `geometry.ts`: `BACKDROP`, `TRACKS: readonly TrackPlace[]`, `QUEUE`, `HUD`, `slotCentre(index: number): Point`, `crateAt(point: Point, count: number): number | null` (queue index under a point), `trackAt(point: Point): number | null`, `onPause(point: Point): boolean`
  - `scene.ts`: `interface Scene { update(dt: number, model: SceneModel): void; observe(events: readonly DriverEvent[]): void; render(ctx: CanvasRenderingContext2D, screen: Size): void; toDesign(point: Point, screen: Size): Point; drag(crate: number | null, at?: Point): void }`, `createScene(sprites: Sprites): Scene`, `previewText(load: number, weight: number, target: number): { text: string; tone: 'exact' | 'under' | 'over' }`, `COACH_LINE`
  - `hud.ts`: `summaryLines(summary: Summary): RunSummary`

The backdrop is the sheet's scene (852×467 sheet px) drawn at scale `1152 / 852 = 1.3521`, so it covers the top 632 design px. The floor below it, where the queue runs, is drawn in code. Positions below are the sheet's measured positions mapped by `design = (sheet - origin) * 1.3521` with origin `(16, 36)`.

- [ ] **Step 1: Write the failing geometry test**

`games/train/src/view/geometry.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { crateAt, HUD, onPause, QUEUE, slotCentre, trackAt, TRACKS } from './geometry.js';

describe('the yard', () => {
  it('runs the queue from the port to the marker, twelve slots, left to right', () => {
    expect(slotCentre(0).x).toBeLessThan(slotCentre(11).x);
    expect(slotCentre(11).x).toBeLessThan(QUEUE.markerX);
    expect(crateAt(slotCentre(3), 5)).toBe(3);
    expect(crateAt(slotCentre(7), 5)).toBeNull();
    expect(crateAt({ x: slotCentre(0).x, y: 300 }, 5)).toBeNull();
  });

  it('finds the track under a dropped crate, top to bottom, and nothing off the tracks', () => {
    TRACKS.forEach((track, index) => expect(trackAt({ x: 700, y: track.railY - 40 })).toBe(index));
    expect(trackAt({ x: 700, y: QUEUE.y })).toBeNull();
    expect(trackAt({ x: 120, y: TRACKS[0]!.railY - 40 })).toBeNull();
  });

  it('has a pause button in the top right', () => {
    expect(onPause({ x: HUD.pause.x, y: HUD.pause.y })).toBe(true);
    expect(onPause({ x: 500, y: 400 })).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run games/train/src/view/geometry.test.ts`
Expected: FAIL — cannot find module `./geometry.js`.

- [ ] **Step 3: Implement `geometry.ts`**

```ts
import type { Point } from '@bundle/core';
import { QUEUE_SLOTS } from '../logic/run.js';

/**
 * Where everything sits, in design pixels. The painted yard from the sheet
 * covers the top; the floor below it, where the queue runs, is drawn.
 */
export const BACKDROP = { width: 852, height: 467, scale: 1152 / 852 } as const;
export const FLOOR = { top: 628, colour: '#a8938a', kerb: '#857981' } as const;

export interface TrackPlace {
  /** Where the wheels sit. */
  railY: number;
  /** The middle of a waiting train. */
  trainX: number;
  /** The sign at the track's right end. */
  sign: Point;
}

/** Red, blue, green, top to bottom, as on the sheet. */
export const TRACKS: readonly TrackPlace[] = [
  { railY: 299, trainX: 585, sign: { x: 979, y: 284 } },
  { railY: 411, trainX: 585, sign: { x: 979, y: 381 } },
  { railY: 525, trainX: 585, sign: { x: 979, y: 472 } },
];
export const TRAIN = { width: 250, height: 84 } as const;
/** A dropped crate counts for a track anywhere in this band of x, and between the rails above and below. */
const DROP = { left: 250, right: 1110, tops: [150, 345, 455], bottom: 600 } as const;

export const QUEUE = {
  /** Where the crates sit, the port end first. */
  y: 700,
  firstX: 120,
  pitch: 78,
  crate: 66,
  /** The marker the queue must not reach, at its right end. */
  markerX: 1060,
} as const;

export const HUD = {
  clock: { x: 590, y: 46 },
  sent: { x: 400, y: 46 },
  pause: { x: 1100, y: 46, r: 34 },
  bandY: 112,
  coachY: 610,
} as const;

export const slotCentre = (index: number): Point => ({ x: QUEUE.firstX + index * QUEUE.pitch, y: QUEUE.y });

/** The queued crate under a point, by its place in the queue; generous, for small fingers. */
export function crateAt(point: Point, count: number): number | null {
  if (Math.abs(point.y - QUEUE.y) > QUEUE.crate * 0.75) return null;
  const index = Math.round((point.x - QUEUE.firstX) / QUEUE.pitch);
  return index >= 0 && index < Math.min(count, QUEUE_SLOTS) ? index : null;
}

export function trackAt(point: Point): number | null {
  if (point.x < DROP.left || point.x > DROP.right || point.y > DROP.bottom) return null;
  for (let index = DROP.tops.length - 1; index >= 0; index -= 1) {
    if (point.y >= DROP.tops[index]!) return index;
  }
  return null;
}

export const onPause = (point: Point): boolean => Math.hypot(point.x - HUD.pause.x, point.y - HUD.pause.y) <= HUD.pause.r + 12;
```

Run the geometry test: PASS.

- [ ] **Step 4: Write the failing scene test**

`games/train/src/view/scene.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { depthOf, recordingContext } from '@bundle/core';
import { createDriver, type Driver } from '../driver.js';
import { COACH_LINE, createScene, previewText } from './scene.js';
import { NO_SPRITES } from './sprites.js';

const FRAME = 1 / 60;
const SCREEN = { width: 1152, height: 768 };

const render = (driver: Driver, seconds = FRAME, drag?: { crate: number; at: { x: number; y: number } }) => {
  const scene = createScene(NO_SPRITES);
  for (let t = 0; t < seconds; t += FRAME) {
    scene.observe(driver.step(FRAME));
    scene.update(FRAME, driver.model());
  }
  if (drag) scene.drag(drag.crate, drag.at);
  const recording = recordingContext();
  scene.render(recording.ctx, SCREEN);
  return recording;
};

describe('the scene', () => {
  it('draws every sign, every crate number, the clock, trains sent and the coach', () => {
    const driver = createDriver({ best: 0, seed: () => 2 });
    const { ctx, texts } = render(driver, 3.2);
    expect(depthOf(ctx)).toBe(0);
    for (const track of driver.run.state.tracks) expect(texts).toContain(`0 / ${track.target}`);
    for (const crate of driver.run.state.queue) expect(texts).toContain(String(crate.weight));
    expect(texts).toContain('0:03');
    expect(texts).toContain('0');
    expect(texts).toContain(COACH_LINE);
  });

  it('previews a held crate on the train under it', () => {
    expect(previewText(7, 3, 10)).toEqual({ text: '7 + 3 = 10', tone: 'exact' });
    expect(previewText(2, 3, 10)).toEqual({ text: '2 + 3 = 5', tone: 'under' });
    expect(previewText(8, 3, 10)).toEqual({ text: '8 + 3 = 11', tone: 'over' });
    const driver = createDriver({ best: 0, seed: () => 2 });
    render(driver, 3);
    const crate = driver.run.state.queue[0]!;
    const { texts } = render(driver, FRAME, { crate: crate.id, at: { x: 700, y: 260 } });
    expect(texts).toContain(`0 + ${crate.weight} = ${crate.weight}`);
  });

  it('shows the summary when the run is over, balanced and readable', () => {
    const driver = createDriver({ best: 0, seed: () => 2 });
    const { ctx, texts } = render(driver, 70);
    expect(driver.phase).toBe('over');
    expect(depthOf(ctx)).toBe(0);
    expect(texts).toContain('Tap to go again');
    expect(texts.some((text) => text.startsWith('Trains sent'))).toBe(true);
  });

  it('shows the pause card while paused', () => {
    const driver = createDriver({ best: 0, seed: () => 2 });
    render(driver, 1);
    driver.act({ kind: 'pause' });
    const { texts } = render(driver, FRAME);
    expect(texts).toContain('Paused');
  });
});
```

- [ ] **Step 5: Run it to see it fail**

Run: `npx vitest run games/train/src/view/scene.test.ts`
Expected: FAIL — cannot find module `./scene.js`.

- [ ] **Step 6: Implement `art.ts`**

The drawing pieces. Each falls back to a drawn shape when its sprite is null (tests run without pictures).

```ts
import { hand, type Point } from '@bundle/core';
import { BACKDROP, FLOOR, QUEUE, TRAIN, type TrackPlace } from './geometry.js';
import type { SpriteName, Sprites } from './sprites.js';

const INK = '#1e2a38';
const TAU = Math.PI * 2;
export const TRAIN_SPRITES: readonly SpriteName[] = ['train-red', 'train-blue', 'train-green'];
const TRAIN_COLOURS = ['#d8443a', '#2f6fd6', '#3e9a3e'];

/** The painted yard across the top, and the drawn floor below it, edge to edge. */
export function drawYard(ctx: CanvasRenderingContext2D, sprites: Sprites, left: number, right: number, bottom: number): void {
  ctx.fillStyle = FLOOR.colour;
  ctx.fillRect(left, FLOOR.top, right - left, bottom - FLOOR.top);
  ctx.fillStyle = FLOOR.kerb;
  ctx.fillRect(left, FLOOR.top, right - left, 6);
  const image = sprites.backdrop;
  const height = BACKDROP.height * BACKDROP.scale;
  if (image) ctx.drawImage(image, 0, 0, 1152, height);
  else {
    ctx.fillStyle = '#7cc3ea';
    ctx.fillRect(left, 0, right - left, FLOOR.top);
  }
}

/** The belt the queue rides on, from the port to the marker. */
export function drawBelt(ctx: CanvasRenderingContext2D, clock: number): void {
  const top = QUEUE.y - QUEUE.crate / 2 + 6;
  ctx.save();
  ctx.fillStyle = '#3b3f48';
  ctx.fillRect(40, top + QUEUE.crate - 12, QUEUE.markerX - 40, 22);
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 2;
  const shift = (clock * 30) % 24;
  for (let x = 40 + shift; x < QUEUE.markerX; x += 24) {
    ctx.beginPath();
    ctx.moveTo(x, top + QUEUE.crate - 10);
    ctx.lineTo(x, top + QUEUE.crate + 8);
    ctx.stroke();
  }
  ctx.restore();
}

/** One crate: its picture for its weight, and its number on a white disc so it can always be read. */
export function drawCrate(ctx: CanvasRenderingContext2D, sprites: Sprites, weight: number, at: Point, size: number, tint: string | null = null): void {
  const image = sprites[`cargo-${Math.min(10, Math.max(1, weight)) as 1}`];
  ctx.save();
  if (image) ctx.drawImage(image, at.x - size / 2, at.y - size / 2, size, size);
  else {
    ctx.fillStyle = '#c98a4b';
    ctx.fillRect(at.x - size / 2, at.y - size / 2, size, size);
  }
  if (tint) {
    ctx.fillStyle = tint;
    ctx.fillRect(at.x - size / 2, at.y - size / 2, size, size);
  }
  const radius = size * 0.26;
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(at.x, at.y + size * 0.08, radius, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.font = hand(700, radius * 1.45);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = INK;
  ctx.fillText(String(weight), at.x, at.y + size * 0.08 + 1);
  ctx.restore();
}

export interface TrainPose {
  track: number;
  place: TrackPlace;
  /** Its middle. */
  x: number;
  /** Radians: a broken train sits askew. */
  tilt: number;
  /** Crates in the wagon, by weight. */
  load: readonly number[];
  alpha?: number;
}

/** A train on its track, facing right, its crates riding on top of the wagon. */
export function drawTrain(ctx: CanvasRenderingContext2D, sprites: Sprites, pose: TrainPose): void {
  const image = sprites[TRAIN_SPRITES[pose.track]!];
  ctx.save();
  ctx.globalAlpha = pose.alpha ?? 1;
  ctx.translate(pose.x, pose.place.railY);
  ctx.rotate(pose.tilt);
  // The wagon is the back (left) half; crates stack on it, small, in rows of four.
  pose.load.forEach((weight, index) => {
    const column = index % 4;
    const row = Math.floor(index / 4);
    drawCrate(ctx, sprites, weight, { x: -TRAIN.width * 0.4 + column * 28, y: -TRAIN.height - 10 - row * 26 }, 30);
  });
  if (image) ctx.drawImage(image, -TRAIN.width / 2, -TRAIN.height, TRAIN.width, TRAIN.height);
  else {
    ctx.fillStyle = TRAIN_COLOURS[pose.track]!;
    ctx.fillRect(-TRAIN.width / 2, -TRAIN.height, TRAIN.width, TRAIN.height - 12);
  }
  ctx.restore();
}

/** Grey puffs over a broken train, drifting up. */
export function drawSmoke(ctx: CanvasRenderingContext2D, at: Point, clock: number): void {
  ctx.save();
  for (let puff = 0; puff < 5; puff += 1) {
    const t = (clock * 0.6 + puff / 5) % 1;
    ctx.globalAlpha = 0.55 * (1 - t);
    ctx.fillStyle = '#9aa0a8';
    ctx.beginPath();
    ctx.arc(at.x + Math.sin(puff * 1.7 + clock) * 12, at.y - t * 80, 12 + t * 18, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

/** A sprite centred on a point at a height, or nothing if it has not loaded. */
export function drawSprite(ctx: CanvasRenderingContext2D, sprites: Sprites, name: SpriteName, at: Point, height: number, alpha = 1): void {
  const image = sprites[name];
  if (!image) return;
  const width = height * (image.width / Math.max(1, image.height));
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(image, at.x - width / 2, at.y - height / 2, width, height);
  ctx.restore();
}

/** A bar that fills: the sheet's progress bar for a train's load, the repair bar for a mend. */
export function drawBar(ctx: CanvasRenderingContext2D, at: Point, width: number, share: number, colour: string): void {
  ctx.save();
  ctx.fillStyle = 'rgba(30,42,56,0.55)';
  ctx.fillRect(at.x - width / 2, at.y - 7, width, 14);
  ctx.fillStyle = colour;
  ctx.fillRect(at.x - width / 2 + 2, at.y - 5, (width - 4) * Math.max(0, Math.min(1, share)), 10);
  ctx.restore();
}
```

- [ ] **Step 7: Implement `hud.ts`**

```ts
import { DESIGN, drawSummaryCard, hand, label, type RunSummary } from '@bundle/core';
import type { Summary } from '../driver.js';
import { HUD } from './geometry.js';
import type { Sprites } from './sprites.js';
import { drawSprite } from './art.js';

export const clockText = (seconds: number): string => {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
};

function pill(ctx: CanvasRenderingContext2D, x: number, y: number, width: number): void {
  ctx.save();
  ctx.fillStyle = '#1f4f8f';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x - width / 2 + 26, y - 26);
  ctx.arcTo(x + width / 2, y - 26, x + width / 2, y + 26, 26);
  ctx.arcTo(x + width / 2, y + 26, x - width / 2, y + 26, 26);
  ctx.arcTo(x - width / 2, y + 26, x - width / 2, y - 26, 26);
  ctx.arcTo(x - width / 2, y - 26, x + width / 2, y - 26, 26);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function whiteText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number): void {
  ctx.font = hand(700, size);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, x, y + 1);
}

/** The top bar: trains sent, the time this run has lasted, and the pause button. */
export function drawTopBar(ctx: CanvasRenderingContext2D, sprites: Sprites, sent: number, seconds: number): void {
  pill(ctx, HUD.sent.x, HUD.sent.y, 150);
  drawSprite(ctx, sprites, 'crate-stack', { x: HUD.sent.x - 46, y: HUD.sent.y }, 40);
  whiteText(ctx, String(sent), HUD.sent.x + 22, HUD.sent.y, 34);
  pill(ctx, HUD.clock.x, HUD.clock.y, 150);
  drawSprite(ctx, sprites, 'stopwatch', { x: HUD.clock.x - 48, y: HUD.clock.y }, 44);
  whiteText(ctx, clockText(seconds), HUD.clock.x + 20, HUD.clock.y, 32);
  ctx.save();
  ctx.fillStyle = '#1f4f8f';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(HUD.pause.x, HUD.pause.y, HUD.pause.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(HUD.pause.x - 11, HUD.pause.y - 13, 8, 26);
  ctx.fillRect(HUD.pause.x + 3, HUD.pause.y - 13, 8, 26);
  ctx.restore();
}

/** The card at the end of a run, worded for the yard. */
export const summaryLines = (summary: Summary): RunSummary => ({
  score: summary.sent,
  bestStreak: 0,
  seconds: summary.seconds,
  best: summary.best,
  beatenBest: summary.beatenBest,
  headline: summary.beatenBest ? 'A new best!' : 'Good loading!',
  lines: [`Trains sent: ${summary.sent}`, `Time in the yard: ${clockText(summary.seconds)}`, `Best: ${summary.best} trains`],
});

export const drawSummary = (ctx: CanvasRenderingContext2D, summary: Summary): void => drawSummaryCard(ctx, summaryLines(summary));

/** While paused: the yard dimmed, and how to carry on. */
export function drawPaused(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.fillStyle = 'rgba(12,24,38,0.45)';
  ctx.fillRect(0, 0, DESIGN.width, DESIGN.height);
  label(ctx, 'Paused', DESIGN.width / 2, DESIGN.height / 2 - 30, 72, 'center');
  label(ctx, 'Tap to carry on', DESIGN.width / 2, DESIGN.height / 2 + 40, 34, 'center');
  ctx.restore();
}
```

- [ ] **Step 8: Implement `scene.ts`**

```ts
import { createSpring, drawArrivingBanner, fitToScreen, label, visibleBounds, type Point, type Size, type Spring } from '@bundle/core';
import type { DriverEvent, SceneModel } from '../driver.js';
import { loadOf, QUEUE_SLOTS, TIMES, type Crate } from '../logic/run.js';
import { drawBar, drawBelt, drawCrate, drawSmoke, drawSprite, drawTrain, drawYard } from './art.js';
import { HUD, QUEUE, slotCentre, trackAt, TRACKS, TRAIN } from './geometry.js';
import { drawPaused, drawSummary, drawTopBar } from './hud.js';
import type { SpriteName, Sprites } from './sprites.js';
import { TIMING } from './timing.js';

export interface Scene {
  update(dt: number, model: SceneModel): void;
  observe(events: readonly DriverEvent[]): void;
  render(ctx: CanvasRenderingContext2D, screen: Size): void;
  toDesign(point: Point, screen: Size): Point;
  /** The crate being dragged and where the finger is, or null when nothing is held. */
  drag(crate: number | null, at?: Point): void;
}

export const COACH_LINE = 'Drag a crate onto a train';

/** What a train's sign says while a crate is held over it. */
export function previewText(load: number, weight: number, target: number): { text: string; tone: 'exact' | 'under' | 'over' } {
  const sum = load + weight;
  return { text: `${load} + ${weight} = ${sum}`, tone: sum === target ? 'exact' : sum < target ? 'under' : 'over' };
}

const TONE_COLOURS = { exact: '#3fae4a', under: '#ffffff', over: '#e8543f' } as const;

interface Float {
  text: string;
  icon: SpriteName | null;
  at: Point;
  life: number;
}

/** A train on its way out, drawn until it is off the right edge. */
interface Leaver {
  track: number;
  load: number[];
  life: number;
}

/** Crates swept away by a bonus, popping where they were. */
interface Pop {
  weight: number;
  at: Point;
  life: number;
}

const LEAVE_SECONDS = 1.2;
const POP_SECONDS = 0.6;

export function createScene(sprites: Sprites): Scene {
  let model: SceneModel | null = null;
  let clock = 0;
  let banner: { title: string; life: number } | null = null;
  let held: { crate: number; at: Point } | null = null;
  /** Each queued crate's drawn x, sliding to its slot. */
  const slide = new Map<number, Spring>();
  const floats: Float[] = [];
  const leavers: Leaver[] = [];
  const pops: Pop[] = [];

  const float = (text: string, icon: SpriteName | null, at: Point): void => void floats.push({ text, icon, at, life: 0 });

  return {
    drag(crate, at) {
      held = crate === null || !at ? null : { crate, at };
    },

    observe(events) {
      for (const event of events) {
        switch (event.type) {
          case 'start':
            banner = { title: event.band.title, life: 0 };
            floats.length = 0;
            leavers.length = 0;
            pops.length = 0;
            slide.clear();
            break;
          case 'band':
            banner = { title: event.band.title, life: 0 };
            break;
          case 'speed':
            float('Speed up!', 'bolt', { x: 576, y: 600 });
            break;
          case 'crate':
            // Out of the port: it slides along from the start of the belt.
            slide.set(event.crate.id, createSpring(QUEUE.firstX - 80, { stiffness: 120 }));
            break;
          case 'sent':
            leavers.push({ track: event.track, load: event.load, life: 0 });
            float(event.bonus ? 'Bonus!' : 'Train ready!', event.bonus ? 'star' : 'tick', { x: TRACKS[event.track]!.trainX, y: TRACKS[event.track]!.railY - 120 });
            break;
          case 'cleared':
            for (const crate of event.crates) {
              const spring = slide.get(crate.id);
              pops.push({ weight: crate.weight, at: { x: spring?.value ?? QUEUE.markerX, y: QUEUE.y }, life: 0 });
              slide.delete(crate.id);
            }
            break;
          case 'broke':
            float('Too heavy!', 'cross', { x: TRACKS[event.track]!.trainX, y: TRACKS[event.track]!.railY - 120 });
            break;
          default:
            break;
        }
      }
    },

    update(dt, next) {
      model = next;
      if (next.phase === 'paused') return;
      clock += dt;
      if (banner) {
        banner.life += dt;
        if (banner.life > TIMING.bannerSeconds) banner = null;
      }
      for (const entry of floats) entry.life += dt;
      while (floats.length > 0 && floats[0]!.life > TIMING.floatSeconds) floats.shift();
      for (const leaver of leavers) leaver.life += dt;
      while (leavers.length > 0 && leavers[0]!.life > LEAVE_SECONDS) leavers.shift();
      for (const pop of pops) pop.life += dt;
      while (pops.length > 0 && pops[0]!.life > POP_SECONDS) pops.shift();
      next.run.queue.forEach((crate, index) => {
        const spring = slide.get(crate.id) ?? createSpring(slotCentre(index).x, { stiffness: 120 });
        spring.target = slotCentre(index).x;
        spring.step(dt);
        slide.set(crate.id, spring);
      });
    },

    render(ctx, screen) {
      const current = model;
      if (!current) return;
      const transform = fitToScreen(screen);
      const bounds = visibleBounds(screen, transform);
      const run = current.run;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.translate(transform.offsetX, transform.offsetY);
      ctx.scale(transform.scale, transform.scale);

      drawYard(ctx, sprites, bounds.left, bounds.right, bounds.bottom);

      const heldCrate: Crate | undefined = held ? run.queue.find((crate) => crate.id === held!.crate) : undefined;
      const over = held && heldCrate ? trackAt(held.at) : null;

      run.tracks.forEach((track, index) => {
        const place = TRACKS[index]!;
        if (track.phase === 'rolling') {
          // Rolling in from the left over the last part of its wait.
          const t = 1 - Math.max(0, track.timer) / TIMES.rollIn;
          const x = -TRAIN.width + (place.trainX + TRAIN.width) * Math.min(1, t * 1.15);
          drawTrain(ctx, sprites, { track: index, place, x, tilt: 0, load: [] });
          return;
        }
        if (track.phase === 'broken') {
          drawSprite(ctx, sprites, 'broken-track', { x: place.trainX + 40, y: place.railY - 8 }, 70);
          drawTrain(ctx, sprites, { track: index, place, x: place.trainX, tilt: -0.08 + Math.sin(clock * 20) * 0.004, load: [] });
          drawSmoke(ctx, { x: place.trainX + 60, y: place.railY - TRAIN.height }, clock);
          drawSprite(ctx, sprites, 'worker-wrench', { x: place.trainX - 150, y: place.railY - 40 }, 80);
          drawSprite(ctx, sprites, 'worker-wheel', { x: place.trainX + 150, y: place.railY - 34 }, 70);
          drawSprite(ctx, sprites, 'repair', { x: place.sign.x - 70, y: place.sign.y }, 40);
          drawBar(ctx, { x: place.sign.x + 10, y: place.sign.y }, 110, 1 - track.timer / TIMES.repair, '#f0a32e');
          return;
        }
        const judder = track.star > 0 ? Math.sin(clock * 40) * 1.5 : 0;
        drawTrain(ctx, sprites, { track: index, place, x: place.trainX + judder, tilt: 0, load: track.load });
        const load = loadOf(track);
        const preview = over === index && heldCrate ? previewText(load, heldCrate.weight, track.target) : null;
        drawSign(ctx, sprites, place.sign, preview?.text ?? `${load} / ${track.target}`, preview ? TONE_COLOURS[preview.tone] : '#ffffff', track.star > 0, clock);
        drawBar(ctx, { x: place.sign.x, y: place.sign.y + 40 }, 110, load / track.target, track.star > 0 ? '#ffcc3a' : '#5cb85c');
        if (track.star > 0) {
          drawSprite(ctx, sprites, 'star', { x: place.trainX - TRAIN.width * 0.25, y: place.railY - TRAIN.height * 0.55 }, 40);
          drawStarClock(ctx, sprites, { x: place.sign.x, y: place.sign.y - 52 }, track.star);
        }
      });

      for (const leaver of leavers) {
        const place = TRACKS[leaver.track]!;
        const t = leaver.life / LEAVE_SECONDS;
        drawTrain(ctx, sprites, { track: leaver.track, place, x: place.trainX + t * t * 900, tilt: 0, load: leaver.load });
        drawSmoke(ctx, { x: place.trainX + t * t * 900 + 90, y: place.railY - TRAIN.height }, clock);
      }

      drawBelt(ctx, clock);
      // The marker, and the warning as the queue nears it.
      const danger = Math.max(0, run.queue.length - (QUEUE_SLOTS - 4)) / 4;
      const blink = danger > 0 && Math.floor(clock * (2 + danger * 4)) % 2 === 0;
      drawSprite(ctx, sprites, 'signal', { x: QUEUE.markerX + 30, y: QUEUE.y - 20 }, 90, blink ? 1 : 0.85);
      for (let slot = QUEUE_SLOTS - 3; slot < QUEUE_SLOTS; slot += 1) {
        const at = slotCentre(slot);
        ctx.fillStyle = slot >= QUEUE_SLOTS - 1 ? 'rgba(232,84,63,0.28)' : 'rgba(240,163,46,0.22)';
        ctx.fillRect(at.x - QUEUE.pitch / 2, QUEUE.y - QUEUE.crate / 2 - 6, QUEUE.pitch, QUEUE.crate + 12);
      }

      run.queue.forEach((crate) => {
        if (held && crate.id === held.crate) return;
        const x = slide.get(crate.id)?.value ?? QUEUE.firstX;
        drawCrate(ctx, sprites, crate.weight, { x, y: QUEUE.y }, QUEUE.crate);
      });
      for (const pop of pops) {
        const t = pop.life / POP_SECONDS;
        drawSprite(ctx, sprites, 'star', { x: pop.at.x, y: pop.at.y - t * 50 }, 40 * (1 + t), 1 - t);
      }
      if (held && heldCrate) drawCrate(ctx, sprites, heldCrate.weight, held.at, QUEUE.crate * 1.15);

      drawTopBar(ctx, sprites, run.sent, current.seconds);
      if (current.coach) label(ctx, COACH_LINE, 576, HUD.coachY, 30, 'center');
      for (const entry of floats) {
        const t = entry.life / TIMING.floatSeconds;
        ctx.save();
        ctx.globalAlpha = t > 0.7 ? (1 - t) / 0.3 : 1;
        if (entry.icon) drawSprite(ctx, sprites, entry.icon, { x: entry.at.x - 110, y: entry.at.y - t * 50 }, 46);
        label(ctx, entry.text, entry.at.x, entry.at.y - t * 50, 40, 'center');
        ctx.restore();
      }
      if (banner) drawArrivingBanner(ctx, banner.title, banner.life / TIMING.bannerSeconds, TIMING.bannerSettleFraction, HUD.bandY);

      if (current.phase === 'paused') drawPaused(ctx);
      if (current.phase === 'over' && current.summary) drawSummary(ctx, current.summary);
      ctx.restore();
    },

    toDesign(point, screen) {
      return fitToScreen(screen).toDesign(point);
    },
  };
}

/** The sign at a track's end: its load and target, or the held crate's sum. Gold and pulsing for a star train. */
function drawSign(ctx: CanvasRenderingContext2D, sprites: Sprites, at: Point, text: string, colour: string, star: boolean, clock: number): void {
  const grow = star ? 1 + Math.sin(clock * 8) * 0.05 : 1;
  ctx.save();
  ctx.translate(at.x, at.y);
  ctx.scale(grow, grow);
  const image = sprites.sign;
  if (image) ctx.drawImage(image, -64, -32, 128, 64);
  else {
    ctx.fillStyle = '#3a3a42';
    ctx.fillRect(-64, -32, 128, 64);
  }
  if (star) {
    ctx.strokeStyle = '#ffcc3a';
    ctx.lineWidth = 5;
    ctx.strokeRect(-66, -34, 132, 68);
  }
  ctx.font = `700 ${text.length > 7 ? 22 : 30}px "Baloo 2", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = colour;
  ctx.fillText(text, 8, 1);
  ctx.restore();
}

/** The little stopwatch over a star train's sign, red for the last two seconds. */
function drawStarClock(ctx: CanvasRenderingContext2D, sprites: Sprites, at: Point, seconds: number): void {
  drawSprite(ctx, sprites, 'stopwatch', { x: at.x - 26, y: at.y }, 40);
  label(ctx, String(Math.ceil(seconds)), at.x + 14, at.y, 30, 'center');
  if (seconds <= 2) {
    ctx.save();
    ctx.fillStyle = 'rgba(232,84,63,0.35)';
    ctx.beginPath();
    ctx.arc(at.x - 26, at.y, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
```

Use core's `hand(700, size)` instead of the literal font string in `drawSign` if `hand` is what the other games use for numbers (it is — see `games/fishing/src/view/art.ts`); import it from `@bundle/core`.

- [ ] **Step 9: Run the scene tests**

Run: `npx vitest run games/train/src/view`
Expected: PASS. If `'0'` (trains sent) is missing from `texts`, check `whiteText` uses `fillText` (the recording context only records `fillText`).

- [ ] **Step 10: Commit**

```bash
git add games/train/src/view
git commit -m "feat(train): the scene — trains, signs, the queue, stars, repairs

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Dragging

**Files:**
- Create: `games/train/src/view/input.ts`
- Test: `games/train/src/view/input.test.ts`

**Interfaces:**
- Consumes: `Scene` from `./scene.js`; `crateAt`, `trackAt`, `onPause` from `./geometry.js`; `Phase` from `../driver.js`; `Intent` from `../intent.js`; `Crate` from `../logic/run.js`.
- Produces: `createInput(canvas: HTMLCanvasElement, scene: Scene, emit: (intent: Intent) => void, current: () => { phase: Phase; queue: readonly Crate[] }): { dispose(): void }`

- [ ] **Step 1: Write the failing tests**

`games/train/src/view/input.test.ts`:
```ts
// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import type { Phase } from '../driver.js';
import type { Intent } from '../intent.js';
import type { Crate } from '../logic/run.js';
import { HUD, slotCentre, TRACKS } from './geometry.js';
import { createInput } from './input.js';
import { createScene } from './scene.js';
import { NO_SPRITES } from './sprites.js';

const canvasOf = (width: number, height: number): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  Object.defineProperty(canvas, 'clientWidth', { value: width });
  Object.defineProperty(canvas, 'clientHeight', { value: height });
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width, height, right: width, bottom: height, x: 0, y: 0, toJSON: () => ({}) });
  document.body.appendChild(canvas);
  return canvas;
};

const pointer = (canvas: HTMLCanvasElement, type: string, x: number, y: number, pointerId = 1, isPrimary = true) => {
  const event = new MouseEvent(type, { clientX: x, clientY: y, bubbles: true }) as MouseEvent & { pointerId: number };
  Object.defineProperty(event, 'pointerId', { value: pointerId });
  Object.defineProperty(event, 'isPrimary', { value: isPrimary });
  canvas.dispatchEvent(event);
};

const QUEUE: Crate[] = [{ id: 11, weight: 3 }, { id: 12, weight: 5 }];

const setup = (phase: () => Phase = () => 'playing') => {
  const canvas = canvasOf(1152, 768);
  const intents: Intent[] = [];
  const input = createInput(canvas, createScene(NO_SPRITES), (intent) => intents.push(intent), () => ({ phase: phase(), queue: QUEUE }));
  return { canvas, intents, input };
};

afterEach(() => document.body.replaceChildren());

describe('dragging', () => {
  it('loads the crate picked up onto the track it is dropped on', () => {
    const { canvas, intents, input } = setup();
    const from = slotCentre(1);
    pointer(canvas, 'pointerdown', from.x, from.y);
    pointer(canvas, 'pointermove', 700, TRACKS[2]!.railY - 40);
    pointer(canvas, 'pointerup', 700, TRACKS[2]!.railY - 40);
    expect(intents).toEqual([{ kind: 'load', crate: 12, track: 2 }]);
    input.dispose();
  });

  it('drops a crate let go anywhere else, loading nothing', () => {
    const { canvas, intents, input } = setup();
    const from = slotCentre(0);
    pointer(canvas, 'pointerdown', from.x, from.y);
    pointer(canvas, 'pointermove', 600, 700);
    pointer(canvas, 'pointerup', 600, 700);
    pointer(canvas, 'pointerdown', 600, 300);
    pointer(canvas, 'pointerup', 700, TRACKS[0]!.railY - 40);
    expect(intents).toEqual([]);
    input.dispose();
  });

  it('ignores a second finger while one crate is held', () => {
    const { canvas, intents, input } = setup();
    const from = slotCentre(0);
    pointer(canvas, 'pointerdown', from.x, from.y, 1);
    pointer(canvas, 'pointerdown', slotCentre(1).x, slotCentre(1).y, 2, false);
    pointer(canvas, 'pointerup', 700, TRACKS[1]!.railY - 40, 2, false);
    pointer(canvas, 'pointerup', 700, TRACKS[0]!.railY - 40, 1);
    expect(intents).toEqual([{ kind: 'load', crate: 11, track: 0 }]);
    input.dispose();
  });

  it('drops a crate still held when the run ends, and taps carry on after it', () => {
    let phase: Phase = 'playing';
    const { canvas, intents, input } = setup(() => phase);
    pointer(canvas, 'pointerdown', slotCentre(0).x, slotCentre(0).y);
    phase = 'over';
    pointer(canvas, 'pointerup', 700, TRACKS[0]!.railY - 40);
    expect(intents).toEqual([{ kind: 'next' }]);
    input.dispose();
  });

  it('pauses from the button, and a tap while paused carries on', () => {
    let phase: Phase = 'playing';
    const { canvas, intents, input } = setup(() => phase);
    pointer(canvas, 'pointerdown', HUD.pause.x, HUD.pause.y);
    pointer(canvas, 'pointerup', HUD.pause.x, HUD.pause.y);
    phase = 'paused';
    pointer(canvas, 'pointerdown', 500, 500);
    pointer(canvas, 'pointerup', 500, 500);
    expect(intents).toEqual([{ kind: 'pause' }, { kind: 'next' }]);
    input.dispose();
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run games/train/src/view/input.test.ts`
Expected: FAIL — cannot find module `./input.js`.

- [ ] **Step 3: Implement**

`games/train/src/view/input.ts`:
```ts
import { DESIGN, type Point, type Size } from '@bundle/core';
import type { Phase } from '../driver.js';
import type { Intent } from '../intent.js';
import type { Crate } from '../logic/run.js';
import { crateAt, onPause, trackAt } from './geometry.js';
import type { Scene } from './scene.js';

export interface InputHandle {
  dispose(): void;
}

/**
 * One gesture: pick a crate up from the queue, carry it, let go over a train.
 * Let go anywhere else and it goes back. The pause button pauses; while
 * paused, or on the summary, a tap (on lifting) carries on. One finger at a
 * time: a second is ignored while a crate is held.
 */
export function createInput(
  canvas: HTMLCanvasElement,
  scene: Scene,
  emit: (intent: Intent) => void,
  current: () => { phase: Phase; queue: readonly Crate[] },
): InputHandle {
  /** The one finger followed; `paused` when its press hit the pause button, so its lifting does not unpause. */
  let pressed: { pointerId: number; crate: number | null; paused: boolean } | null = null;

  const screenSize = (): Size => ({ width: canvas.clientWidth || DESIGN.width, height: canvas.clientHeight || DESIGN.height });
  const designPoint = (event: PointerEvent): Point => {
    const bounds = canvas.getBoundingClientRect();
    return scene.toDesign({ x: event.clientX - bounds.left, y: event.clientY - bounds.top }, screenSize());
  };

  const onPointerDown = (event: PointerEvent): void => {
    if (pressed) return;
    canvas.setPointerCapture?.(event.pointerId);
    pressed = { pointerId: event.pointerId, crate: null, paused: false };
    const { phase, queue } = current();
    if (phase !== 'playing') return;
    const at = designPoint(event);
    if (onPause(at)) {
      pressed.paused = true;
      emit({ kind: 'pause' });
      return;
    }
    const index = crateAt(at, queue.length);
    if (index === null) return;
    pressed.crate = queue[index]!.id;
    scene.drag(pressed.crate, at);
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (!pressed || pressed.pointerId !== event.pointerId || pressed.crate === null) return;
    scene.drag(pressed.crate, designPoint(event));
  };

  const onPointerUp = (event: PointerEvent): void => {
    if (!pressed || pressed.pointerId !== event.pointerId) return;
    const { crate, paused } = pressed;
    pressed = null;
    canvas.releasePointerCapture?.(event.pointerId);
    scene.drag(null);
    if (paused) return;
    const { phase } = current();
    if (phase !== 'playing') {
      emit({ kind: 'next' });
      return;
    }
    if (crate === null) return;
    const track = trackAt(designPoint(event));
    if (track !== null) emit({ kind: 'load', crate, track });
  };

  const onPointerCancel = (event: PointerEvent): void => {
    if (pressed?.pointerId !== event.pointerId) return;
    pressed = null;
    scene.drag(null);
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' || event.key === 'p') {
      emit(current().phase === 'playing' ? { kind: 'pause' } : { kind: 'next' });
    } else if (event.key === ' ' || event.key === 'Enter') {
      if (current().phase !== 'playing') emit({ kind: 'next' });
    }
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

The `paused` flag matters: in the game the driver is paused the moment the button is pressed, so without it that same finger lifting would emit `next` and unpause at once.

- [ ] **Step 4: Run them**

Run: `npx vitest run games/train/src/view/input.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add games/train/src/view/input.ts games/train/src/view/input.test.ts
git commit -m "feat(train): drag a crate onto a train

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Sounds, the module, the catalog

**Files:**
- Create: `games/train/src/audio/train-sounds.ts`, `games/train/src/index.ts`
- Test: `games/train/src/integration.test.ts`
- Modify: `apps/shell/src/catalog.ts`, `apps/shell/src/shell.test.ts`, `README.md`

**Interfaces:**
- Consumes: everything above.
- Produces: `trainGame: TrainModule` (id `'train'`, title `'Cargo Yard'`), `SOUND_EVENTS`, `createTrainSoundPack(bus: AudioBus): SoundPack`; test hooks `step(frames?)`, `act(intent)`, `play(policy, seconds)`, `phase()`, `state()`, `summary()`.

- [ ] **Step 1: Write the failing integration test**

`games/train/src/integration.test.ts`:
```ts
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import { installCanvasStub } from '@bundle/core';
import { trainGame } from './index.js';
import { createTestHost, type TestHost } from './test-host.js';
import * as sounds from './audio/train-sounds.js';

let restoreCanvas: () => void;
beforeAll(() => {
  restoreCanvas = installCanvasStub();
});
afterAll(() => restoreCanvas());
afterEach(() => vi.restoreAllMocks());

const mountGame = async (startLevel?: string, host: TestHost = createTestHost()) => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let seed = 0;
  const session = await trainGame.mount(container, host, { startLevel, seed: () => (seed += 1) });
  return { container, host, session };
};

describe('a game played through the module', () => {
  it('names itself for the catalog, and mounts and unmounts a canvas', async () => {
    expect(trainGame.id).toBe('train');
    expect(trainGame.title).toBe('Cargo Yard');
    const { container, session } = await mountGame();
    expect(container.querySelector('canvas')).not.toBeNull();
    session.unmount();
    expect(container.querySelector('canvas')).toBeNull();
  });

  it('plays a run to its end, keeps the best, and starts again on a tap', async () => {
    const played: string[] = [];
    vi.spyOn(sounds, 'createTrainSoundPack').mockReturnValue({
      preload: async () => {},
      play: (event: string) => void played.push(event),
    });
    const { session, host } = await mountGame();
    session.__test.play('careful', 600);
    expect(session.__test.phase()).toBe('over');
    expect(played).toEqual(expect.arrayContaining(['start', 'crate', 'thunk', 'whistle', 'over']));
    const sent = session.__test.summary()!.sent;
    expect(sent).toBeGreaterThan(0);
    expect(host.storage.get('best', 0)).toBe(sent);
    session.__test.step(120);
    session.__test.act({ kind: 'next' });
    expect(session.__test.phase()).toBe('playing');
    session.unmount();
  });

  it('opens in a band from the URL', async () => {
    const { session } = await mountGame('heavy');
    expect(session.__test.state().band).toBe('heavy');
    session.unmount();
  });

  it('follows the mute setting', async () => {
    const host = createTestHost();
    const { session } = await mountGame(undefined, host);
    host.settings.set('muted', true);
    expect(host.audio.muted).toBe(true);
    session.unmount();
  });
});

describe('the sound pack', () => {
  it('knows every event the game plays', () => {
    for (const name of ['start', 'band', 'speed', 'crate', 'pick', 'thunk', 'whistle', 'crunch', 'hammer', 'horn', 'tick', 'bonus', 'danger', 'over', 'best']) {
      expect(sounds.SOUND_EVENTS).toContain(name);
    }
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run games/train/src/integration.test.ts`
Expected: FAIL — cannot find module `./index.js`.

- [ ] **Step 3: Implement the sound pack**

`games/train/src/audio/train-sounds.ts` — same shape as `games/fishing/src/audio/fishing-sounds.ts` (`Voice`, `VOICES`, `create…SoundPack`), with these voices:
```ts
export const SOUND_EVENTS: readonly string[] = [
  'start', 'band', 'speed', 'crate', 'pick', 'thunk', 'whistle', 'crunch', 'hammer', 'horn', 'tick', 'bonus', 'danger', 'over', 'best',
];

/** A rising three-note fanfare: a run, or a band, begins. */
const start: Voice = (bus, delay) => {
  [523.25, 659.25, 783.99].forEach((freq, index) => tone(bus, { freq, duration: 0.24, type: 'triangle', gain: 0.14, delay: delay + index * 0.1 }));
};
const band: Voice = start;
/** Whoosh up: faster now. */
const speed: Voice = (bus, delay) => tone(bus, { freq: 300, duration: 0.35, type: 'sawtooth', gain: 0.05, sweepTo: 900, delay });
/** A crate out of the port onto the belt: a soft clunk. */
const crate: Voice = (bus, delay) => noiseBurst(bus, { duration: 0.08, gain: 0.06, filterHz: 700, delay });
/** Picked up. */
const pick: Voice = (bus, delay) => tone(bus, { freq: 660, duration: 0.06, type: 'sine', gain: 0.08, delay });
/** Into the wagon, lower for a heavier crate. */
const thunk: Voice = (bus, delay, step) => {
  noiseBurst(bus, { duration: 0.12, gain: 0.1, filterHz: 900 - Math.min(9, step) * 50, delay });
  tone(bus, { freq: 220 - Math.min(9, step) * 8, duration: 0.12, type: 'sine', gain: 0.12, delay });
};
/** Away she goes. */
const whistle: Voice = (bus, delay) => {
  tone(bus, { freq: 880, duration: 0.5, type: 'triangle', gain: 0.1, delay });
  tone(bus, { freq: 1108.73, duration: 0.5, type: 'triangle', gain: 0.08, delay });
};
/** Too heavy: a crunch and a slide down. Funny, never harsh. */
const crunch: Voice = (bus, delay) => {
  noiseBurst(bus, { duration: 0.35, gain: 0.16, filterHz: 1400, sweepTo: 300, delay });
  tone(bus, { freq: 330, duration: 0.5, type: 'triangle', gain: 0.1, sweepTo: 110, delay: delay + 0.1 });
};
/** The crew at work. */
const hammer: Voice = (bus, delay) => noiseBurst(bus, { duration: 0.05, gain: 0.08, filterHz: 2600, delay });
/** A star train pulls in. */
const horn: Voice = (bus, delay) => {
  tone(bus, { freq: 392, duration: 0.45, type: 'square', gain: 0.05, delay });
  tone(bus, { freq: 493.88, duration: 0.45, type: 'square', gain: 0.04, delay });
};
const tick: Voice = (bus, delay) => tone(bus, { freq: 1046.5, duration: 0.06, type: 'square', gain: 0.05, delay });
const bonus: Voice = (bus, delay) => {
  [783.99, 987.77, 1174.66, 1567.98].forEach((freq, index) => tone(bus, { freq, duration: 0.18, type: 'sine', gain: 0.12, delay: delay + index * 0.07 }));
};
/** The queue nears the marker: a low two-note nudge. */
const danger: Voice = (bus, delay) => {
  [392, 330].forEach((freq, index) => tone(bus, { freq, duration: 0.14, type: 'sine', gain: 0.08, delay: delay + index * 0.14 }));
};
const over: Voice = (bus, delay) => {
  [523.25, 392, 329.63].forEach((freq, index) => tone(bus, { freq, duration: 0.3, type: 'sine', gain: 0.12, delay: delay + index * 0.2 }));
};
const best: Voice = bonus;
```
and `createTrainSoundPack` exactly like `createFishingSoundPack`.

- [ ] **Step 4: Implement the module**

`games/train/src/index.ts`, following `games/fishing/src/index.ts`:
- `TrainOptions { startLevel?: string; seed?: () => number }`; `TrainTestHooks { step(frames?: number): void; act(intent: Intent): void; play(policy: Policy, seconds: number): void; phase(): Phase; state(): RunState; summary(): Summary | null }`; `TrainSession`, `TrainModule` as in fishing.
- `mount`: sound pack, sprites with the 250 ms race, a canvas, `createScene(sprites)`, `createDriver({ best: host.storage.get<number>('best', 0), startBand: options.startLevel, seed: options.seed })`, settings subscription as in fishing.
- `handleEvents` maps driver events to sounds:
  - `start` → `start`; `band` → `band`; `speed` → `speed`; `crate` → `crate`, and `danger` when `driver.run.state.queue.length >= QUEUE_SLOTS - 3`;
  - `loaded` → `thunk` with `step: event.crate.weight`; `sent` → `whistle`, plus `bonus` when `event.bonus`;
  - `broke` → `crunch`, then `hammer` at delays `0.6, 1.0, 1.4, 2.2, 2.6, 3.0, 3.8, 4.2`;
  - `arrived` with `star` → `horn`; `starTick` → `tick`;
  - `over` → `over`, then if `driver.summary?.beatenBest` → `best` at delay 0.6; and `host.storage.set('best', driver.summary.best)`.
- `act(intent)`: `const events = driver.act(intent); scene.observe(events); handleEvents(events);`.
- Input: `createInput(canvas, scene, (intent) => { void host.audio.unlock(); if (intent.kind === 'load') sounds.play('pick'); act(intent); }, () => ({ phase: driver.phase, queue: driver.run.state.queue }))`.
- `frame(dt)`: `const events = driver.step(dt); scene.observe(events); handleEvents(events); scene.update(dt, driver.model()); scene.render(...)`.
- `pause: () => { ticker.stop(); act({ kind: 'pause' }); }` (the shell pausing — say a phone call — also pauses the yard), `resume: () => ticker.start()`.
- Test hook `play(policy, seconds)`: a `createRng(1)` and, for `seconds * 60` frames while `driver.phase === 'playing'`, every 72 frames take `chooseMove(driver.run.state, policy, rng)` and `act({ kind: 'load', ...move })`, then `frame(1/60)`.
- `export default trainGame;` and `export { createTrainSoundPack, SOUND_EVENTS } from './audio/train-sounds.js';`

- [ ] **Step 5: Register in the shell**

In `apps/shell/src/catalog.ts`: `import { trainGame } from '@bundle/train';` and replace the `measure` placeholder line with:
```ts
  { id: 'train', title: 'Cargo Yard', blurb: 'Load the trains exactly', colors: ['#e0533f', '#3f7fbf'], module: trainGame },
```
In `apps/shell/src/shell.test.ts`: the playable list becomes `['seesaw', 'sky', 'bramble', 'balloon', 'pond', 'fishing', 'train']`.

- [ ] **Step 6: Run everything**

Run: `npm run typecheck && npx vitest run`
Expected: typecheck clean; all tests pass.

- [ ] **Step 7: README**

Add a "Cargo Yard" section to `README.md` after the Bucket Bay section, in the same voice: what the game is (three trains, exact loads, crates arriving faster until the queue reaches the marker), the bands and pace, star trains and the bonus, where the art comes from (`scripts/cut-train.py` from `games/train/assets/source/board.png`), and `?game=train&level=heavy`. Add the game to the README's list/introduction wherever the other six are listed.

- [ ] **Step 8: Commit**

```bash
git add games/train apps/shell/src/catalog.ts apps/shell/src/shell.test.ts README.md
git commit -m "feat(train): Cargo Yard in the bundle — sounds, the module, the catalog tile

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Play it in the browser and tune

**Files:**
- Modify: whatever the checks below turn up (most likely `games/train/src/view/geometry.ts` positions and `scripts/cut-train.py` boxes)

- [ ] **Step 1: Start the dev server**

Run (in the background): `npm run dev:ipad -- --port 5173 --strictPort`

- [ ] **Step 2: Render frames to check**

Chrome throttles `requestAnimationFrame` in an automation tab, so drive the game by hand: in a tab on `http://localhost:5173/?game=train`, import `/@fs/<repo>/games/train/src/driver.ts`, `view/scene.ts` and `view/sprites.ts`, build a driver and scene on a 1152×768 canvas, step frames, and screenshot. Check, fixing as you go:
- the trains sit on the painted rails and their signs where the painted signs were; nothing painted out shows a seam;
- the queue runs along the floor from the port side to the signal at its right end, crates readable, numbers clear;
- dragging a crate over each track previews the sum on that track's sign (green, white, red);
- sent trains steam off right; broken ones tilt, smoke, the crew and the repair bar show; fresh trains roll in from the left;
- a star train: gold pulsing sign, judder, its stopwatch counting down, the bonus clearing the right half of the queue with stars;
- the band banner, "Speed up!", the coach line, the danger tint and blinking signal, the pause card and the summary card.

- [ ] **Step 3: Play a run on the iPad**

Open the Network address on the iPad (`http://192.168.x.x:5173/?game=train`) and play two runs end to end. Note anything that feels off (crate size for small fingers, drop areas, pace) and fix it.

- [ ] **Step 4: Run everything and commit**

Run: `npm run typecheck && npx vitest run`
Expected: all pass.

```bash
git add -A games/train scripts/cut-train.py
git commit -m "fix(train): positions and art tuned against the painted yard

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
