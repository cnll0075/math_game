# Seesaw Math Game Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a ten-game-bundle monorepo with a minimal shell and the seesaw math game (vertical slice plus puzzle Levels 1–5) as its first module.

**Architecture:** Pure TypeScript logic core computes the seesaw's exact mathematical state; a canvas presentation layer subscribes to that state and never feeds back into it. Art and sound are reached only through swappable `SeesawTheme` and `SoundPack` interfaces. The shell owns audio, storage, settings, and entitlements, and hands them to games through a `GameHost`.

**Tech Stack:** TypeScript, npm workspaces, Vite, Vitest (jsdom for DOM tests), Canvas 2D, Web Audio.

**Spec:** `docs/superpowers/specs/2026-09-12-seesaw-math-game-design.md`

## Global Constraints

- TypeScript strict mode on in every package.
- No runtime dependencies beyond the browser platform. Vite and Vitest are dev dependencies only. No game framework, no audio files, no image files.
- Animal weights live only in the animal catalog: rabbit 1, cat 2, dog 3, bear 5.
- No gameplay code branches on a level number.
- Perfect balance is `leftWeight === rightWeight` with at least one animal placed, edge-triggered. Never derived from the rendered angle.
- Default zone thresholds: green `|d| <= 1`, yellow `|d| <= 3`, red beyond. Default `maxTiltDifference` 6. Both overridable per level.
- Design space is 1024×768, letterboxed, drawn at device pixel ratio.
- Background music defaults to off.
- Every file has one responsibility; prefer small files.

---

### Task 1: Monorepo scaffolding

**Files:**
- Create: `package.json`, `tsconfig.base.json`, `vitest.config.ts`, `.gitignore`
- Create: `packages/core/package.json`, `packages/core/tsconfig.json`
- Create: `games/seesaw/package.json`, `games/seesaw/tsconfig.json`
- Create: `apps/shell/package.json`, `apps/shell/tsconfig.json`
- Test: `packages/core/src/smoke.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: workspace names `@bundle/core`, `@bundle/seesaw`, `@bundle/shell`; `npm test` runs Vitest across all workspaces; `npm run dev` runs the shell's Vite server.

- [ ] **Step 1: Write the failing test**

```ts
// packages/core/src/smoke.test.ts
import { describe, it, expect } from 'vitest';

describe('toolchain', () => {
  it('runs typescript tests', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npm test`
Expected: FAIL — no package.json / vitest not installed.

- [ ] **Step 3: Create the workspace root**

Root `package.json` declares `"workspaces": ["packages/*", "games/*", "apps/*"]`, `"type": "module"`, scripts `test` (`vitest run`), `test:watch`, `typecheck` (`tsc -b`), `dev` (`vite --config apps/shell/vite.config.ts`), `build`. Dev dependencies: `typescript`, `vite`, `vitest`, `jsdom`, `@types/node`.

`tsconfig.base.json`: `strict: true`, `target: ES2022`, `module: ESNext`, `moduleResolution: bundler`, `noUncheckedIndexedAccess: true`, `noEmit: true`.

Each workspace `package.json` sets its name and `"main": "src/index.ts"`. Each `tsconfig.json` extends the base.

`vitest.config.ts` sets `environment: 'node'` by default and resolves aliases `@bundle/core` → `packages/core/src`, `@bundle/seesaw` → `games/seesaw/src`. DOM tests opt in with `// @vitest-environment jsdom`.

`.gitignore`: `node_modules/`, `dist/`, `.DS_Store`, `*.local`.

- [ ] **Step 4: Install and run the test**

Run: `npm install && npm test`
Expected: PASS, one test.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "chore: scaffold monorepo with vitest"
```

---

### Task 2: Core primitives — RNG, ticker, storage

**Files:**
- Create: `packages/core/src/rng.ts`, `packages/core/src/ticker.ts`, `packages/core/src/storage.ts`
- Test: `packages/core/src/rng.test.ts`, `packages/core/src/ticker.test.ts`, `packages/core/src/storage.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `createRng(seed: number): Rng` where `Rng = { next(): number; int(maxExclusive: number): number; pick<T>(items: readonly T[]): T }`
  - `createTicker(onTick: (dtSeconds: number) => void, raf?: RafLike): Ticker` where `Ticker = { start(): void; stop(): void; readonly running: boolean }`, dt clamped to 0.1s max
  - `createProfileStore(backend?: StorageBackend): ProfileStore` where `ProfileStore = { namespace(gameId: string): GameStore }` and `GameStore = { get<T>(key: string, fallback: T): T; set<T>(key: string, value: T): void }`

- [ ] **Step 1: Write the failing tests**

```ts
// rng.test.ts
it('is deterministic for a seed', () => {
  const a = createRng(42), b = createRng(42);
  expect([a.next(), a.next(), a.next()]).toEqual([b.next(), b.next(), b.next()]);
});
it('produces values in [0,1)', () => {
  const r = createRng(7);
  for (let i = 0; i < 500; i++) { const v = r.next(); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1); }
});
it('picks in range', () => {
  const r = createRng(1);
  for (let i = 0; i < 100; i++) expect(r.int(5)).toBeLessThan(5);
});

// ticker.test.ts — inject a fake raf so no real time passes
it('reports seconds between frames', () => {
  const frames: Array<(t: number) => void> = [];
  const raf = (cb: (t: number) => void) => { frames.push(cb); return frames.length; };
  const dts: number[] = [];
  const ticker = createTicker(dt => dts.push(dt), { request: raf, cancel: () => {} });
  ticker.start();
  frames[0]!(1000); frames[1]!(1016);
  expect(dts[1]).toBeCloseTo(0.016, 3);
});
it('clamps a long stall', () => { /* deliver t=0 then t=5000, expect dt <= 0.1 */ });
it('stops delivering after stop()', () => { /* ... */ });

// storage.test.ts
it('round-trips values', () => {
  const store = createProfileStore(memoryBackend()).namespace('seesaw');
  store.set('level', 3);
  expect(store.get('level', 0)).toBe(3);
});
it('namespaces games apart', () => {
  const profile = createProfileStore(memoryBackend());
  profile.namespace('seesaw').set('level', 3);
  expect(profile.namespace('counting').get('level', 0)).toBe(0);
});
it('falls back to memory when the backend throws', () => {
  const hostile: StorageBackend = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
  const store = createProfileStore(hostile).namespace('seesaw');
  store.set('level', 2);
  expect(store.get('level', 0)).toBe(2);
});
it('returns the fallback for corrupt json', () => { /* backend returns "{{{" */ });
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- rng ticker storage`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

`rng.ts`: mulberry32. `ticker.ts`: rAF wrapper with injectable `RafLike = { request, cancel }`, defaulting to `globalThis.requestAnimationFrame`; first frame emits dt 0. `storage.ts`: `StorageBackend = Pick<Storage, 'getItem' | 'setItem'>`, defaulting to `localStorage`; every access wrapped in try/catch falling back to an internal `Map`; keys written as `bundle:<gameId>:<key>`, values JSON.

- [ ] **Step 4: Run tests**

Run: `npm test -- rng ticker storage`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(core): seeded rng, frame ticker, namespaced storage"
```

---

### Task 3: Core audio bus and synth sound pack

**Files:**
- Create: `packages/core/src/audio/audio-bus.ts`, `packages/core/src/audio/sound-pack.ts`, `packages/core/src/audio/synth.ts`
- Test: `packages/core/src/audio/audio-bus.test.ts`, `packages/core/src/audio/synth.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `AudioBus = { readonly context: AudioContext | null; readonly destination: AudioNode | null; muted: boolean; volume: number; unlock(): Promise<void>; }`
  - `createAudioBus(factory?: () => AudioContext | null): AudioBus`
  - `interface SoundPack { preload(): Promise<void>; play(event: string, params?: Record<string, number>): void }`
  - `tone(bus, { freq, duration, type, gain, attack, decay, detune, sweepTo })` — one shaped oscillator voice
  - `noiseBurst(bus, { duration, gain, filterHz, sweepTo })`

- [ ] **Step 1: Write the failing tests**

Tests use a hand-written fake AudioContext recording created nodes, so no Web Audio is needed:

```ts
it('creates no context until unlocked', () => {
  const bus = createAudioBus(() => fakeContext());
  expect(bus.context).toBeNull();
});
it('routes through a gain node at the set volume', async () => {
  const ctx = fakeContext();
  const bus = createAudioBus(() => ctx);
  await bus.unlock();
  bus.volume = 0.5;
  expect(ctx.createdGains[0]!.gain.value).toBeCloseTo(0.5);
});
it('drops output to zero when muted', async () => { /* muted = true → master gain 0 */ });
it('never throws when the context cannot be created', async () => {
  const bus = createAudioBus(() => null);
  await expect(bus.unlock()).resolves.toBeUndefined();
  expect(() => tone(bus, { freq: 440, duration: 0.1 })).not.toThrow();
});
it('tone schedules one oscillator with an envelope', async () => {
  const ctx = fakeContext(); const bus = createAudioBus(() => ctx); await bus.unlock();
  tone(bus, { freq: 880, duration: 0.2 });
  expect(ctx.createdOscillators).toHaveLength(1);
  expect(ctx.createdOscillators[0]!.frequency.value).toBe(880);
  expect(ctx.createdOscillators[0]!.stopped).toBe(true);
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- audio`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

`audio-bus.ts` lazily builds the context on `unlock()` (iOS requires a gesture), owns a master `GainNode`, and applies `muted ? 0 : volume`. Every public method is wrapped so a missing or failed context degrades to silence. `synth.ts` holds `tone` and `noiseBurst`, both no-ops when the bus has no context. `sound-pack.ts` declares the `SoundPack` interface only.

- [ ] **Step 4: Run tests**

Run: `npm test -- audio`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(core): audio bus with synth voices that degrade to silence"
```

---

### Task 4: Core host contract — settings, entitlements, GameModule

**Files:**
- Create: `packages/core/src/settings.ts`, `packages/core/src/entitlements.ts`, `packages/core/src/game-module.ts`, `packages/core/src/index.ts`
- Test: `packages/core/src/settings.test.ts`, `packages/core/src/entitlements.test.ts`

**Interfaces:**
- Consumes: `AudioBus` (Task 3), `ProfileStore` (Task 2).
- Produces:
  - `createSettings(store: GameStore): Settings` where `Settings = { readonly values: SettingsValues; set<K extends keyof SettingsValues>(key: K, value: SettingsValues[K]): void; subscribe(fn: (v: SettingsValues) => void): () => void }` and `SettingsValues = { muted: boolean; music: boolean; volume: number }` with defaults `{ muted: false, music: false, volume: 0.8 }`
  - `createContentManifest(unlocked: 'all' | readonly string[]): ContentManifest` where `ContentManifest = { isUnlocked(contentId: string): boolean }`
  - `GameHost`, `GameModule`, `GameSession` interfaces exactly as in spec §5
  - `packages/core/src/index.ts` re-exports every public symbol

- [ ] **Step 1: Write the failing tests**

```ts
it('defaults music to off', () => {
  expect(createSettings(memoryStore()).values.music).toBe(false);
});
it('persists a change and notifies subscribers', () => {
  const store = memoryStore();
  const s = createSettings(store);
  const seen: boolean[] = [];
  s.subscribe(v => seen.push(v.muted));
  s.set('muted', true);
  expect(seen).toEqual([true]);
  expect(createSettings(store).values.muted).toBe(true);   // reloaded from the store
});
it('stops notifying after unsubscribe', () => { /* ... */ });
it('unlocks everything under the all manifest', () => {
  expect(createContentManifest('all').isUnlocked('seesaw:level-5')).toBe(true);
});
it('unlocks only listed content otherwise', () => {
  const m = createContentManifest(['seesaw:level-1']);
  expect(m.isUnlocked('seesaw:level-1')).toBe(true);
  expect(m.isUnlocked('seesaw:level-2')).toBe(false);
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- settings entitlements`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

Settings read defaults from the store on construction and write through on every `set`. `entitlements.ts` is deliberately trivial — it is the single place a real purchase check will later replace. `game-module.ts` is types only.

- [ ] **Step 4: Run tests**

Run: `npm test -- settings entitlements`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(core): settings, stubbed entitlements, game module contract"
```

---

### Task 5: Animal catalog and seesaw state math

**Files:**
- Create: `games/seesaw/src/logic/animals.ts`, `games/seesaw/src/logic/seesaw-state.ts`
- Test: `games/seesaw/src/logic/animals.test.ts`, `games/seesaw/src/logic/seesaw-state.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type AnimalId = 'rabbit' | 'cat' | 'dog' | 'bear'`
  - `interface AnimalDef { id: AnimalId; weight: number; label: string; palette: { body: string; accent: string; belly: string }; voice: { freq: number; duration: number } }`
  - `ANIMALS: Record<AnimalId, AnimalDef>`, `weightOf(id: AnimalId): number`
  - `type Side = 'left' | 'right'`
  - `interface PlacedAnimal { uid: string; species: AnimalId; side: Side }`
  - `interface BalanceConfig { maxTiltDifference: number; green: number; yellow: number }`, `DEFAULT_BALANCE_CONFIG`
  - `type Zone = 'green' | 'yellow' | 'red'`
  - `interface SeesawSnapshot { leftWeight; rightWeight; balanceDifference; normalizedBalance; zone; heavySide: Side | null; totalAnimals: number; isPerfectlyBalanced: boolean }`
  - `describeSeesaw(placed: readonly PlacedAnimal[], config?: BalanceConfig): SeesawSnapshot`

- [ ] **Step 1: Write the failing tests**

```ts
it('uses the documented weights', () => {
  expect([ANIMALS.rabbit.weight, ANIMALS.cat.weight, ANIMALS.dog.weight, ANIMALS.bear.weight]).toEqual([1, 2, 3, 5]);
});

const place = (side: Side, ...species: AnimalId[]): PlacedAnimal[] =>
  species.map((s, i) => ({ uid: `${side}-${s}-${i}`, species: s, side }));

it('sums each side', () => {
  const s = describeSeesaw([...place('left', 'cat', 'rabbit'), ...place('right', 'dog')]);
  expect(s.leftWeight).toBe(3);
  expect(s.rightWeight).toBe(3);
});
it('reports the heavier side as positive difference on the left', () => {
  const s = describeSeesaw(place('left', 'bear'));
  expect(s.balanceDifference).toBe(5);
  expect(s.heavySide).toBe('left');
});
it('has no heavy side when equal', () => {
  const s = describeSeesaw([...place('left', 'cat'), ...place('right', 'rabbit', 'rabbit')]);
  expect(s.heavySide).toBeNull();
  expect(s.isPerfectlyBalanced).toBe(true);
});
it('is not perfectly balanced while empty', () => {
  expect(describeSeesaw([]).isPerfectlyBalanced).toBe(false);
});
it('clamps normalized balance to the range', () => {
  const s = describeSeesaw(place('left', 'bear', 'bear', 'bear'));
  expect(s.normalizedBalance).toBe(1);
});
it('normalizes proportionally inside the range', () => {
  const s = describeSeesaw(place('left', 'dog'));   // diff 3, max 6
  expect(s.normalizedBalance).toBeCloseTo(0.5);
});
it('maps differences to zones', () => {
  expect(describeSeesaw(place('left', 'rabbit')).zone).toBe('green');
  expect(describeSeesaw(place('left', 'dog')).zone).toBe('yellow');
  expect(describeSeesaw(place('left', 'bear')).zone).toBe('red');
});
it('honours per-level thresholds', () => {
  const config = { maxTiltDifference: 10, green: 2, yellow: 6 };
  expect(describeSeesaw(place('left', 'cat'), config).zone).toBe('green');
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- seesaw-state animals`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

`describeSeesaw` is a pure fold over the placed animals. `isPerfectlyBalanced` requires `totalAnimals > 0`.

- [ ] **Step 4: Run tests**

Run: `npm test -- seesaw-state animals`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(seesaw): animal catalog and pure balance state"
```

---

### Task 6: Objectives

**Files:**
- Create: `games/seesaw/src/logic/objectives.ts`
- Test: `games/seesaw/src/logic/objectives.test.ts`

**Interfaces:**
- Consumes: `SeesawSnapshot` (Task 5).
- Produces:
  - `type Objective = { kind: 'balance' } | { kind: 'sideDown'; side: Side } | { kind: 'tilt'; target: number } | { kind: 'sequence'; challenges: readonly Objective[] }`
  - `isSatisfied(objective: Objective, snapshot: SeesawSnapshot): boolean` — for `sequence`, tests the *current* challenge only via `currentChallenge`
  - `currentChallenge(objective: Objective, stage: number): Objective`
  - `stageCount(objective: Objective): number`
  - `describeObjective(objective: Objective): string` — short kid-facing caption, e.g. `'Make it level'`, `'Make the right side go down'`, `'Reach the star'`

- [ ] **Step 1: Write the failing tests**

```ts
const snap = (left: number, right: number) => describeSeesaw([
  ...Array.from({ length: left }, (_, i) => ({ uid: `l${i}`, species: 'rabbit' as const, side: 'left' as const })),
  ...Array.from({ length: right }, (_, i) => ({ uid: `r${i}`, species: 'rabbit' as const, side: 'right' as const })),
]);

it('balance is satisfied only by equality with animals present', () => {
  expect(isSatisfied({ kind: 'balance' }, snap(3, 3))).toBe(true);
  expect(isSatisfied({ kind: 'balance' }, snap(3, 2))).toBe(false);
  expect(isSatisfied({ kind: 'balance' }, snap(0, 0))).toBe(false);
});
it('sideDown needs that side strictly heavier', () => {
  expect(isSatisfied({ kind: 'sideDown', side: 'right' }, snap(1, 2))).toBe(true);
  expect(isSatisfied({ kind: 'sideDown', side: 'right' }, snap(2, 2))).toBe(false);
  expect(isSatisfied({ kind: 'sideDown', side: 'right' }, snap(3, 2))).toBe(false);
});
it('tilt needs the exact difference', () => {
  expect(isSatisfied({ kind: 'tilt', target: -3 }, snap(1, 4))).toBe(true);
  expect(isSatisfied({ kind: 'tilt', target: -3 }, snap(1, 5))).toBe(false);
});
it('reports the current challenge of a sequence', () => {
  const seq = { kind: 'sequence', challenges: [{ kind: 'balance' }, { kind: 'sideDown', side: 'right' }] } as const;
  expect(currentChallenge(seq, 1)).toEqual({ kind: 'sideDown', side: 'right' });
  expect(stageCount(seq)).toBe(2);
});
it('treats a non-sequence as a single stage', () => {
  expect(stageCount({ kind: 'balance' })).toBe(1);
  expect(currentChallenge({ kind: 'balance' }, 0)).toEqual({ kind: 'balance' });
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- objectives`
Expected: FAIL.

- [ ] **Step 3: Implement**

Exhaustive `switch` with a `never` default so a new objective kind fails to compile until handled.

- [ ] **Step 4: Run tests**

Run: `npm test -- objectives`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(seesaw): objective evaluators"
```

---

### Task 7: Game reducer and events

**Files:**
- Create: `games/seesaw/src/logic/game.ts`
- Test: `games/seesaw/src/logic/game.test.ts`

**Interfaces:**
- Consumes: Tasks 5 and 6, `LevelDef` (Task 8 — define the type here as an import-only dependency and let Task 8 supply the data).
- Produces:
  - `createGame(level: LevelDef): Game`
  - `Game = { readonly state: GameState; place(trayIndex: number, side: Side): GameEvent[]; takeBack(uid: string): GameEvent[]; reset(): GameEvent[]; snapshot(): SeesawSnapshot }`
  - `GameState = { placed: readonly PlacedAnimal[]; tray: readonly TrayItem[]; stage: number; status: 'playing' | 'won' }`
  - `TrayItem = { uid: string; species: AnimalId; used: boolean }`
  - `GameEvent = { type: 'placed'; animal: PlacedAnimal } | { type: 'takenBack'; animal: PlacedAnimal } | { type: 'perfectBalance' } | { type: 'zoneChanged'; from: Zone; to: Zone } | { type: 'stageCleared'; stage: number } | { type: 'levelCleared' } | { type: 'reset' }`

Placement rules: placing from an already-used tray index is a no-op returning `[]`; placing while `status === 'won'` is a no-op.

- [ ] **Step 1: Write the failing tests**

```ts
const level: LevelDef = {
  id: 'test', mode: 'puzzle', objective: { kind: 'balance' },
  initial: { left: ['rabbit'], right: [] }, tray: ['rabbit', 'cat'],
};

it('starts with the initial animals placed and nothing won', () => {
  const g = createGame(level);
  expect(g.state.placed).toHaveLength(1);
  expect(g.state.status).toBe('playing');
});
it('emits placed and moves the tray item to used', () => {
  const g = createGame(level);
  const events = g.place(0, 'right');
  expect(events).toContainEqual(expect.objectContaining({ type: 'placed' }));
  expect(g.state.tray[0]!.used).toBe(true);
});
it('emits perfectBalance exactly once on entering equality', () => {
  const g = createGame(level);
  const first = g.place(0, 'right');                       // 1 vs 1
  expect(first.filter(e => e.type === 'perfectBalance')).toHaveLength(1);
  const second = g.place(1, 'right');                      // 1 vs 3 — leaves equality
  expect(second.some(e => e.type === 'perfectBalance')).toBe(false);
});
it('re-emits perfectBalance when equality is re-entered', () => {
  const g = createGame(level);
  g.place(0, 'right');
  g.place(1, 'right');
  const events = g.takeBack(g.state.placed.at(-1)!.uid);
  expect(events.filter(e => e.type === 'perfectBalance')).toHaveLength(1);
});
it('emits levelCleared when the objective is met', () => {
  const g = createGame(level);
  expect(g.place(0, 'right').some(e => e.type === 'levelCleared')).toBe(true);
  expect(g.state.status).toBe('won');
});
it('ignores placement from a used tray slot', () => {
  const g = createGame({ ...level, objective: { kind: 'tilt', target: 99 } });
  g.place(0, 'right');
  expect(g.place(0, 'left')).toEqual([]);
});
it('returns an animal to the tray on take-back', () => {
  const g = createGame({ ...level, objective: { kind: 'tilt', target: 99 } });
  g.place(0, 'right');
  g.takeBack(g.state.placed.at(-1)!.uid);
  expect(g.state.tray[0]!.used).toBe(false);
  expect(g.state.placed).toHaveLength(1);
});
it('cannot take back an animal from the initial layout', () => {
  const g = createGame(level);
  expect(g.takeBack(g.state.placed[0]!.uid)).toEqual([]);
});
it('advances stages through a sequence', () => {
  const seq: LevelDef = {
    id: 'seq', mode: 'puzzle',
    objective: { kind: 'sequence', challenges: [{ kind: 'balance' }, { kind: 'sideDown', side: 'right' }] },
    initial: { left: ['rabbit'], right: [] }, tray: ['rabbit', 'cat'],
  };
  const g = createGame(seq);
  const a = g.place(0, 'right');
  expect(a).toContainEqual({ type: 'stageCleared', stage: 0 });
  expect(g.state.stage).toBe(1);
  expect(g.state.status).toBe('playing');
  const b = g.place(1, 'right');
  expect(b.some(e => e.type === 'levelCleared')).toBe(true);
});
it('emits zoneChanged only on transitions', () => { /* place bear → green→red once; placing again in red emits nothing */ });
it('reset restores the initial layout and clears the tray', () => { /* ... */ });
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- logic/game`
Expected: FAIL.

- [ ] **Step 3: Implement**

Keep previous zone and previous `isPerfectlyBalanced` on the instance; diff after each mutation to produce edge-triggered events. Initial animals get uids prefixed `init-` and are rejected by `takeBack`. A cleared stage that is the last stage also emits `levelCleared` and sets `status: 'won'`.

- [ ] **Step 4: Run tests**

Run: `npm test -- logic/game`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(seesaw): game reducer with edge-triggered events"
```

---

### Task 8: Level data and the solvability test

**Files:**
- Create: `games/seesaw/src/logic/level.ts`, `games/seesaw/src/logic/levels.data.ts`
- Test: `games/seesaw/src/logic/levels.test.ts`

**Interfaces:**
- Consumes: Tasks 5–7.
- Produces:
  - `interface LevelDef { id: string; mode: 'puzzle'; title: string; objective: Objective; initial: { left: readonly AnimalId[]; right: readonly AnimalId[] }; tray: readonly AnimalId[]; balance?: Partial<BalanceConfig> }`
  - `LEVELS: readonly LevelDef[]` — five levels
  - `getLevel(id: string): LevelDef | undefined`
  - `balanceConfigFor(level: LevelDef): BalanceConfig`
  - `solutionsFor(level: LevelDef): TraySelection[]` — exhaustive search over every assignment of each tray animal to left, right, or unused; returns the assignments that satisfy the whole objective (all stages in order for a sequence)

Level content:

1. `level-1` "Balance" — initial L `rabbit,rabbit,rabbit` / R `rabbit`; tray `rabbit,rabbit`; objective `balance`.
2. `level-2` "Same Weight" — initial L `cat` / R empty; tray `rabbit,rabbit,cat`; objective `balance`.
3. `level-3` "Go Down" — initial L `dog` / R `rabbit`; tray `cat,rabbit,dog`; objective `sideDown` right.
4. `level-4` "Reach the Star" — initial L `bear` / R `cat` (difference +3); tray `dog,cat,rabbit,rabbit,cat`; objective `{ kind: 'tilt', target: -1 }`. The star marker sits slightly below level on the right, so the player must add exactly four units more to the right than to the left — reachable as dog+rabbit, cat+cat, or cat+rabbit+rabbit, giving several distinct solutions while staying visibly different from "make it level".
5. `level-5` "Three Challenges" — initial L `cat` / R `rabbit`; tray `rabbit,rabbit,dog,cat,rabbit,bear`; objective `sequence` of `balance`, `sideDown` right, `tilt` target `-2`.

- [ ] **Step 1: Write the failing tests**

```ts
it('defines five puzzle levels with unique ids', () => {
  expect(LEVELS).toHaveLength(5);
  expect(new Set(LEVELS.map(l => l.id)).size).toBe(5);
});

it.each(LEVELS.map(l => [l.id, l] as const))('level %s is solvable from its tray', (_id, level) => {
  expect(solutionsFor(level).length).toBeGreaterThan(0);
});

it('level 4 accepts several different combinations', () => {
  const solutions = solutionsFor(getLevel('level-4')!);
  const shapes = new Set(solutions.map(s => JSON.stringify(s)));
  expect(shapes.size).toBeGreaterThanOrEqual(3);
});

it('a solution really drives the game to won', () => {
  for (const level of LEVELS) {
    const solution = solutionsFor(level)[0]!;
    const game = createGame(level);
    for (const move of solution) game.place(move.trayIndex, move.side);
    expect(game.state.status, level.id).toBe('won');
  }
});

it('rejects a level whose tray cannot reach the objective', () => {
  const impossible: LevelDef = { id: 'x', mode: 'puzzle', title: 'x', objective: { kind: 'tilt', target: 99 }, initial: { left: [], right: [] }, tray: ['rabbit'] };
  expect(solutionsFor(impossible)).toEqual([]);
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- levels`
Expected: FAIL.

- [ ] **Step 3: Implement**

`solutionsFor` enumerates ordered placements (tray items are placed in index order; for a sequence, it searches for a prefix that clears stage 0, then continues from that state, matching how the reducer actually advances). Tray sizes stay at or below eight, so the search space is bounded.

- [ ] **Step 4: Run tests**

Run: `npm test -- levels`
Expected: PASS, and the solver confirms each level.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(seesaw): levels 1-5 with an exhaustive solvability test"
```

---

### Task 9: View math — spring, layout, timing

**Files:**
- Create: `games/seesaw/src/view/spring.ts`, `games/seesaw/src/view/layout.ts`, `games/seesaw/src/view/timing.ts`
- Test: `games/seesaw/src/view/spring.test.ts`, `games/seesaw/src/view/layout.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `createSpring(initial: number, options?: { stiffness?: number; damping?: number }): Spring` where `Spring = { value: number; target: number; velocity: number; step(dt: number): void; readonly settled: boolean }`
  - `fitToScreen(screen: { width: number; height: number }, design = { width: 1024, height: 768 }): ViewTransform` where `ViewTransform = { scale: number; offsetX: number; offsetY: number; toScreen(p: Point): Point }`
  - `slotPositions(count: number, platform: { width: number }): number[]` — evenly spaced x offsets, never overlapping for counts one through five, symmetric about zero
  - `TIMING = { settleSeconds: 0.45, dingDelaySeconds: 0.12, hopSeconds: 0.35, gateSeconds: 1.2, flagRaiseSeconds: 0.3 }`

- [ ] **Step 1: Write the failing tests**

```ts
it('converges to the target', () => {
  const s = createSpring(0); s.target = 1;
  for (let i = 0; i < 200; i++) s.step(1 / 60);
  expect(s.value).toBeCloseTo(1, 3);
  expect(s.settled).toBe(true);
});
it('settles within the configured time', () => {
  const s = createSpring(0); s.target = 1;
  let t = 0;
  while (!s.settled && t < 2) { s.step(1 / 60); t += 1 / 60; }
  expect(t).toBeLessThan(TIMING.settleSeconds * 2);
});
it('does not overshoot appreciably', () => {
  const s = createSpring(0); s.target = 1;
  let max = 0;
  for (let i = 0; i < 200; i++) { s.step(1 / 60); max = Math.max(max, s.value); }
  expect(max).toBeLessThan(1.05);
});
it('stays finite under a huge dt', () => {
  const s = createSpring(0); s.target = 1; s.step(10);
  expect(Number.isFinite(s.value)).toBe(true);
});
it('letterboxes a wide screen', () => {
  const t = fitToScreen({ width: 2048, height: 1024 });
  expect(t.scale).toBeCloseTo(1024 / 768);
  expect(t.offsetX).toBeGreaterThan(0);
  expect(t.offsetY).toBeCloseTo(0);
});
it('centres the design space', () => { /* offset math for a tall screen */ });
it('spaces animal slots without overlap', () => {
  for (let n = 1; n <= 5; n++) {
    const xs = slotPositions(n, { width: 300 });
    expect(xs).toHaveLength(n);
    for (let i = 1; i < n; i++) expect(xs[i]! - xs[i - 1]!).toBeGreaterThan(40);
    expect(xs[0]! + xs[n - 1]!).toBeCloseTo(0);      // symmetric
  }
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- spring layout`
Expected: FAIL.

- [ ] **Step 3: Implement**

Semi-implicit Euler spring with critical damping defaults (`stiffness 180`, `damping 2*sqrt(stiffness)`), sub-stepping any `dt` above 1/60 so a long stall cannot explode. `settled` is `|value - target| < 0.001 && |velocity| < 0.001`.

- [ ] **Step 4: Run tests**

Run: `npm test -- spring layout`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(seesaw): spring, letterbox layout, timing constants"
```

---

### Task 10: Theme interface and the vector theme

**Files:**
- Create: `games/seesaw/src/view/theme.ts`, `games/seesaw/src/view/vector-theme.ts`, `games/seesaw/src/view/animals-art.ts`
- Test: `games/seesaw/src/view/vector-theme.test.ts`

**Interfaces:**
- Consumes: `AnimalId` (Task 5).
- Produces: `SeesawTheme`, `AnimalArtist`, `AnimalPose` exactly as spec §9.1; `createVectorTheme(): SeesawTheme`.

- [ ] **Step 1: Write the failing test**

Verify the contract with a recording fake context rather than pixels:

```ts
const recorder = () => { const calls: string[] = []; return { calls, ctx: new Proxy({}, {
  get: (_t, prop: string) => {
    if (['canvas', 'fillStyle', 'strokeStyle', 'lineWidth', 'globalAlpha', 'font', 'textAlign', 'lineCap', 'lineJoin'].includes(prop)) return undefined;
    return (...args: unknown[]) => { calls.push(prop); return prop === 'createLinearGradient' ? { addColorStop() {} } : undefined; };
  },
  set: () => true,
}) as unknown as CanvasRenderingContext2D }; };

it('draws each animal species without throwing', async () => {
  const theme = createVectorTheme();
  await theme.preload();
  for (const species of ['rabbit', 'cat', 'dog', 'bear'] as const) {
    const { ctx, calls } = recorder();
    theme.animals.draw(ctx, species, { x: 0, y: 0, scale: 1, tiltRad: 0.1, wobble: 0.5, slide: 4, expression: 'surprised' });
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.filter(c => c === 'save').length).toBe(calls.filter(c => c === 'restore').length);
  }
});
it('balances save/restore for every scene element', async () => { /* same check for background, seesaw, gauge, flag, gate */ });
it('draws all three expressions', () => { /* each expression produces calls */ });
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- vector-theme`
Expected: FAIL.

- [ ] **Step 3: Implement**

`animals-art.ts` draws each species from primitives: rabbit (small body, tall ears), cat (medium body, triangular ears, curled tail), dog (square snout, floppy ears), bear (large round body, small round ears). Expression changes eyes and mouth only. `wobble` rotates the body a few degrees; `slide` offsets along the plank. `vector-theme.ts` draws sky, hills, trees, clouds, fence, flowers, the plank and fulcrum, the two platforms, the gauge, the flag, and the gate.

- [ ] **Step 4: Run tests**

Run: `npm test -- vector-theme`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(seesaw): swappable theme interface and vector prototype art"
```

---

### Task 11: Seesaw sound pack

**Files:**
- Create: `games/seesaw/src/audio/seesaw-sounds.ts`
- Test: `games/seesaw/src/audio/seesaw-sounds.test.ts`

**Interfaces:**
- Consumes: `AudioBus`, `tone`, `noiseBurst`, `SoundPack` (Task 3).
- Produces: `createSynthSoundPack(bus: AudioBus): SoundPack`; event names `'ding' | 'creak' | 'land' | 'danger' | 'success' | 'gate' | 'chirp:rabbit' | 'chirp:cat' | 'chirp:dog' | 'chirp:bear'`; exported `SOUND_EVENTS` listing all of them for the sound lab.

- [ ] **Step 1: Write the failing tests**

```ts
it('plays every catalogued event without throwing', async () => {
  const ctx = fakeContext(); const bus = createAudioBus(() => ctx); await bus.unlock();
  const pack = createSynthSoundPack(bus);
  for (const event of SOUND_EVENTS) expect(() => pack.play(event)).not.toThrow();
  expect(ctx.createdOscillators.length).toBeGreaterThan(SOUND_EVENTS.length);
});
it('gives the ding at least two partials', async () => {
  const ctx = fakeContext(); const bus = createAudioBus(() => ctx); await bus.unlock();
  createSynthSoundPack(bus).play('ding');
  expect(ctx.createdOscillators.length).toBeGreaterThanOrEqual(2);
});
it('stays silent and safe before unlock', () => {
  const pack = createSynthSoundPack(createAudioBus(() => null));
  expect(() => pack.play('ding')).not.toThrow();
});
it('ignores an unknown event', () => { /* play('nope') does not throw */ });
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- seesaw-sounds`
Expected: FAIL.

- [ ] **Step 3: Implement**

Ding: 880 Hz plus 1320 Hz partial, exponential decay ~1.2 s. Creak: filtered noise 0.25 s with a downward sweep. Land: short low thump. Danger: two 160 Hz square blips. Success: four-note arpeggio. Gate: click plus creak. Chirps: each species' `voice` from the animal catalog.

- [ ] **Step 4: Run tests**

Run: `npm test -- seesaw-sounds`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(seesaw): synthesised sound pack"
```

---

### Task 12: Scene renderer

**Files:**
- Create: `games/seesaw/src/view/scene.ts`
- Test: `games/seesaw/src/view/scene.test.ts`

**Interfaces:**
- Consumes: Tasks 5, 9, 10.
- Produces:
  - `createScene(theme: SeesawTheme): Scene`
  - `Scene = { update(dt: number, model: SceneModel): void; render(ctx: CanvasRenderingContext2D, screen: { width: number; height: number }): void; readonly tiltSettled: boolean; readonly plankAngle: number }`
  - `SceneModel = { snapshot: SeesawSnapshot; placed: readonly PlacedAnimal[]; dangerFlag: boolean; gateOpen: number; celebrate: boolean }`

- [ ] **Step 1: Write the failing tests**

```ts
it('tilts toward the heavy side and settles', () => {
  const scene = createScene(createVectorTheme());
  const model = modelFor([{ uid: 'a', species: 'bear', side: 'left' }]);
  for (let i = 0; i < 200; i++) scene.update(1 / 60, model);
  expect(scene.plankAngle).toBeGreaterThan(0);
  expect(scene.tiltSettled).toBe(true);
});
it('reports unsettled immediately after a change', () => {
  const scene = createScene(createVectorTheme());
  scene.update(1 / 60, modelFor([]));
  scene.update(1 / 60, modelFor([{ uid: 'a', species: 'bear', side: 'left' }]));
  expect(scene.tiltSettled).toBe(false);
});
it('renders without throwing on a recorded context', () => {
  const scene = createScene(createVectorTheme());
  scene.update(1 / 60, modelFor([{ uid: 'a', species: 'cat', side: 'right' }]));
  const { ctx, calls } = recorder();
  scene.render(ctx, { width: 800, height: 600 });
  expect(calls).toContain('setTransform');
});
it('gives every placed animal a pose slot', () => { /* five per side does not overlap: assert slot xs strictly increasing */ });
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- view/scene`
Expected: FAIL.

- [ ] **Step 3: Implement**

The scene owns springs for plank angle, gauge needle, and flag height, plus per-animal wobble phases. `update` reads the model and sets spring targets; `render` applies the letterbox transform, then delegates every draw to the theme. The scene never mutates game state.

- [ ] **Step 4: Run tests**

Run: `npm test -- view/scene`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(seesaw): canvas scene driven by balance state"
```

---

### Task 13: Input and the game module

**Files:**
- Create: `games/seesaw/src/view/input.ts`, `games/seesaw/src/index.ts`
- Test: `games/seesaw/src/index.test.ts` (jsdom)

**Interfaces:**
- Consumes: everything above.
- Produces: `seesawGame: GameModule` with `id: 'seesaw'`; internally `createInput(canvas, handlers)` translating pointer events into `{ kind: 'pickTray'; index } | { kind: 'dropSide'; side } | { kind: 'takeBack'; uid }`.

Input rules: pointerdown on a tray animal arms it; pointerup over a platform places it; pointerup elsewhere disarms. A tap on a placed animal takes it back. Both mouse and touch go through pointer events. Input registers on the canvas and is removed on unmount.

- [ ] **Step 1: Write the failing tests**

```ts
// @vitest-environment jsdom
it('mounts a canvas and unmounts cleanly', async () => {
  const container = document.createElement('div');
  const session = await seesawGame.mount(container, testHost());
  expect(container.querySelector('canvas')).not.toBeNull();
  session.unmount();
  expect(container.childElementCount).toBe(0);
});
it('removes every listener and stops the ticker on unmount', async () => {
  const added: string[] = []; const removed: string[] = [];
  // spy on EventTarget.prototype.addEventListener/removeEventListener during mount
  expect(added.sort()).toEqual(removed.sort());
});
it('plays the ding when the player reaches balance', async () => {
  const host = testHost();
  const session = await seesawGame.mount(container, host);
  // drive the level through the exposed test hook rather than synthetic pointer maths
  session.__test!.place(0, 'right');
  await advanceFrames(session, 60);
  expect(host.playedSounds).toContain('ding');
});
it('pause stops the ticker and resume restarts it', async () => { /* ... */ });
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- index.test`
Expected: FAIL.

- [ ] **Step 3: Implement**

`mount` builds the canvas, resolves the level from `host.content` (locked levels are not selectable), wires `createGame`, `createScene`, `createInput`, `createSynthSoundPack`, and a `Ticker`. Game events map to sound calls; the `ding` is deferred until `scene.tiltSettled` becomes true after a `perfectBalance` event. `unmount` stops the ticker, removes listeners, and empties the container. A `__test` hook exposes `place`/`takeBack`/`step` under a clearly named property.

- [ ] **Step 4: Run tests**

Run: `npm test -- index.test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(seesaw): pointer input and the mountable game module"
```

---

### Task 14: Integration — play every level through the module

**Files:**
- Test: `games/seesaw/src/integration.test.ts` (jsdom)

**Interfaces:**
- Consumes: Tasks 8 and 13.
- Produces: nothing new; proves the stack.

- [ ] **Step 1: Write the failing test**

```ts
it.each(LEVELS.map(l => [l.id] as const))('plays %s to completion through the real module', async (id) => {
  const container = document.createElement('div');
  const host = testHost();
  const session = await seesawGame.mount(container, host, { startLevel: id });
  const solution = solutionsFor(getLevel(id)!)[0]!;
  for (const move of solution) { session.__test!.place(move.trayIndex, move.side); await advanceFrames(session, 40); }
  expect(session.__test!.status()).toBe('won');
  expect(host.playedSounds).toContain('success');
  session.unmount();
});

it('raises the danger flag in the red zone and lowers it on recovery', async () => { /* place bear alone, assert flag; balance it, assert cleared */ });
it('does not ding before the plank settles', async () => { /* place to equality, assert no ding on frame 1, ding by frame 40 */ });
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- integration`
Expected: FAIL until `startLevel` is threaded through `mount`.

- [ ] **Step 3: Implement**

Add the optional third `options` parameter to `seesawGame.mount`.

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: PASS, whole suite.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "test(seesaw): play every level end to end through the module"
```

---

### Task 15: Shell — launcher, settings, sound lab

**Files:**
- Create: `apps/shell/index.html`, `apps/shell/vite.config.ts`, `apps/shell/src/main.ts`, `apps/shell/src/launcher.ts`, `apps/shell/src/settings-panel.ts`, `apps/shell/src/sound-lab.ts`, `apps/shell/src/catalog.ts`, `apps/shell/src/shell.css`
- Test: `apps/shell/src/launcher.test.ts`, `apps/shell/src/shell.test.ts` (jsdom)

**Interfaces:**
- Consumes: `GameModule`, `GameHost`, core services, `seesawGame`.
- Produces: `createShell(root: HTMLElement, deps): Shell` with `Shell = { showLauncher(): void; openGame(id: string): Promise<void>; close(): void }`; `CATALOG: GameTile[]` with one playable entry and nine `comingSoon: true` placeholders.

- [ ] **Step 1: Write the failing tests**

```ts
// @vitest-environment jsdom
it('renders ten tiles, one playable', () => {
  const root = document.createElement('div');
  createShell(root, testDeps()).showLauncher();
  expect(root.querySelectorAll('[data-game-tile]')).toHaveLength(10);
  expect(root.querySelectorAll('[data-coming-soon]')).toHaveLength(9);
});
it('opens the seesaw game from its tile', async () => {
  const shell = createShell(root, testDeps());
  shell.showLauncher();
  root.querySelector<HTMLElement>('[data-game-tile="seesaw"]')!.click();
  await flush();
  expect(root.querySelector('canvas')).not.toBeNull();
});
it('returns to the launcher and unmounts the game', async () => { /* exit() → tiles back, no canvas */ });
it('toggling mute updates the audio bus', () => { /* settings panel checkbox → bus.muted true */ });
it('the sound lab lists a button per sound event', () => {
  expect(root.querySelectorAll('[data-sound-event]')).toHaveLength(SOUND_EVENTS.length);
});
it('locked games cannot be opened', async () => { /* manifest without seesaw → tile is disabled */ });
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- shell launcher`
Expected: FAIL.

- [ ] **Step 3: Implement**

The launcher is a CSS grid of large touch targets. The shell builds one `AudioBus`, one `ProfileStore`, one `Settings`, and one `ContentManifest`, and passes them into each game's `GameHost`. Settings expose mute, volume, and music. The sound lab is reachable from a small corner control and is hidden behind a five-second press so children do not find it. `index.html` sets `viewport-fit=cover`, `user-scalable=no`, and a full-screen dark background.

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(shell): launcher grid, settings, hidden sound lab"
```

---

### Task 16: Manual verification and README

**Files:**
- Create: `README.md`
- Modify: whatever the play-through exposes.

- [ ] **Step 1: Run the whole suite and the typechecker**

Run: `npm test && npm run typecheck`
Expected: all green. Record the counts.

- [ ] **Step 2: Build and serve**

Run: `npm run build` then `npm run dev`, and load the app.
Expected: launcher renders; the seesaw game opens; a placed animal tilts the plank; the gauge tracks it; equality dings.

- [ ] **Step 3: Write the README**

Cover: what this is, how to run it, the workspace layout, how to add a level (edit `levels.data.ts` only), how to swap the theme, how to swap the sound pack, and what is deliberately not built yet.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "docs: readme covering layout, level authoring, and swap seams"
```

---

## Self-Review

**Spec coverage:** §4 structure → Task 1. §5 boundary → Tasks 4, 13, 15. §6 state → Task 5. §7 objectives and levels → Tasks 6, 8. §8 interaction → Task 13. §9 presentation → Tasks 9, 10, 12. §9.1 art seam → Task 10. §10 sound → Tasks 3, 11. §10.2 sound lab → Task 15. §11 error handling → Tasks 2, 3, 8 (validation), 13. §12 testing → every task, plus Task 14. §13 forward compatibility → held by the `Objective` union (Task 6) and `LevelDef.mode` (Task 8).

**Placeholder scan:** Level 4's definition is objective `{ kind: 'tilt', target: -1 }` with tray `dog,cat,rabbit,rabbit,cat` over initial L `bear` / R `cat`. No other TBDs remain.

**Type consistency:** `SeesawSnapshot`, `PlacedAnimal`, `LevelDef`, `Objective`, `GameEvent`, `SeesawTheme`, `AnimalPose`, and `SoundPack` are each defined once and referenced with the same names and fields throughout.
