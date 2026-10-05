# Pond Pairs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Pond Pairs, the bundle's fifth game: a memory game on square boards from 2×2 to 9×9 whose lily pads hide sums, where two pads match when they are equal.

**Architecture:** Pure logic deals a board from a seeded RNG under the card rules, and runs one board's turns (flip, match, miss, hide). A driver strings boards together, holds a missed pair face-up for a beat, scores stars and runs the board picker. A canvas layer draws the pond, pads, flips and overlays from state and never writes back.

**Tech Stack:** TypeScript (strict, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`), Vite, Vitest, canvas 2D, Web Audio via `@bundle/core`. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-04-pond-pairs-design.md` — read it before Task 1.

## Global Constraints

- **Eight square boards**, sizes 2 to 9, ids `board-2` … `board-9`; sums within 10 on sizes 2–3, within 20 from 4 up.
- **Odd boards have one ★ pad at index `(n² − 1) / 2`**, face up from the start, matching nothing.
- **Every card is `a + b` or `a − b`**, every number ≥ 1, every value from 2 to the board's limit, the bigger number of a subtraction ≤ the limit.
- **Any two cards with the same value match. No two cards on a board are written the same. Every value appears an even number of times.**
- **A pair is one addition and one subtraction wherever the value still has both left.**
- **Near-miss values (v and v + 1) on every board of 4×4 or more.**
- **A miss holds both pads up for `TIMING.missHold` = 1.3 s**, then flips them back; a tap during the hold flips them back at once and the tap counts.
- **No numbers are shown on a miss.** Face-down pads draw no sum.
- **Stars:** misses ≤ pairs → 3; ≤ 2 × pairs → 2; else 1. The stored best never goes down.
- `src/logic/` is pure: randomness only through core's `createRng`.
- **The minus sign is `−` (U+2212).**
- Run `npm test` and `npm run typecheck` before every commit. Both must be clean.

## Review Focus

1. **Double-tapping the same pad.** The second tap does nothing; it is not counted as a pair with itself. Pinned in Task 4.
2. **Tapping a matched pad or the ★ during the miss hold.** The missed pair flips back early and nothing else happens. Pinned in Task 4.
3. **A screen that is not 3:2.** A tap still lands on the pad under the finger. Pinned in Task 8.
4. **Opening the picker mid-board, then closing it.** The board in play is untouched — same pads, same misses. Pinned in Task 6.
5. **Damaged or old saved stars.** The game opens on the first board. Pinned in Task 4 (`readBook`) and Task 9.

---

### Task 1: The package, registered and mounting

**Files:**
- Create: `games/pond/package.json`, `games/pond/tsconfig.json`, `games/pond/src/vite-env.d.ts`, `games/pond/src/test-host.ts`, `games/pond/src/index.ts`, `games/pond/src/index.test.ts`
- Modify: `tsconfig.json`, `vitest.config.ts`, `apps/shell/vite.config.ts`, `apps/shell/src/catalog.ts`, `apps/shell/src/shell.test.ts`

**Interfaces:**
- Produces: `pondGame` (id `'pond'`, title `'Pond Pairs'`) from `@bundle/pond`; `createTestHost()` from `games/pond/src/test-host.ts`. Task 9 replaces `index.ts`'s body.

- [ ] **Step 1: Write the failing tests**

```ts
// games/pond/src/index.test.ts
// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { installCanvasStub } from '@bundle/core';
import { pondGame } from './index.js';
import { createTestHost } from './test-host.js';

let restoreCanvas: () => void;
beforeAll(() => {
  restoreCanvas = installCanvasStub();
});
afterAll(() => restoreCanvas());

describe('pondGame', () => {
  it('names itself for the catalog', () => {
    expect(pondGame.id).toBe('pond');
    expect(pondGame.title).toBe('Pond Pairs');
  });

  it('mounts a canvas and takes it away again', async () => {
    const container = document.createElement('div');
    const session = await pondGame.mount(container, createTestHost());
    expect(container.querySelector('canvas')).not.toBeNull();
    session.unmount();
    expect(container.querySelector('canvas')).toBeNull();
  });
});
```

In `apps/shell/src/shell.test.ts`: `expect(playable.map((tile) => tile.id)).toEqual(['seesaw', 'sky', 'bramble', 'balloon', 'pond']);`

- [ ] **Step 2: Run to see them fail**

Run: `npx vitest run games/pond apps/shell`
Expected: FAIL — `./index.js` cannot be resolved; the shell lists four games.

- [ ] **Step 3: Create the package**

```json
// games/pond/package.json
{
  "name": "@bundle/pond",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "src/index.ts"
}
```

```json
// games/pond/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src"]
}
```

```ts
// games/pond/src/vite-env.d.ts
/// <reference types="vite/client" />
```

```ts
// games/pond/src/test-host.ts
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
    storage: store.namespace('pond'),
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
// games/pond/src/index.ts
import type { GameModule, GameSession } from '@bundle/core';

export interface PondOptions {
  /** A board id, so `?game=pond&level=board-5` opens straight onto the 5×5 board. */
  startLevel?: string;
}

export const pondGame: GameModule<PondOptions> = {
  id: 'pond',
  title: 'Pond Pairs',
  async mount(container): Promise<GameSession> {
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;';
    container.appendChild(canvas);
    return { pause: () => {}, resume: () => {}, unmount: () => canvas.remove() };
  },
};

export default pondGame;
```

- [ ] **Step 4: Register it**

`tsconfig.json` paths, after `@bundle/balloon`: `"@bundle/pond": ["games/pond/src/index.ts"]`.
`vitest.config.ts` alias, after `@bundle/balloon`: `'@bundle/pond': resolvePath('./games/pond/src/index.ts'),`.
`apps/shell/vite.config.ts` alias, after `@bundle/balloon`: `'@bundle/pond': resolvePath('../../games/pond/src/index.ts'),`.
`apps/shell/src/catalog.ts`: `import { pondGame } from '@bundle/pond';`, and replace the Counting Meadow row with:

```ts
  { id: 'pond', title: 'Pond Pairs', blurb: 'Find the equal sums', colors: ['#7fc4c9', '#5aa9d6'], module: pondGame },
```

- [ ] **Step 5: Run to see them pass**

Run: `npx vitest run games/pond apps/shell && npm run typecheck`
Expected: PASS, clean typecheck.

- [ ] **Step 6: Commit**

```bash
git add games/pond tsconfig.json vitest.config.ts apps/shell/vite.config.ts apps/shell/src/catalog.ts apps/shell/src/shell.test.ts
git commit -m "feat(pond): the Pond Pairs package, registered and mounting"
```

---

### Task 2: The boards and the sums

**Files:**
- Create: `games/pond/src/logic/boards.data.ts`, `boards.test.ts`, `sums.ts`, `sums.test.ts`

**Interfaces:**
- Produces from `boards.data.ts`: `interface BoardDef { id: string; size: number; limit: number; title: string }`; `BOARDS`; `padsOf(board)`; `pairsOf(board)`; `starIndexOf(board): number | null`; `boardById(id)`.
- Produces from `sums.ts`: `type Op = '+' | '−'`; `interface Sum { a: number; op: Op; b: number; value: number }`; `sumText(sum)`; `valueOf(sum)`; `additionsFor(value, limit)`; `subtractionsFor(value, limit)`.

- [ ] **Step 1: Write the failing tests**

```ts
// games/pond/src/logic/boards.test.ts
import { describe, it, expect } from 'vitest';
import { BOARDS, boardById, padsOf, pairsOf, starIndexOf } from './boards.data.js';

describe('the boards', () => {
  it('are the eight squares from 2×2 to 9×9', () => {
    expect(BOARDS.map((board) => board.size)).toEqual([2, 3, 4, 5, 6, 7, 8, 9]);
    expect(BOARDS.map((board) => board.id)).toEqual(['board-2', 'board-3', 'board-4', 'board-5', 'board-6', 'board-7', 'board-8', 'board-9']);
    expect(BOARDS[3]!.title).toBe('5 × 5');
  });

  it('keep sums within 10 on the two smallest, and within 20 after', () => {
    expect(BOARDS.map((board) => board.limit)).toEqual([10, 10, 20, 20, 20, 20, 20, 20]);
  });

  it('have the pads and pairs the spec lists', () => {
    expect(BOARDS.map(padsOf)).toEqual([4, 9, 16, 25, 36, 49, 64, 81]);
    expect(BOARDS.map(pairsOf)).toEqual([2, 4, 8, 12, 18, 24, 32, 40]);
  });

  it('put the free ★ in the very middle of an odd board, and none on an even one', () => {
    expect(starIndexOf(boardById('board-3')!)).toBe(4);
    expect(starIndexOf(boardById('board-9')!)).toBe(40);
    expect(starIndexOf(boardById('board-4')!)).toBeNull();
  });

  it('knows a board by its id, and nothing else', () => {
    expect(boardById('board-5')?.size).toBe(5);
    expect(boardById('board-10')).toBeUndefined();
  });
});
```

```ts
// games/pond/src/logic/sums.test.ts
import { describe, it, expect } from 'vitest';
import { additionsFor, subtractionsFor, sumText, valueOf } from './sums.js';

describe('sums', () => {
  it('writes a sum with a real minus sign', () => {
    expect(sumText({ a: 9, op: '−', b: 2, value: 7 })).toBe('9 − 2');
    expect(sumText({ a: 3, op: '+', b: 4, value: 7 })).toBe('3 + 4');
  });

  it('lists every addition for a value, every number at least 1', () => {
    expect(additionsFor(4, 10).map(sumText)).toEqual(['1 + 3', '2 + 2', '3 + 1']);
    expect(additionsFor(11, 10)).toEqual([]);
  });

  it('lists every subtraction for a value, the bigger number within the limit', () => {
    expect(subtractionsFor(7, 10).map(sumText)).toEqual(['8 − 1', '9 − 2', '10 − 3']);
    expect(subtractionsFor(10, 10)).toEqual([]);
  });

  it('works every sum out to its value', () => {
    for (const sum of [...additionsFor(9, 20), ...subtractionsFor(9, 20)]) expect(valueOf(sum)).toBe(9);
  });
});
```

- [ ] **Step 2: Run to see them fail**

Run: `npx vitest run games/pond/src/logic`
Expected: FAIL — the modules do not exist.

- [ ] **Step 3: Implement**

```ts
// games/pond/src/logic/boards.data.ts
/** One board on the ladder. */
export interface BoardDef {
  id: string;
  size: number;
  /** The biggest number any sum on the board reaches. */
  limit: number;
  title: string;
}

const board = (size: number): BoardDef => ({
  id: `board-${size}`,
  size,
  limit: size <= 3 ? 10 : 20,
  title: `${size} × ${size}`,
});

/** Eight square boards, 2×2 to 9×9. Board size is the whole of the difficulty. */
export const BOARDS: readonly BoardDef[] = [2, 3, 4, 5, 6, 7, 8, 9].map(board);

export const padsOf = (def: BoardDef): number => def.size * def.size;
export const pairsOf = (def: BoardDef): number => Math.floor(padsOf(def) / 2);
/** An odd board has a free ★ pad in the very middle, so every other pad has a partner. */
export const starIndexOf = (def: BoardDef): number | null => (padsOf(def) % 2 === 1 ? (padsOf(def) - 1) / 2 : null);
export const boardById = (id: string): BoardDef | undefined => BOARDS.find((def) => def.id === id);
```

```ts
// games/pond/src/logic/sums.ts
export type Op = '+' | '−';

/** One card's sum. `value` is what it works out to. */
export interface Sum {
  a: number;
  op: Op;
  b: number;
  value: number;
}

export const sumText = (sum: Sum): string => `${sum.a} ${sum.op} ${sum.b}`;
export const valueOf = (sum: Sum): number => (sum.op === '+' ? sum.a + sum.b : sum.a - sum.b);

/** Every `a + b` that makes `value`, both numbers at least 1. */
export function additionsFor(value: number, limit: number): Sum[] {
  if (value > limit) return [];
  const sums: Sum[] = [];
  for (let a = 1; a < value; a += 1) sums.push({ a, op: '+', b: value - a, value });
  return sums;
}

/** Every `a − b` that makes `value`, with `b` at least 1 and `a` within the limit. */
export function subtractionsFor(value: number, limit: number): Sum[] {
  const sums: Sum[] = [];
  for (let a = value + 1; a <= limit; a += 1) sums.push({ a, op: '−', b: a - value, value });
  return sums;
}
```

- [ ] **Step 4: Run to see them pass**

Run: `npx vitest run games/pond/src/logic && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add games/pond/src/logic
git commit -m "feat(pond): eight boards, and every sum for a value"
```

---

### Task 3: Dealing a board

**Files:**
- Create: `games/pond/src/logic/deal.ts`, `games/pond/src/logic/deal.test.ts`

**Interfaces:**
- Consumes: Task 2; `createRng`, `Rng` from `@bundle/core`.
- Produces: `interface Card { sum: Sum | null }` (`null` is the ★); `dealBoard(board, rng): Card[]` (row-major, length n²); `hasNearMiss(values): boolean`.

- [ ] **Step 1: Write the failing test**

```ts
// games/pond/src/logic/deal.test.ts
import { describe, it, expect } from 'vitest';
import { createRng } from '@bundle/core';
import { BOARDS, padsOf, pairsOf, starIndexOf } from './boards.data.js';
import { dealBoard, hasNearMiss, type Card } from './deal.js';
import { additionsFor, subtractionsFor, sumText, valueOf } from './sums.js';

const SEEDS = Array.from({ length: 25 }, (_, index) => index + 1);
const sumsOf = (cards: Card[]) => cards.flatMap((card) => (card.sum ? [card.sum] : []));

describe('dealing a board', () => {
  it('lays out every pad, with the ★ in the middle of an odd board', () => {
    for (const board of BOARDS) {
      const cards = dealBoard(board, createRng(1));
      expect(cards, board.id).toHaveLength(padsOf(board));
      expect(sumsOf(cards), board.id).toHaveLength(pairsOf(board) * 2);
      const star = starIndexOf(board);
      if (star !== null) expect(cards[star]!.sum, board.id).toBeNull();
    }
  });

  it('writes only sums within the board\'s limit, every number at least 1, every value at least 2', () => {
    for (const board of BOARDS) {
      for (const seed of SEEDS) {
        for (const sum of sumsOf(dealBoard(board, createRng(seed)))) {
          expect(sum.a, board.id).toBeGreaterThanOrEqual(1);
          expect(sum.b, board.id).toBeGreaterThanOrEqual(1);
          expect(valueOf(sum), board.id).toBe(sum.value);
          expect(sum.value, board.id).toBeGreaterThanOrEqual(2);
          expect(sum.value, board.id).toBeLessThanOrEqual(board.limit);
          expect(Math.max(sum.a, sum.b, sum.value), board.id).toBeLessThanOrEqual(board.limit);
        }
      }
    }
  });

  it('never writes two cards the same', () => {
    for (const board of BOARDS) {
      for (const seed of SEEDS) {
        const texts = sumsOf(dealBoard(board, createRng(seed))).map(sumText);
        expect(new Set(texts).size, `${board.id} seed ${seed}`).toBe(texts.length);
      }
    }
  });

  it('puts every value down an even number of times, so the pond can always be cleared', () => {
    for (const board of BOARDS) {
      for (const seed of SEEDS) {
        const counts = new Map<number, number>();
        for (const sum of sumsOf(dealBoard(board, createRng(seed)))) counts.set(sum.value, (counts.get(sum.value) ?? 0) + 1);
        for (const [value, count] of counts) expect(count % 2, `${board.id} seed ${seed} value ${value}`).toBe(0);
      }
    }
  });

  it('pairs an addition with a subtraction wherever the value has both to give', () => {
    for (const board of BOARDS) {
      for (const seed of SEEDS) {
        const sums = sumsOf(dealBoard(board, createRng(seed)));
        const values = new Set(sums.map((sum) => sum.value));
        for (const value of values) {
          const ofValue = sums.filter((sum) => sum.value === value);
          const pairs = ofValue.length / 2;
          if (additionsFor(value, board.limit).length < pairs || subtractionsFor(value, board.limit).length < pairs) continue;
          const adds = ofValue.filter((sum) => sum.op === '+').length;
          expect(adds, `${board.id} seed ${seed} value ${value}`).toBe(pairs);
        }
      }
    }
  });

  it('puts near misses on every board of 4×4 or more', () => {
    for (const board of BOARDS.filter((each) => each.size >= 4)) {
      for (const seed of SEEDS) {
        const values = [...new Set(sumsOf(dealBoard(board, createRng(seed))).map((sum) => sum.value))];
        expect(hasNearMiss(values), `${board.id} seed ${seed}`).toBe(true);
      }
    }
  });

  it('deals the same board from the same seed, and a different one from another', () => {
    const board = BOARDS[2]!;
    const texts = (seed: number) => dealBoard(board, createRng(seed)).map((card) => (card.sum ? sumText(card.sum) : '★'));
    expect(texts(7)).toEqual(texts(7));
    expect(texts(7)).not.toEqual(texts(8));
  });
});
```

- [ ] **Step 2: Run to see it fail**

Run: `npx vitest run games/pond/src/logic/deal.test.ts`
Expected: FAIL — `./deal.js` does not exist.

- [ ] **Step 3: Implement**

```ts
// games/pond/src/logic/deal.ts
import type { Rng } from '@bundle/core';
import { pairsOf, starIndexOf, type BoardDef } from './boards.data.js';
import { additionsFor, subtractionsFor, sumText, type Sum } from './sums.js';

/** One pad's card. `null` is the free ★, which matches nothing. */
export interface Card {
  sum: Sum | null;
}

function shuffle<T>(rng: Rng, items: T[]): T[] {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const other = rng.int(index + 1);
    [items[index], items[other]] = [items[other]!, items[index]!];
  }
  return items;
}

export const hasNearMiss = (values: readonly number[]): boolean => values.some((value) => values.includes(value + 1));

/**
 * The values a board asks about: spread as evenly over 2..limit as the board
 * allows, so a big board does not pile up on a few answers. From 4×4 up, at
 * least two of them sit next to each other, so a quick guess at a similar sum
 * can fail.
 */
function valuesFor(board: BoardDef, rng: Rng): number[] {
  const pool: number[] = [];
  for (let value = 2; value <= board.limit; value += 1) pool.push(value);
  const spread: number[] = [];
  while (spread.length < pairsOf(board)) spread.push(...shuffle(rng, [...pool]));
  const values = spread.slice(0, pairsOf(board));
  if (board.size >= 4 && !hasNearMiss(values)) {
    const first = values[0]!;
    values[values.length - 1] = first < board.limit ? first + 1 : first - 1;
  }
  return values;
}

/**
 * Two different sums for one value, neither already on the board: an addition
 * and a subtraction where both are left, so spotting two additions with the
 * same first number is never the way to a match.
 */
function pairFor(value: number, limit: number, used: Set<string>, rng: Rng): [Sum, Sum] {
  const fresh = (sums: Sum[]) => sums.filter((sum) => !used.has(sumText(sum)));
  const adds = fresh(additionsFor(value, limit));
  const subs = fresh(subtractionsFor(value, limit));
  const pair = adds.length > 0 && subs.length > 0 ? [rng.pick(adds), rng.pick(subs)] : shuffle(rng, [...adds, ...subs]).slice(0, 2);
  const [first, second] = pair;
  if (!first || !second) throw new Error(`no two fresh sums left for ${value}`);
  used.add(sumText(first));
  used.add(sumText(second));
  return [first, second];
}

/** A fresh board: every pair placed at random, the ★ (if any) in the middle. */
export function dealBoard(board: BoardDef, rng: Rng): Card[] {
  const used = new Set<string>();
  const cards: Card[] = valuesFor(board, rng).flatMap((value) => pairFor(value, board.limit, used, rng).map((sum) => ({ sum })));
  const dealt = shuffle(rng, cards);
  const star = starIndexOf(board);
  if (star !== null) dealt.splice(star, 0, { sum: null });
  return dealt;
}
```

- [ ] **Step 4: Run to see it pass**

Run: `npx vitest run games/pond/src/logic && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add games/pond/src/logic
git commit -m "feat(pond): deal a fresh board under the card rules"
```

---

### Task 4: A board in play, stars and progress

**Files:**
- Create: `games/pond/src/logic/game.ts`, `game.test.ts`, `stars.ts`, `stars.test.ts`, `progress.ts`, `progress.test.ts`

**Interfaces:**
- Consumes: Tasks 2–3.
- Produces from `game.ts`: `interface Pad { card: Card; up: boolean; matched: boolean }`; `interface GameState { readonly board: BoardDef; pads: Pad[]; first: number | null; pending: [number, number] | null; misses: number; matches: number; cleared: boolean }`; `type GameEvent` (flipped / matched / missed / hidden / cleared); `interface Game { readonly state: GameState; flip(index): GameEvent[]; hide(): GameEvent[] }`; `createGame(board, cards): Game`; `valueAt(state, index): number | null`.
- Produces from `stars.ts`: `type StarBook = Record<string, number>`; `starsFor(misses, pairs): 1 | 2 | 3`; `recordStars(book, id, stars)`.
- Produces from `progress.ts`: `readBook(raw)`; `isOpen(book, index)`; `resumeIndex(book)`; `startIndex(book, startLevel?)`; `totalStars(book)`; `MAX_STARS`.

- [ ] **Step 1: Write the failing tests**

```ts
// games/pond/src/logic/game.test.ts
import { describe, it, expect } from 'vitest';
import { boardById } from './boards.data.js';
import type { Card } from './deal.js';
import { createGame } from './game.js';

const sum = (a: number, op: '+' | '−', b: number): Card => ({ sum: { a, op, b, value: op === '+' ? a + b : a - b } });
// A 2×2 board: 3 + 4 and 9 − 2 are 7; 2 + 3 and 6 − 1 are 5.
const twoByTwo = (): Card[] => [sum(3, '+', 4), sum(2, '+', 3), sum(6, '−', 1), sum(9, '−', 2)];
const board2 = boardById('board-2')!;

describe('a board in play', () => {
  it('flips a pad up', () => {
    const game = createGame(board2, twoByTwo());
    expect(game.flip(0)).toEqual([{ type: 'flipped', index: 0 }]);
    expect(game.state.pads[0]!.up).toBe(true);
    expect(game.state.first).toBe(0);
  });

  it('keeps two equal pads up, and counts no miss', () => {
    const game = createGame(board2, twoByTwo());
    game.flip(0);
    expect(game.flip(3)).toEqual([
      { type: 'flipped', index: 3 },
      { type: 'matched', a: 0, b: 3, value: 7 },
    ]);
    expect(game.state.pads[0]!.matched && game.state.pads[3]!.matched).toBe(true);
    expect(game.state.misses).toBe(0);
  });

  it('counts a miss for two unequal pads, holds them up, and puts them back when told', () => {
    const game = createGame(board2, twoByTwo());
    game.flip(0);
    expect(game.flip(1)).toEqual([
      { type: 'flipped', index: 1 },
      { type: 'missed', a: 0, b: 1 },
    ]);
    expect(game.state.misses).toBe(1);
    expect(game.state.pending).toEqual([0, 1]);
    expect(game.hide()).toEqual([{ type: 'hidden', a: 0, b: 1 }]);
    expect(game.state.pads[0]!.up || game.state.pads[1]!.up).toBe(false);
    expect(game.hide()).toEqual([]);
  });

  it('puts a missed pair back at once when another pad is tapped, and counts the tap', () => {
    const game = createGame(board2, twoByTwo());
    game.flip(0);
    game.flip(1);
    expect(game.flip(2)).toEqual([
      { type: 'hidden', a: 0, b: 1 },
      { type: 'flipped', index: 2 },
    ]);
    expect(game.state.first).toBe(2);
  });

  it('ignores a second tap on the same pad', () => {
    const game = createGame(board2, twoByTwo());
    game.flip(0);
    expect(game.flip(0)).toEqual([]);
    expect(game.state.first).toBe(0);
    expect(game.state.misses).toBe(0);
  });

  it('ignores a tap on a matched pad, and a second tap on the same pad', () => {
    const game = createGame(board2, twoByTwo());
    game.flip(0);
    game.flip(3); // 7 and 7: matched
    game.flip(1);
    expect(game.flip(0)).toEqual([]);
    expect(game.state.first).toBe(1);
    expect(game.flip(1)).toEqual([]);
    expect(game.state.misses).toBe(0);
  });

  it('ends the board when every pad but the ★ is up, and then takes no more taps', () => {
    const game = createGame(board2, twoByTwo());
    game.flip(0);
    game.flip(3);
    game.flip(1);
    expect(game.flip(2)).toEqual([
      { type: 'flipped', index: 2 },
      { type: 'matched', a: 1, b: 2, value: 5 },
      { type: 'cleared', misses: 0 },
    ]);
    expect(game.flip(0)).toEqual([]);
  });

  it('starts the ★ face up and lets nobody tap it', () => {
    const board3 = boardById('board-3')!;
    const cards: Card[] = [
      sum(1, '+', 1), sum(3, '−', 1), sum(1, '+', 2), sum(4, '−', 1),
      { sum: null },
      sum(1, '+', 3), sum(5, '−', 1), sum(1, '+', 4), sum(6, '−', 1),
    ];
    const game = createGame(board3, cards);
    expect(game.state.pads[4]!.up).toBe(true);
    expect(game.flip(4)).toEqual([]);
  });
});
```

```ts
// games/pond/src/logic/stars.test.ts
import { describe, it, expect } from 'vitest';
import { recordStars, starsFor } from './stars.js';

describe('stars', () => {
  it('come from misses against pairs', () => {
    expect(starsFor(0, 8)).toBe(3);
    expect(starsFor(8, 8)).toBe(3);
    expect(starsFor(9, 8)).toBe(2);
    expect(starsFor(16, 8)).toBe(2);
    expect(starsFor(17, 8)).toBe(1);
  });

  it('keep the best, and never take stars away', () => {
    const book = recordStars({}, 'a', 2);
    expect(recordStars(book, 'a', 1)).toEqual({ a: 2 });
    expect(recordStars(book, 'a', 3)).toEqual({ a: 3 });
  });
});
```

```ts
// games/pond/src/logic/progress.test.ts
import { describe, it, expect } from 'vitest';
import { isOpen, MAX_STARS, readBook, resumeIndex, startIndex, totalStars } from './progress.js';

describe('progress', () => {
  it('opens only the first board for a new player', () => {
    expect(isOpen({}, 0)).toBe(true);
    expect(isOpen({}, 1)).toBe(false);
    expect(resumeIndex({})).toBe(0);
  });

  it('opens the next board once the last is finished, and resumes there', () => {
    const book = { 'board-2': 2 };
    expect(isOpen(book, 1)).toBe(true);
    expect(isOpen(book, 2)).toBe(false);
    expect(resumeIndex(book)).toBe(1);
  });

  it('stays on the summit once every board has stars', () => {
    const all = Object.fromEntries([2, 3, 4, 5, 6, 7, 8, 9].map((size) => [`board-${size}`, 3]));
    expect(resumeIndex(all)).toBe(7);
    expect(totalStars(all)).toBe(MAX_STARS);
  });

  it('opens a board named in the URL, and ignores one it does not know', () => {
    expect(startIndex({}, 'board-5')).toBe(3);
    expect(startIndex({ 'board-2': 1 }, 'board-12')).toBe(1);
  });

  it('survives saved stars that are damaged or out of date', () => {
    expect(readBook(null)).toEqual({});
    expect(readBook('3')).toEqual({});
    expect(readBook([1])).toEqual({});
    expect(readBook({ 'board-2': 'three', 'board-3': 2, 'board-4': 9 })).toEqual({ 'board-3': 2 });
  });
});
```

- [ ] **Step 2: Run to see them fail**

Run: `npx vitest run games/pond/src/logic`
Expected: FAIL — the modules do not exist.

- [ ] **Step 3: Implement**

```ts
// games/pond/src/logic/game.ts
import { pairsOf, type BoardDef } from './boards.data.js';
import type { Card } from './deal.js';

export interface Pad {
  card: Card;
  up: boolean;
  matched: boolean;
}

export interface GameState {
  readonly board: BoardDef;
  pads: Pad[];
  /** The pad turned over first in this turn, waiting for its partner. */
  first: number | null;
  /** A missed pair, still up until it is put back. */
  pending: [number, number] | null;
  misses: number;
  matches: number;
  cleared: boolean;
}

export type GameEvent =
  | { type: 'flipped'; index: number }
  | { type: 'matched'; a: number; b: number; value: number }
  | { type: 'missed'; a: number; b: number }
  | { type: 'hidden'; a: number; b: number }
  | { type: 'cleared'; misses: number };

export interface Game {
  readonly state: GameState;
  flip(index: number): GameEvent[];
  /** Puts a missed pair back face down. */
  hide(): GameEvent[];
}

export const valueAt = (state: GameState, index: number): number | null => state.pads[index]?.card.sum?.value ?? null;

export function createGame(board: BoardDef, cards: Card[]): Game {
  const state: GameState = {
    board,
    pads: cards.map((card) => ({ card, up: card.sum === null, matched: false })),
    first: null,
    pending: null,
    misses: 0,
    matches: 0,
    cleared: false,
  };

  const hide = (): GameEvent[] => {
    if (!state.pending) return [];
    const [a, b] = state.pending;
    state.pads[a]!.up = false;
    state.pads[b]!.up = false;
    state.pending = null;
    return [{ type: 'hidden', a, b }];
  };

  return {
    state,
    hide,

    flip(index) {
      const pad = state.pads[index];
      if (state.cleared || !pad || pad.card.sum === null) return [];
      // A tap during the hold puts the missed pair back first, so a quick
      // child is never made to wait.
      const events = hide();
      if (pad.up) return events;

      pad.up = true;
      events.push({ type: 'flipped', index });
      if (state.first === null) {
        state.first = index;
        return events;
      }

      const first = state.first;
      state.first = null;
      const value = valueAt(state, first);
      if (value !== null && value === valueAt(state, index)) {
        state.pads[first]!.matched = true;
        pad.matched = true;
        state.matches += 1;
        events.push({ type: 'matched', a: first, b: index, value });
        if (state.matches === pairsOf(board)) {
          state.cleared = true;
          events.push({ type: 'cleared', misses: state.misses });
        }
      } else {
        state.misses += 1;
        state.pending = [first, index];
        events.push({ type: 'missed', a: first, b: index });
      }
      return events;
    },
  };
}
```

```ts
// games/pond/src/logic/stars.ts
/** Best stars per board id, as kept in the host's storage. */
export type StarBook = Record<string, number>;

/** At most one miss a pair is three stars, two a pair is two, anything more is one. */
export const starsFor = (misses: number, pairs: number): 1 | 2 | 3 =>
  misses <= pairs ? 3 : misses <= 2 * pairs ? 2 : 1;

export const recordStars = (book: StarBook, id: string, stars: number): StarBook => ({
  ...book,
  [id]: Math.max(book[id] ?? 0, stars),
});
```

```ts
// games/pond/src/logic/progress.ts
import { BOARDS } from './boards.data.js';
import type { StarBook } from './stars.js';

/** Whatever storage hands back, made safe: a damaged save must never stop the game opening. */
export function readBook(raw: unknown): StarBook {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const book: StarBook = {};
  for (const [id, value] of Object.entries(raw)) {
    if (typeof value === 'number' && value >= 1 && value <= 3) book[id] = Math.floor(value);
  }
  return book;
}

/** The first board is always open; every other opens once the one before has stars. */
export const isOpen = (book: StarBook, index: number): boolean =>
  index === 0 || (book[BOARDS[index - 1]?.id ?? ''] ?? 0) >= 1;

/** The first board without stars; the summit once every board has them. */
export function resumeIndex(book: StarBook): number {
  const index = BOARDS.findIndex((board) => (book[board.id] ?? 0) < 1);
  return index < 0 ? BOARDS.length - 1 : index;
}

/** A board id from the URL, else where the player left off. */
export function startIndex(book: StarBook, startLevel?: string): number {
  const named = startLevel ? BOARDS.findIndex((board) => board.id === startLevel) : -1;
  return named >= 0 ? named : resumeIndex(book);
}

export const totalStars = (book: StarBook): number => BOARDS.reduce((sum, board) => sum + (book[board.id] ?? 0), 0);
export const MAX_STARS = BOARDS.length * 3;
```

- [ ] **Step 4: Run to see them pass**

Run: `npx vitest run games/pond/src/logic && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add games/pond/src/logic
git commit -m "feat(pond): a board in play — flips, matches, misses — and stars"
```

---

### Task 5: The tests that guard the design

**Files:**
- Create: `games/pond/src/logic/guards.test.ts`

- [ ] **Step 1: Write the test**

```ts
// games/pond/src/logic/guards.test.ts
import { describe, it, expect } from 'vitest';
import { createRng, type Rng } from '@bundle/core';
import { BOARDS, pairsOf } from './boards.data.js';
import { dealBoard } from './deal.js';
import { createGame, valueAt, type Game } from './game.js';
import { starsFor } from './stars.js';

const faceDown = (game: Game): number[] =>
  game.state.pads.flatMap((pad, index) => (!pad.up && pad.card.sum ? [index] : []));

/** Remembers every pad it has seen and works every sum out. */
function perfect(game: Game, rng: Rng): number {
  const seen = new Map<number, number>();
  const unseen = () => faceDown(game).filter((index) => !seen.has(index));
  while (!game.state.cleared) {
    const known = [...seen].filter(([index]) => !game.state.pads[index]!.matched);
    const pair = known.find(([index, value]) => known.some(([other, v]) => other !== index && v === value));
    if (pair) {
      const partner = known.find(([other, v]) => other !== pair[0] && v === pair[1])!;
      game.flip(pair[0]);
      game.flip(partner[0]);
      continue;
    }
    const pool = unseen();
    const first = pool[rng.int(pool.length)]!;
    game.flip(first);
    const value = valueAt(game.state, first)!;
    seen.set(first, value);
    const partner = known.find(([, v]) => v === value);
    if (partner) {
      game.flip(partner[0]);
      continue;
    }
    const rest = unseen();
    const second = rest[rng.int(rest.length)]!;
    game.flip(second);
    seen.set(second, valueAt(game.state, second)!);
    game.hide();
  }
  return game.state.misses;
}

/** Turns over two pads at random, every time, remembering nothing. */
function random(game: Game, rng: Rng): number {
  while (!game.state.cleared) {
    const pool = faceDown(game);
    const first = pool[rng.int(pool.length)]!;
    const rest = pool.filter((index) => index !== first);
    const second = rest[rng.int(rest.length)]!;
    game.flip(first);
    game.flip(second);
    game.hide();
  }
  return game.state.misses;
}

const averageStars = (bot: (game: Game, rng: Rng) => number, size: number, games: number): number => {
  const board = BOARDS.find((each) => each.size === size)!;
  let total = 0;
  for (let seed = 1; seed <= games; seed += 1) {
    const rng = createRng(seed);
    const game = createGame(board, dealBoard(board, rng));
    total += starsFor(bot(game, rng), pairsOf(board));
  }
  return total / games;
};

describe('memory and arithmetic are load-bearing', () => {
  it('a bot with perfect memory that works every sum out averages at least 2.5 stars on every board', () => {
    for (const board of BOARDS) expect(averageStars(perfect, board.size, 30), board.id).toBeGreaterThanOrEqual(2.5);
  });

  it('a bot that flips at random averages at most 1.5 stars on every board from 4×4 up', () => {
    for (const board of BOARDS.filter((each) => each.size >= 4)) {
      expect(averageStars(random, board.size, 10), board.id).toBeLessThanOrEqual(1.5);
    }
  });
});
```

- [ ] **Step 2: Run it**

Run: `npx vitest run games/pond/src/logic/guards.test.ts`
Expected: PASS (simulated before this plan was written: perfect memory averages 3 stars on every board, random play about 1.1 at 4×4 and 1.0 above). If it fails, fix the star thresholds or the dealing, never the test.

- [ ] **Step 3: Commit**

```bash
git add games/pond/src/logic/guards.test.ts
git commit -m "test(pond): proof that memory and sums win, and random flipping does not"
```

---

### Task 6: The driver

**Files:**
- Create: `games/pond/src/intent.ts`, `games/pond/src/view/timing.ts`, `games/pond/src/driver.ts`, `games/pond/src/driver.test.ts`

**Interfaces:**
- Consumes: Tasks 2–4; `createRng` from `@bundle/core`.
- Produces from `intent.ts`: `Intent` = `{ kind: 'flip'; index }` | `{ kind: 'picker' }` | `{ kind: 'pick'; index }` | `{ kind: 'close' }` | `{ kind: 'next' }`.
- Produces from `timing.ts`: `TIMING`.
- Produces from `driver.ts`: `type Phase = 'playing' | 'cleared' | 'picking'`; `type DriverEvent = GameEvent | { type: 'board'; board } | { type: 'scored'; stars; book } | { type: 'picker' }`; `interface SceneModel { board; game; phase; earned; totalStars; maxStars; book; open: boolean[]; index }`; `interface Driver { phase; index; game; book; earned; readyForNext; holding; step(dt); act(intent); model() }`; `createDriver({ book, startLevel?, seed? })`.

- [ ] **Step 1: Write the failing test**

```ts
// games/pond/src/driver.test.ts
import { describe, it, expect } from 'vitest';
import { createDriver, type Driver } from './driver.js';
import { valueAt } from './logic/game.js';
import { TIMING } from './view/timing.js';

const FRAME = 1 / 60;

/** Two face-down pads of the same value, and two of different values. */
const findPair = (driver: Driver, equal: boolean): [number, number] => {
  const pads = driver.game.state.pads;
  for (let a = 0; a < pads.length; a += 1) {
    for (let b = a + 1; b < pads.length; b += 1) {
      if (pads[a]!.up || pads[b]!.up) continue;
      if ((valueAt(driver.game.state, a) === valueAt(driver.game.state, b)) === equal) return [a, b];
    }
  }
  throw new Error('no such pair');
};

const clear = (driver: Driver) => {
  while (!driver.game.state.cleared) {
    const [a, b] = findPair(driver, true);
    driver.act({ kind: 'flip', index: a });
    driver.act({ kind: 'flip', index: b });
  }
};

const wait = (driver: Driver, seconds: number) => {
  const events = [];
  for (let t = 0; t < seconds; t += FRAME) events.push(...driver.step(FRAME));
  return events;
};

describe('the driver', () => {
  it('opens a new player on the first board and announces it', () => {
    const driver = createDriver({ book: {}, seed: 1 });
    expect(driver.model().board.id).toBe('board-2');
    expect(driver.step(FRAME)).toEqual([{ type: 'board', board: expect.objectContaining({ id: 'board-2' }) }]);
  });

  it('holds a missed pair up, then puts it back by itself', () => {
    const driver = createDriver({ book: {}, startLevel: 'board-4', seed: 2 });
    const [a, b] = findPair(driver, false);
    driver.act({ kind: 'flip', index: a });
    driver.act({ kind: 'flip', index: b });
    expect(driver.holding).toBe(true);
    expect(wait(driver, TIMING.missHold * 0.5)).not.toContainEqual(expect.objectContaining({ type: 'hidden' }));
    expect(wait(driver, TIMING.missHold)).toContainEqual({ type: 'hidden', a, b });
    expect(driver.holding).toBe(false);
  });

  it('lets a tap during the hold put the pair back at once', () => {
    const driver = createDriver({ book: {}, startLevel: 'board-4', seed: 3 });
    const [a, b] = findPair(driver, false);
    driver.act({ kind: 'flip', index: a });
    driver.act({ kind: 'flip', index: b });
    const other = driver.game.state.pads.findIndex((pad, index) => !pad.up && index !== a && index !== b);
    expect(driver.act({ kind: 'flip', index: other })).toEqual([
      { type: 'hidden', a, b },
      { type: 'flipped', index: other },
    ]);
    expect(driver.holding).toBe(false);
  });

  it('scores a cleared board, and keeps the next board shut until the stars have been shown', () => {
    const driver = createDriver({ book: {}, seed: 4 });
    clear(driver);
    expect(driver.phase).toBe('cleared');
    expect(driver.earned).toBe(3);
    expect(driver.book).toEqual({ 'board-2': 3 });
    expect(driver.act({ kind: 'next' })).toEqual([]);
    wait(driver, TIMING.starsDelaySeconds + 3 * TIMING.starSeconds + 0.1);
    expect(driver.act({ kind: 'next' })).toEqual([{ type: 'board', board: expect.objectContaining({ id: 'board-3' }) }]);
    expect(driver.phase).toBe('playing');
  });

  it('plays the summit again rather than running off the end', () => {
    const driver = createDriver({ book: {}, startLevel: 'board-9', seed: 5 });
    clear(driver);
    wait(driver, 3);
    driver.act({ kind: 'next' });
    expect(driver.model().board.id).toBe('board-9');
    expect(driver.game.state.cleared).toBe(false);
  });

  it('opens the picker over a board and closes it again without touching the board', () => {
    const driver = createDriver({ book: {}, startLevel: 'board-4', seed: 6 });
    const [a, b] = findPair(driver, false);
    driver.act({ kind: 'flip', index: a });
    driver.act({ kind: 'flip', index: b });
    const game = driver.game;
    expect(driver.act({ kind: 'picker' })).toEqual([{ type: 'picker' }]);
    expect(driver.phase).toBe('picking');
    expect(driver.act({ kind: 'flip', index: 0 })).toEqual([]);
    driver.act({ kind: 'close' });
    expect(driver.phase).toBe('playing');
    expect(driver.game).toBe(game);
    expect(driver.game.state.misses).toBe(1);
  });

  it('picks an open board, and refuses a locked one', () => {
    const driver = createDriver({ book: { 'board-2': 1 }, seed: 7 });
    driver.act({ kind: 'picker' });
    expect(driver.act({ kind: 'pick', index: 5 })).toEqual([]);
    expect(driver.act({ kind: 'pick', index: 0 })).toEqual([{ type: 'board', board: expect.objectContaining({ id: 'board-2' }) }]);
    expect(driver.phase).toBe('playing');
  });

  it('deals the same boards from the same seed', () => {
    const texts = (seed: number) => createDriver({ book: {}, startLevel: 'board-5', seed }).game.state.pads.map((pad) => pad.card.sum?.value);
    expect(texts(9)).toEqual(texts(9));
  });
});
```

- [ ] **Step 2: Run to see it fail**

Run: `npx vitest run games/pond/src/driver.test.ts`
Expected: FAIL — the modules do not exist.

- [ ] **Step 3: Implement**

```ts
// games/pond/src/intent.ts
/** Everything a tap can mean. Input produces these; the driver acts on them. */
export type Intent =
  | { kind: 'flip'; index: number }
  | { kind: 'picker' }
  | { kind: 'pick'; index: number }
  | { kind: 'close' }
  | { kind: 'next' };
```

```ts
// games/pond/src/view/timing.ts
/**
 * How the game feels, in one place. Retuning choreography should never mean
 * hunting through the renderer.
 */
export const TIMING = {
  /** A pad turning over. */
  flipSeconds: 0.24,
  /** How long a missed pair stays up before it turns back. */
  missHold: 1.3,
  /** How long the finished match — `3 + 4 = 7 = 9 − 2` — floats over the pond. */
  matchLineSeconds: 1.8,
  /** A matched pad's flower opening. */
  bloomSeconds: 0.5,
  /** Before the stars arrive on the end card, and between each. */
  starsDelaySeconds: 0.8,
  starSeconds: 0.35,
  /** A board's name, large, before it flies to the top bar. */
  boardAnnounceSeconds: 2.0,
  boardSettleFraction: 0.26,
} as const;
```

```ts
// games/pond/src/driver.ts
import { createRng } from '@bundle/core';
import type { Intent } from './intent.js';
import { BOARDS, pairsOf, type BoardDef } from './logic/boards.data.js';
import { dealBoard } from './logic/deal.js';
import { createGame, type Game, type GameEvent, type GameState } from './logic/game.js';
import { isOpen, MAX_STARS, startIndex, totalStars } from './logic/progress.js';
import { recordStars, starsFor, type StarBook } from './logic/stars.js';
import { TIMING } from './view/timing.js';

export type Phase = 'playing' | 'cleared' | 'picking';

export type DriverEvent =
  | GameEvent
  | { type: 'board'; board: BoardDef }
  | { type: 'scored'; stars: number; book: StarBook }
  | { type: 'picker' };

/** Everything the scene draws from. */
export interface SceneModel {
  board: BoardDef;
  game: GameState;
  phase: Phase;
  earned: number | null;
  totalStars: number;
  maxStars: number;
  book: StarBook;
  /** Which boards the picker may open. */
  open: boolean[];
  index: number;
}

export interface DriverOptions {
  book: StarBook;
  /** A board id from the URL. Anything unrecognised opens where the player left off. */
  startLevel?: string;
  seed?: number;
}

/**
 * Strings boards together. Scene, sound, input and the frame loop all talk to
 * the board through this, so none of them need to know how long a missed pair
 * is held, or which board comes next.
 */
export interface Driver {
  readonly phase: Phase;
  readonly index: number;
  readonly game: Game;
  readonly book: StarBook;
  readonly earned: number | null;
  /** A missed pair is up and waiting to be put back. */
  readonly holding: boolean;
  /** Not until the stars have been shown: a quick tap must not skip them. */
  readonly readyForNext: boolean;
  step(dt: number): DriverEvent[];
  act(intent: Intent): DriverEvent[];
  model(): SceneModel;
}

export function createDriver(options: DriverOptions): Driver {
  const rng = createRng(options.seed ?? Math.floor(Date.now() % 1_000_000));
  const boardAt = (index: number): BoardDef => {
    const board = BOARDS[index];
    if (!board) throw new Error(`no board at ${index}`);
    return board;
  };
  const deal = (index: number): Game => createGame(boardAt(index), dealBoard(boardAt(index), rng));

  let book = options.book;
  let index = startIndex(book, options.startLevel);
  let game = deal(index);
  let phase: Phase = 'playing';
  let resume: 'playing' | 'cleared' = 'playing';
  let hold = 0;
  let since = 0;
  let earned: number | null = null;
  let pending: DriverEvent[] = [{ type: 'board', board: boardAt(index) }];

  const open = (next: number): DriverEvent[] => {
    index = next;
    game = deal(index);
    phase = 'playing';
    hold = 0;
    since = 0;
    earned = null;
    return [{ type: 'board', board: boardAt(index) }];
  };

  /** What the game's own events mean for the driver: a hold to start, a board to score. */
  const after = (events: GameEvent[]): DriverEvent[] => {
    const out: DriverEvent[] = [...events];
    for (const event of events) {
      if (event.type === 'hidden') hold = 0;
      if (event.type === 'missed') hold = TIMING.missHold;
      if (event.type === 'cleared') {
        earned = starsFor(event.misses, pairsOf(boardAt(index)));
        book = recordStars(book, boardAt(index).id, earned);
        phase = 'cleared';
        since = 0;
        out.push({ type: 'scored', stars: earned, book });
      }
    }
    return out;
  };

  const readyForNext = (): boolean =>
    phase === 'cleared' && since >= TIMING.starsDelaySeconds + (earned ?? 0) * TIMING.starSeconds;

  return {
    get phase() {
      return phase;
    },
    get index() {
      return index;
    },
    get game() {
      return game;
    },
    get book() {
      return book;
    },
    get earned() {
      return earned;
    },
    get holding() {
      return hold > 0;
    },
    get readyForNext() {
      return readyForNext();
    },

    act(intent) {
      switch (intent.kind) {
        case 'picker':
          if (phase === 'picking') return [];
          resume = phase;
          phase = 'picking';
          return [{ type: 'picker' }];
        case 'close':
          if (phase !== 'picking') return [];
          phase = resume;
          return [];
        case 'pick':
          if (phase !== 'picking' || !isOpen(book, intent.index) || !BOARDS[intent.index]) return [];
          return open(intent.index);
        case 'flip':
          if (phase !== 'playing') return [];
          return after(game.flip(intent.index));
        case 'next':
          if (!readyForNext()) return [];
          return open(Math.min(index + 1, BOARDS.length - 1));
      }
    },

    step(dt) {
      const events = pending;
      pending = [];
      if (phase === 'cleared') since += dt;
      if (hold > 0 && phase === 'playing') {
        hold -= dt;
        if (hold <= 0) events.push(...after(game.hide()));
      }
      return events;
    },

    model: () => ({
      board: boardAt(index),
      game: game.state,
      phase,
      earned,
      totalStars: totalStars(book),
      maxStars: MAX_STARS,
      book,
      open: BOARDS.map((_, each) => isOpen(book, each)),
      index,
    }),
  };
}
```

- [ ] **Step 4: Run to see it pass**

Run: `npx vitest run games/pond && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add games/pond/src
git commit -m "feat(pond): a driver that holds misses, scores boards and runs the picker"
```

---

### Task 7: The pond on screen

**Files:**
- Create: `games/pond/src/view/geometry.ts`, `geometry.test.ts`, `art.ts`, `art.test.ts`, `hud.ts`, `hud.test.ts`, `scene.ts`, `scene.test.ts`

**Interfaces:**
- Consumes: Task 6 (`SceneModel`, `DriverEvent`, `TIMING`); `sumText` (Task 2).
- Produces from `geometry.ts`: `LAYOUT`; `interface Rect { x; y; w; h }`; `padRect(size, index)`; `padFont(size)`; `padAt(point, size)`; `inBoardsButton(point)`; `pickerRect(index)`; `pickerAt(point)`; `inPickerPanel(point)`.
- Produces from `art.ts`: `drawPond(ctx, bounds, time)`; `drawPad(ctx, rect, look: PadLook)`; `interface PadLook { face: 'down' | 'up' | 'star'; text: string; font: number; turn: number; bloom: number; cursor: boolean }`.
- Produces from `hud.ts`: `drawTopBar(ctx, { title, totalStars })`; `drawMatchLine(ctx, text, progress)`; `drawEndCard(ctx, { stars, progress, misses, pairs, last })`; `drawPicker(ctx, { boards, book, open, current })`.
- Produces from `scene.ts`: `interface Scene { update; observe; render; toDesign; setCursor(index | null) }`; `createScene()`.

- [ ] **Step 1: Write the failing tests**

```ts
// games/pond/src/view/geometry.test.ts
import { describe, it, expect } from 'vitest';
import { BOARDS } from '../logic/boards.data.js';
import { inBoardsButton, inPickerPanel, LAYOUT, padAt, padFont, padRect, pickerAt, pickerRect } from './geometry.js';

describe('geometry', () => {
  it('keeps every pad of every board inside the pond, apart from its neighbours', () => {
    for (const board of BOARDS) {
      const pads = Array.from({ length: board.size * board.size }, (_, index) => padRect(board.size, index));
      for (const pad of pads) {
        expect(pad.x, board.id).toBeGreaterThanOrEqual(LAYOUT.pondLeft);
        expect(pad.y, board.id).toBeGreaterThanOrEqual(LAYOUT.pondTop);
        expect(pad.x + pad.w, board.id).toBeLessThanOrEqual(LAYOUT.pondRight);
        expect(pad.y + pad.h, board.id).toBeLessThanOrEqual(LAYOUT.pondBottom);
      }
      const right = padRect(board.size, 1);
      const below = padRect(board.size, board.size);
      expect(right.x - (pads[0]!.x + pads[0]!.w), board.id).toBeGreaterThan(0);
      expect(below.y - (pads[0]!.y + pads[0]!.h), board.id).toBeGreaterThan(0);
    }
  });

  it('keeps pads big enough to tap and sums big enough to read, even on 9×9', () => {
    const pad = padRect(9, 0);
    expect(pad.w).toBeGreaterThanOrEqual(100);
    expect(pad.h).toBeGreaterThanOrEqual(58);
    expect(padFont(9)).toBeGreaterThanOrEqual(24);
  });

  it('caps the pads on a small board', () => {
    expect(padRect(2, 0).w).toBeLessThanOrEqual(LAYOUT.maxPad.w);
    expect(padRect(2, 0).h).toBeLessThanOrEqual(LAYOUT.maxPad.h);
  });

  it('finds the pad under a finger, and nothing between pads', () => {
    for (const size of [2, 5, 9]) {
      for (const index of [0, size + 1, size * size - 1]) {
        const pad = padRect(size, index);
        expect(padAt({ x: pad.x + pad.w / 2, y: pad.y + pad.h / 2 }, size)).toBe(index);
      }
    }
    const first = padRect(9, 0);
    expect(padAt({ x: first.x + first.w + 2, y: first.y + first.h / 2 }, 9)).toBeNull();
  });

  it('finds the Boards button, and every board in the picker', () => {
    const button = LAYOUT.boardsButton;
    expect(inBoardsButton({ x: button.left + 10, y: button.top + 10 })).toBe(true);
    for (let index = 0; index < BOARDS.length; index += 1) {
      const rect = pickerRect(index);
      expect(pickerAt({ x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 })).toBe(index);
      expect(inPickerPanel({ x: rect.x + 4, y: rect.y + 4 })).toBe(true);
    }
    expect(inPickerPanel({ x: 10, y: 740 })).toBe(false);
  });
});
```

```ts
// games/pond/src/view/art.test.ts
import { describe, it, expect } from 'vitest';
import { depthOf, recordingContext } from '@bundle/core';
import { drawPad, drawPond, type PadLook } from './art.js';

const rect = { x: 100, y: 100, w: 200, h: 120 };
const look = (overrides: Partial<PadLook>): PadLook => ({ face: 'down', text: '3 + 4', font: 40, turn: 1, bloom: 0, cursor: false, ...overrides });

describe('the art', () => {
  it('draws the pond and every kind of pad with saves and restores balanced', () => {
    const { ctx } = recordingContext();
    drawPond(ctx, { left: -100, top: 0, right: 1252, bottom: 768 }, 1.2);
    for (const face of ['down', 'up', 'star'] as const) drawPad(ctx, rect, look({ face, bloom: 0.5, cursor: true, turn: 0.4 }));
    expect(depthOf(ctx)).toBe(0);
  });

  it('never writes the sum on a face-down pad', () => {
    const { ctx, texts } = recordingContext();
    drawPad(ctx, rect, look({ face: 'down' }));
    expect(texts).not.toContain('3 + 4');
  });

  it('writes the sum on a face-up pad, and a star on the free one', () => {
    const up = recordingContext();
    drawPad(up.ctx, rect, look({ face: 'up' }));
    expect(up.texts).toContain('3 + 4');
    const star = recordingContext();
    drawPad(star.ctx, rect, look({ face: 'star', text: '' }));
    expect(star.texts).toContain('★');
  });
});
```

```ts
// games/pond/src/view/hud.test.ts
import { describe, it, expect } from 'vitest';
import { depthOf, recordingContext } from '@bundle/core';
import { BOARDS } from '../logic/boards.data.js';
import { drawEndCard, drawMatchLine, drawPicker, drawTopBar } from './hud.js';

describe('the hud', () => {
  it('names the board and the stars, and offers the picker', () => {
    const { ctx, texts } = recordingContext();
    drawTopBar(ctx, { title: '4 × 4', totalStars: 7 });
    expect(texts).toEqual(expect.arrayContaining(['4 × 4', '★ 7', 'Boards']));
    expect(depthOf(ctx)).toBe(0);
  });

  it('writes the match out', () => {
    const { ctx, texts } = recordingContext();
    drawMatchLine(ctx, '3 + 4 = 7 = 9 − 2', 0.5);
    expect(texts).toContain('3 + 4 = 7 = 9 − 2');
  });

  it('ends a board with the misses, the pairs and where to go next', () => {
    const next = recordingContext();
    drawEndCard(next.ctx, { stars: 2, progress: 3, misses: 9, pairs: 8, last: false });
    expect(next.texts).toEqual(expect.arrayContaining(['Pond cleared!', 'Pairs   8', 'Misses   9', 'Tap for the next board']));
    const last = recordingContext();
    drawEndCard(last.ctx, { stars: 3, progress: 3, misses: 20, pairs: 40, last: true });
    expect(last.texts).toContain('Tap to play again');
    expect(depthOf(last.ctx)).toBe(0);
  });

  it('shows every board in the picker, with stars or a lock', () => {
    const { ctx, texts } = recordingContext();
    drawPicker(ctx, { boards: BOARDS, book: { 'board-2': 3 }, open: [true, true, false, false, false, false, false, false], current: 1 });
    expect(texts).toEqual(expect.arrayContaining(['2 × 2', '9 × 9', '★★★', 'locked']));
    expect(depthOf(ctx)).toBe(0);
  });
});
```

```ts
// games/pond/src/view/scene.test.ts
import { describe, it, expect } from 'vitest';
import { DESIGN, depthOf, recordingContext } from '@bundle/core';
import { createDriver, type Driver } from '../driver.js';
import { valueAt } from '../logic/game.js';
import { sumText } from '../logic/sums.js';
import { createScene } from './scene.js';
import { TIMING } from './timing.js';

const FRAME = 1 / 60;
const SCREEN = { width: 1152, height: 768 };

const play = (driver: Driver, seconds: number) => {
  const scene = createScene();
  for (let t = 0; t <= seconds; t += FRAME) {
    scene.observe(driver.step(FRAME));
    scene.update(FRAME, driver.model());
  }
  return scene;
};
const draw = (scene: ReturnType<typeof createScene>) => {
  const recording = recordingContext();
  scene.render(recording.ctx, SCREEN);
  return recording;
};
const equalPair = (driver: Driver): [number, number] => {
  const pads = driver.game.state.pads;
  for (let a = 0; a < pads.length; a += 1) {
    for (let b = a + 1; b < pads.length; b += 1) {
      if (!pads[a]!.up && !pads[b]!.up && valueAt(driver.game.state, a) === valueAt(driver.game.state, b)) return [a, b];
    }
  }
  throw new Error('no pair');
};

describe('the scene', () => {
  it('draws a fresh pond with every sum hidden', () => {
    const driver = createDriver({ book: {}, startLevel: 'board-4', seed: 1 });
    const { ctx, texts } = draw(play(driver, FRAME));
    expect(depthOf(ctx)).toBe(0);
    for (const pad of driver.game.state.pads) expect(texts).not.toContain(sumText(pad.card.sum!));
  });

  it('shows a pad\'s sum once it has turned over', () => {
    const driver = createDriver({ book: {}, startLevel: 'board-4', seed: 2 });
    const scene = play(driver, FRAME);
    const events = driver.act({ kind: 'flip', index: 0 });
    scene.observe(events);
    for (let t = 0; t <= TIMING.flipSeconds + FRAME; t += FRAME) scene.update(FRAME, driver.model());
    expect(draw(scene).texts).toContain(sumText(driver.game.state.pads[0]!.card.sum!));
  });

  it('writes a match out over the pond', () => {
    const driver = createDriver({ book: {}, startLevel: 'board-4', seed: 3 });
    const scene = play(driver, FRAME);
    const [a, b] = equalPair(driver);
    scene.observe(driver.act({ kind: 'flip', index: a }));
    scene.observe(driver.act({ kind: 'flip', index: b }));
    scene.update(FRAME, driver.model());
    const pads = driver.game.state.pads;
    const line = `${sumText(pads[a]!.card.sum!)} = ${pads[a]!.card.sum!.value} = ${sumText(pads[b]!.card.sum!)}`;
    expect(draw(scene).texts).toContain(line);
  });

  it('shows the end card once the pond is cleared', () => {
    const driver = createDriver({ book: {}, seed: 4 });
    const scene = play(driver, FRAME);
    while (!driver.game.state.cleared) {
      const [a, b] = equalPair(driver);
      scene.observe(driver.act({ kind: 'flip', index: a }));
      scene.observe(driver.act({ kind: 'flip', index: b }));
    }
    for (let t = 0; t < 2; t += FRAME) {
      scene.observe(driver.step(FRAME));
      scene.update(FRAME, driver.model());
    }
    expect(draw(scene).texts).toContain('Pond cleared!');
  });

  it('shows the picker over the pond', () => {
    const driver = createDriver({ book: {}, seed: 5 });
    const scene = play(driver, FRAME);
    scene.observe(driver.act({ kind: 'picker' }));
    scene.update(FRAME, driver.model());
    expect(draw(scene).texts).toContain('locked');
  });

  it('paints past the design rect, so an odd-shaped screen has no bars', () => {
    const driver = createDriver({ book: {}, seed: 6 });
    const scene = play(driver, FRAME);
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

Run: `npx vitest run games/pond/src/view`
Expected: FAIL — the modules do not exist.

- [ ] **Step 3: Implement geometry**

```ts
// games/pond/src/view/geometry.ts
import type { Point } from '@bundle/core';

/** Where everything sits, in design coordinates. */
export const LAYOUT = {
  /** The top bar: Boards left, the board's name centre, stars right. */
  hudY: 46,
  pondLeft: 60,
  pondRight: 1092,
  pondTop: 108,
  pondBottom: 744,
  /** A small board's pads stop growing here, so they never become posters. */
  maxPad: { w: 220, h: 140 },
  gap: 10,
  boardsButton: { left: 24, top: 18, width: 150, height: 56 },
  /** The picker: two rows of four boards. */
  picker: { left: 156, top: 196, width: 840, height: 440, cols: 4 },
} as const;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const inside = (point: Point, rect: Rect): boolean =>
  point.x >= rect.x && point.x <= rect.x + rect.w && point.y >= rect.y && point.y <= rect.y + rect.h;

/** The pad at `index` (row by row) on a `size`×`size` board, the grid centred in the pond. */
export function padRect(size: number, index: number): Rect {
  const areaW = LAYOUT.pondRight - LAYOUT.pondLeft;
  const areaH = LAYOUT.pondBottom - LAYOUT.pondTop;
  const w = Math.min(LAYOUT.maxPad.w, areaW / size - LAYOUT.gap);
  const h = Math.min(LAYOUT.maxPad.h, areaH / size - LAYOUT.gap);
  const gridW = size * (w + LAYOUT.gap) - LAYOUT.gap;
  const gridH = size * (h + LAYOUT.gap) - LAYOUT.gap;
  const left = LAYOUT.pondLeft + (areaW - gridW) / 2;
  const top = LAYOUT.pondTop + (areaH - gridH) / 2;
  const row = Math.floor(index / size);
  const col = index % size;
  return { x: left + col * (w + LAYOUT.gap), y: top + row * (h + LAYOUT.gap), w, h };
}

/** Lettering as big as a pad allows: tall enough to read, narrow enough for `13 − 5`. */
export const padFont = (size: number): number => {
  const { w, h } = padRect(size, 0);
  return Math.min(h * 0.45, w / 4);
};

export function padAt(point: Point, size: number): number | null {
  for (let index = 0; index < size * size; index += 1) if (inside(point, padRect(size, index))) return index;
  return null;
}

export const inBoardsButton = (point: Point): boolean => {
  const { left, top, width, height } = LAYOUT.boardsButton;
  return inside(point, { x: left, y: top, w: width, h: height });
};

export function pickerRect(index: number): Rect {
  const { left, top, width, height, cols } = LAYOUT.picker;
  const cellW = width / cols;
  const cellH = height / 2;
  return { x: left + (index % cols) * cellW + 10, y: top + Math.floor(index / cols) * cellH + 10, w: cellW - 20, h: cellH - 20 };
}

export function pickerAt(point: Point): number | null {
  for (let index = 0; index < 8; index += 1) if (inside(point, pickerRect(index))) return index;
  return null;
}

export const inPickerPanel = (point: Point): boolean => {
  const { left, top, width, height } = LAYOUT.picker;
  return inside(point, { x: left, y: top, w: width, h: height });
};
```

- [ ] **Step 4: Implement the art**

```ts
// games/pond/src/view/art.ts
import { label, type Bounds } from '@bundle/core';
import type { Rect } from './geometry.js';

const TAU = Math.PI * 2;

export interface PadLook {
  face: 'down' | 'up' | 'star';
  text: string;
  font: number;
  /** Horizontal squash while turning over: 1 flat on the water, near 0 edge-on. */
  turn: number;
  /** 0..1 of a matched pad's flower opening; 0 for none. */
  bloom: number;
  /** The keyboard highlight, for testing on a desktop. */
  cursor: boolean;
}

/** The water, with a few ripples moving on it. */
export function drawPond(ctx: CanvasRenderingContext2D, bounds: Bounds, time: number): void {
  ctx.save();
  const water = ctx.createLinearGradient(0, bounds.top, 0, bounds.bottom);
  water.addColorStop(0, '#a9dcef');
  water.addColorStop(1, '#6fb9d8');
  ctx.fillStyle = water;
  ctx.fillRect(bounds.left, bounds.top, bounds.right - bounds.left, bounds.bottom - bounds.top);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 3;
  for (let ring = 0; ring < 6; ring += 1) {
    const x = 120 + ring * 190;
    const y = 160 + ((ring * 97) % 520);
    const r = 20 + ((time * 14 + ring * 11) % 40);
    ctx.beginPath();
    ctx.ellipse(x, y, r * 1.6, r * 0.6, 0, 0, TAU);
    ctx.stroke();
  }
  // Reeds along the near edge.
  ctx.fillStyle = '#7cb35a';
  for (let x = bounds.left; x < bounds.right; x += 46) {
    ctx.beginPath();
    ctx.moveTo(x, bounds.bottom);
    ctx.quadraticCurveTo(x + 6, bounds.bottom - 40, x + 12, bounds.bottom - 64);
    ctx.lineTo(x + 18, bounds.bottom);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawFlower(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, open: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(open, open);
  ctx.fillStyle = '#f7a8c4';
  for (let petal = 0; petal < 6; petal += 1) {
    ctx.beginPath();
    ctx.ellipse(Math.cos((petal / 6) * TAU) * size * 0.5, Math.sin((petal / 6) * TAU) * size * 0.5, size * 0.42, size * 0.24, (petal / 6) * TAU, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = '#ffd36e';
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.3, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/**
 * One lily pad. Face down it is a plain green pad and says nothing — the sum
 * stays hidden. Face up it is pale with the sum in large lettering; matched,
 * a flower opens on it.
 */
export function drawPad(ctx: CanvasRenderingContext2D, rect: Rect, look: PadLook): void {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(Math.max(0.04, look.turn), 1);

  if (look.cursor) {
    ctx.strokeStyle = 'rgba(255,214,90,0.95)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.ellipse(0, 0, rect.w / 2 + 6, rect.h / 2 + 6, 0, 0, TAU);
    ctx.stroke();
  }

  if (look.face === 'down') {
    ctx.fillStyle = '#5fae55';
    ctx.strokeStyle = 'rgba(40,90,40,0.45)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, 0, rect.w / 2, rect.h / 2, 0, 0.18, TAU - 0.18);
    ctx.lineTo(0, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    for (const angle of [0.9, 1.9, 2.9, 3.9, 4.9]) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(angle) * rect.w * 0.42, Math.sin(angle) * rect.h * 0.42);
      ctx.stroke();
    }
  } else {
    ctx.fillStyle = look.face === 'star' ? '#ffe9a8' : '#eef8e4';
    ctx.strokeStyle = 'rgba(40,90,40,0.4)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, 0, rect.w / 2, rect.h / 2, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    label(ctx, look.face === 'star' ? '★' : look.text, 0, 2, look.font, 'center');
    if (look.bloom > 0) drawFlower(ctx, rect.w / 2 - rect.h * 0.22, -rect.h / 2 + rect.h * 0.18, rect.h * 0.32, look.bloom);
  }
  ctx.restore();
}
```

- [ ] **Step 5: Implement the HUD**

```ts
// games/pond/src/view/hud.ts
import { DESIGN, hand, label } from '@bundle/core';
import type { BoardDef } from '../logic/boards.data.js';
import type { StarBook } from '../logic/stars.js';
import { LAYOUT, pickerRect } from './geometry.js';

function panel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string): void {
  const radius = 24;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
  ctx.fill();
}

export function drawTopBar(ctx: CanvasRenderingContext2D, model: { title: string; totalStars: number }): void {
  ctx.save();
  const { left, top, width, height } = LAYOUT.boardsButton;
  panel(ctx, left, top, width, height, 'rgba(255,255,255,0.8)');
  label(ctx, 'Boards', left + width / 2, top + height / 2, 28, 'center');
  label(ctx, model.title, DESIGN.width / 2, LAYOUT.hudY, 38, 'center');
  label(ctx, `★ ${model.totalStars}`, DESIGN.width - 40, LAYOUT.hudY, 30, 'right');
  ctx.restore();
}

/** The match, written out over the pond — `3 + 4 = 7 = 9 − 2`. The teaching beat. */
export function drawMatchLine(ctx: CanvasRenderingContext2D, text: string, progress: number): void {
  ctx.save();
  ctx.globalAlpha = progress > 0.8 ? Math.max(0, (1 - progress) / 0.2) : 1;
  panel(ctx, DESIGN.width / 2 - 300, DESIGN.height / 2 - 50, 600, 100, 'rgba(255,255,255,0.92)');
  label(ctx, text, DESIGN.width / 2, DESIGN.height / 2, 50, 'center');
  ctx.restore();
}

function stars(ctx: CanvasRenderingContext2D, x: number, y: number, earned: number, progress: number): void {
  for (let index = 0; index < 3; index += 1) {
    const shown = index < earned && progress > index;
    ctx.font = hand(700, shown ? 64 : 56);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = shown ? '#ffc93a' : 'rgba(255,255,255,0.75)';
    ctx.fillText('★', x + (index - 1) * 90, y);
  }
}

/** A board cleared: how it went, never a failure screen. */
export function drawEndCard(
  ctx: CanvasRenderingContext2D,
  model: { stars: number; progress: number; misses: number; pairs: number; last: boolean },
): void {
  ctx.save();
  ctx.fillStyle = 'rgba(12,24,38,0.45)';
  ctx.fillRect(0, 0, DESIGN.width, DESIGN.height);
  panel(ctx, DESIGN.width / 2 - 320, 180, 640, 420, '#f7fbff');
  label(ctx, 'Pond cleared!', DESIGN.width / 2, 250, 52, 'center');
  stars(ctx, DESIGN.width / 2, 340, model.stars, model.progress);
  label(ctx, `Pairs   ${model.pairs}`, DESIGN.width / 2, 420, 32, 'center');
  label(ctx, `Misses   ${model.misses}`, DESIGN.width / 2, 466, 32, 'center');
  label(ctx, model.last ? 'Tap to play again' : 'Tap for the next board', DESIGN.width / 2, 550, 30, 'center');
  ctx.restore();
}

/** Every board, its best stars, and the ones still locked. Tap outside to close. */
export function drawPicker(
  ctx: CanvasRenderingContext2D,
  model: { boards: readonly BoardDef[]; book: StarBook; open: readonly boolean[]; current: number },
): void {
  ctx.save();
  ctx.fillStyle = 'rgba(12,24,38,0.45)';
  ctx.fillRect(0, 0, DESIGN.width, DESIGN.height);
  const { left, top, width, height } = LAYOUT.picker;
  panel(ctx, left - 20, top - 70, width + 40, height + 90, '#f7fbff');
  label(ctx, 'Choose a board', DESIGN.width / 2, top - 32, 36, 'center');
  model.boards.forEach((board, index) => {
    const rect = pickerRect(index);
    const open = model.open[index] ?? false;
    ctx.globalAlpha = open ? 1 : 0.5;
    panel(ctx, rect.x, rect.y, rect.w, rect.h, index === model.current ? '#cfeec3' : '#e4f3f7');
    label(ctx, board.title, rect.x + rect.w / 2, rect.y + rect.h * 0.38, 34, 'center');
    const earned = model.book[board.id] ?? 0;
    const line = open ? '★'.repeat(earned) + '☆'.repeat(3 - earned) : 'locked';
    label(ctx, line, rect.x + rect.w / 2, rect.y + rect.h * 0.7, 28, 'center');
    ctx.globalAlpha = 1;
  });
  ctx.restore();
}
```

- [ ] **Step 6: Implement the scene**

```ts
// games/pond/src/view/scene.ts
import { drawArrivingBanner, fitToScreen, visibleBounds, type Point, type Size } from '@bundle/core';
import type { DriverEvent, SceneModel } from '../driver.js';
import { BOARDS, pairsOf } from '../logic/boards.data.js';
import { sumText } from '../logic/sums.js';
import { drawPad, drawPond } from './art.js';
import { LAYOUT, padFont, padRect } from './geometry.js';
import { drawEndCard, drawMatchLine, drawPicker, drawTopBar } from './hud.js';
import { TIMING } from './timing.js';

export interface Scene {
  update(dt: number, model: SceneModel): void;
  /** What just happened, so the scene can react. State stays the driver's. */
  observe(events: readonly DriverEvent[]): void;
  render(ctx: CanvasRenderingContext2D, screen: Size): void;
  toDesign(point: Point, screen: Size): Point;
  /** The keyboard highlight, or null. */
  setCursor(index: number | null): void;
}

export function createScene(): Scene {
  let model: SceneModel | null = null;
  let clock = 0;
  let clearedFor = 0;
  let cursor: number | null = null;
  /** Seconds since each pad started turning over. */
  const turning = new Map<number, number>();
  /** Seconds since each matched pad's flower started opening. */
  const blooming = new Map<number, number>();
  let matchLine: { text: string; life: number } | null = null;
  let banner: { title: string; life: number } | null = null;

  return {
    observe(events) {
      for (const event of events) {
        switch (event.type) {
          case 'flipped':
            turning.set(event.index, 0);
            break;
          case 'hidden':
            turning.set(event.a, 0);
            turning.set(event.b, 0);
            break;
          case 'matched': {
            blooming.set(event.a, 0);
            blooming.set(event.b, 0);
            const pads = model?.game.pads;
            const first = pads?.[event.a]?.card.sum;
            const second = pads?.[event.b]?.card.sum;
            if (first && second) matchLine = { text: `${sumText(first)} = ${event.value} = ${sumText(second)}`, life: 0 };
            break;
          }
          case 'board':
            turning.clear();
            blooming.clear();
            matchLine = null;
            banner = { title: event.board.title, life: 0 };
            break;
          case 'scored':
            clearedFor = 0;
            break;
          default:
            break;
        }
      }
    },

    update(dt, next) {
      model = next;
      clock += dt;
      if (next.phase === 'cleared') clearedFor += dt;
      for (const [index, life] of turning) {
        if (life + dt >= TIMING.flipSeconds) turning.delete(index);
        else turning.set(index, life + dt);
      }
      for (const [index, life] of blooming) blooming.set(index, Math.min(TIMING.bloomSeconds, life + dt));
      if (matchLine) {
        matchLine.life += dt;
        if (matchLine.life > TIMING.matchLineSeconds) matchLine = null;
      }
      if (banner) {
        banner.life += dt;
        if (banner.life > TIMING.boardAnnounceSeconds) banner = null;
      }
    },

    render(ctx, screen) {
      const current = model;
      if (!current) return;
      const transform = fitToScreen(screen);
      const bounds = visibleBounds(screen, transform);
      const size = current.board.size;
      const font = padFont(size);

      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.translate(transform.offsetX, transform.offsetY);
      ctx.scale(transform.scale, transform.scale);

      drawPond(ctx, bounds, clock);
      current.game.pads.forEach((pad, index) => {
        const sum = pad.card.sum;
        const life = turning.get(index);
        // Turning over: the old face for the first half, the new one after.
        const through = life === undefined ? 1 : life / TIMING.flipSeconds;
        const showsUp = through < 0.5 ? !pad.up : pad.up;
        const face = sum === null ? 'star' : showsUp ? 'up' : 'down';
        drawPad(ctx, padRect(size, index), {
          face,
          text: sum && showsUp ? sumText(sum) : '',
          font,
          turn: life === undefined ? 1 : Math.abs(Math.cos(through * Math.PI)),
          bloom: pad.matched ? (blooming.get(index) ?? TIMING.bloomSeconds) / TIMING.bloomSeconds : 0,
          cursor: cursor === index && current.phase === 'playing',
        });
      });

      drawTopBar(ctx, { title: current.board.title, totalStars: current.totalStars });
      if (matchLine) drawMatchLine(ctx, matchLine.text, matchLine.life / TIMING.matchLineSeconds);
      if (banner) {
        drawArrivingBanner(ctx, banner.title, banner.life / TIMING.boardAnnounceSeconds, TIMING.boardSettleFraction, LAYOUT.hudY);
      }
      if (current.phase === 'cleared' || (current.phase === 'picking' && current.game.cleared)) {
        drawEndCard(ctx, {
          stars: current.earned ?? 0,
          progress: (clearedFor - TIMING.starsDelaySeconds) / TIMING.starSeconds,
          misses: current.game.misses,
          pairs: pairsOf(current.board),
          last: current.index === BOARDS.length - 1,
        });
      }
      if (current.phase === 'picking') drawPicker(ctx, { boards: BOARDS, book: current.book, open: current.open, current: current.index });

      ctx.restore();
    },

    toDesign(point, screen) {
      return fitToScreen(screen).toDesign(point);
    },

    setCursor(index) {
      cursor = index;
    },
  };
}
```

- [ ] **Step 7: Run to see them pass**

Run: `npx vitest run games/pond && npm run typecheck`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add games/pond/src/view
git commit -m "feat(pond): the pond, lily pads that turn over, and the picker"
```

---

### Task 8: Input

**Files:**
- Create: `games/pond/src/view/input.ts`, `games/pond/src/view/input.test.ts`

**Interfaces:**
- Consumes: `Scene` (Task 7); `padAt`, `inBoardsButton`, `pickerAt`, `inPickerPanel` (Task 7); `Intent`, `Phase` (Task 6).
- Produces: `createInput(canvas, scene, emit, current: () => { phase: Phase; size: number }): { dispose(): void }`.

- [ ] **Step 1: Write the failing test**

```ts
// games/pond/src/view/input.test.ts
// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import type { Phase } from '../driver.js';
import type { Intent } from '../intent.js';
import { LAYOUT, padRect, pickerRect } from './geometry.js';
import { createInput } from './input.js';
import { createScene } from './scene.js';

const canvasOf = (width: number, height: number): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  Object.defineProperty(canvas, 'clientWidth', { value: width });
  Object.defineProperty(canvas, 'clientHeight', { value: height });
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width, height, right: width, bottom: height, x: 0, y: 0, toJSON: () => ({}) });
  document.body.appendChild(canvas);
  return canvas;
};

const pointer = (canvas: HTMLCanvasElement, type: string, x: number, y: number, pointerId = 1) => {
  const event = new MouseEvent(type, { clientX: x, clientY: y, bubbles: true }) as MouseEvent & { pointerId: number };
  Object.defineProperty(event, 'pointerId', { value: pointerId });
  Object.defineProperty(event, 'isPrimary', { value: pointerId === 1 });
  canvas.dispatchEvent(event);
};

const tap = (canvas: HTMLCanvasElement, x: number, y: number) => {
  pointer(canvas, 'pointerdown', x, y);
  pointer(canvas, 'pointerup', x, y);
};

const setup = (phase: Phase = 'playing', size = 4, width = 1152, height = 768) => {
  const canvas = canvasOf(width, height);
  const intents: Intent[] = [];
  const input = createInput(canvas, createScene(), (intent) => intents.push(intent), () => ({ phase, size }));
  return { canvas, intents, input };
};

const centre = (rect: { x: number; y: number; w: number; h: number }) => ({ x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 });

afterEach(() => document.body.replaceChildren());

describe('input', () => {
  it('turns a tap on a pad into a flip', () => {
    const { canvas, intents, input } = setup();
    const at = centre(padRect(4, 5));
    tap(canvas, at.x, at.y);
    expect(intents).toEqual([{ kind: 'flip', index: 5 }]);
    input.dispose();
  });

  it('does nothing for a finger that slides off the pad it went down on', () => {
    const { canvas, intents, input } = setup();
    const at = centre(padRect(4, 5));
    const away = centre(padRect(4, 6));
    pointer(canvas, 'pointerdown', at.x, at.y);
    pointer(canvas, 'pointerup', away.x, away.y);
    expect(intents).toEqual([]);
    input.dispose();
  });

  it('hits the pad under the finger on a screen that is not 3:2', () => {
    // 2000x768: the design is centred with 424px of water either side.
    const { canvas, intents, input } = setup('playing', 9, 2000, 768);
    const at = centre(padRect(9, 40));
    tap(canvas, at.x + 424, at.y);
    expect(intents).toEqual([{ kind: 'flip', index: 40 }]);
    input.dispose();
  });

  it('opens the picker from the Boards button', () => {
    const { canvas, intents, input } = setup();
    tap(canvas, LAYOUT.boardsButton.left + 20, LAYOUT.boardsButton.top + 20);
    expect(intents).toEqual([{ kind: 'picker' }]);
    input.dispose();
  });

  it('picks a board in the picker, and closes it on a tap outside', () => {
    const { canvas, intents, input } = setup('picking');
    const at = centre(pickerRect(2));
    tap(canvas, at.x, at.y);
    tap(canvas, 20, 740);
    expect(intents).toEqual([{ kind: 'pick', index: 2 }, { kind: 'close' }]);
    input.dispose();
  });

  it('moves on with any tap once the pond is cleared', () => {
    const { canvas, intents, input } = setup('cleared');
    tap(canvas, 600, 400);
    expect(intents).toEqual([{ kind: 'next' }]);
    input.dispose();
  });

  it('ignores a second finger', () => {
    const { canvas, intents, input } = setup();
    const at = centre(padRect(4, 0));
    const other = centre(padRect(4, 1));
    pointer(canvas, 'pointerdown', at.x, at.y, 1);
    pointer(canvas, 'pointerdown', other.x, other.y, 2);
    pointer(canvas, 'pointerup', other.x, other.y, 2);
    pointer(canvas, 'pointerup', at.x, at.y, 1);
    expect(intents).toEqual([{ kind: 'flip', index: 0 }]);
    input.dispose();
  });

  it('moves a highlight with the arrow keys and flips with the space bar', () => {
    const { intents, input } = setup();
    globalThis.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    globalThis.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    globalThis.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    expect(intents).toEqual([{ kind: 'flip', index: 5 }]);
    input.dispose();
    globalThis.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    expect(intents).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run to see it fail**

Run: `npx vitest run games/pond/src/view/input.test.ts`
Expected: FAIL — `./input.js` does not exist.

- [ ] **Step 3: Implement**

```ts
// games/pond/src/view/input.ts
import { DESIGN, type Point, type Size } from '@bundle/core';
import type { Phase } from '../driver.js';
import type { Intent } from '../intent.js';
import { inBoardsButton, inPickerPanel, padAt, pickerAt } from './geometry.js';
import type { Scene } from './scene.js';

export interface InputHandle {
  dispose(): void;
}

/**
 * Tap is the whole game: a tap acts when the finger lifts on the thing it went
 * down on, so a slipped finger does nothing. One finger is followed; a second
 * is ignored. Arrow keys and Space do the same on a desktop, for testing.
 */
export function createInput(
  canvas: HTMLCanvasElement,
  scene: Scene,
  emit: (intent: Intent) => void,
  current: () => { phase: Phase; size: number },
): InputHandle {
  let pressed: { pointerId: number; intent: Intent | null } | null = null;
  let cursor: number | null = null;

  const screenSize = (): Size => ({
    width: canvas.clientWidth || DESIGN.width,
    height: canvas.clientHeight || DESIGN.height,
  });

  const designPoint = (event: PointerEvent): Point => {
    const bounds = canvas.getBoundingClientRect();
    return scene.toDesign({ x: event.clientX - bounds.left, y: event.clientY - bounds.top }, screenSize());
  };

  const intentAt = (point: Point): Intent | null => {
    const { phase, size } = current();
    if (phase === 'picking') {
      const index = pickerAt(point);
      if (index !== null) return { kind: 'pick', index };
      return inPickerPanel(point) ? null : { kind: 'close' };
    }
    if (inBoardsButton(point)) return { kind: 'picker' };
    if (phase === 'cleared') return { kind: 'next' };
    const index = padAt(point, size);
    return index === null ? null : { kind: 'flip', index };
  };

  const same = (a: Intent | null, b: Intent | null): boolean => JSON.stringify(a) === JSON.stringify(b);

  const onPointerDown = (event: PointerEvent): void => {
    if (pressed && pressed.pointerId !== event.pointerId && !event.isPrimary) return;
    canvas.setPointerCapture?.(event.pointerId);
    pressed = { pointerId: event.pointerId, intent: intentAt(designPoint(event)) };
  };

  const onPointerUp = (event: PointerEvent): void => {
    if (!pressed || pressed.pointerId !== event.pointerId) return;
    const down = pressed;
    pressed = null;
    canvas.releasePointerCapture?.(event.pointerId);
    if (down.intent && same(intentAt(designPoint(event)), down.intent)) emit(down.intent);
  };

  const onPointerCancel = (event: PointerEvent): void => {
    if (pressed?.pointerId === event.pointerId) pressed = null;
  };

  const MOVES: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

  const onKeyDown = (event: KeyboardEvent): void => {
    const { phase, size } = current();
    const move = MOVES[event.key];
    if (move && phase === 'playing') {
      const at = cursor ?? 0;
      const col = Math.min(size - 1, Math.max(0, (at % size) + move[0]));
      const row = Math.min(size - 1, Math.max(0, Math.floor(at / size) + move[1]));
      cursor = row * size + col;
      scene.setCursor(cursor);
      return;
    }
    if (event.key === 'Escape' && phase === 'picking') emit({ kind: 'close' });
    if (event.key !== ' ' && event.key !== 'Enter') return;
    if (phase === 'playing') emit({ kind: 'flip', index: cursor ?? 0 });
    else if (phase === 'cleared') emit({ kind: 'next' });
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

Run: `npx vitest run games/pond && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add games/pond/src/view
git commit -m "feat(pond): tap a pad, choose a board, and keys for the desktop"
```

---

### Task 9: Sound, the real module, and boards played end to end

**Files:**
- Create: `games/pond/src/audio/pond-sounds.ts`, `pond-sounds.test.ts`, `games/pond/src/integration.test.ts`
- Replace: `games/pond/src/index.ts`

**Interfaces:**
- Consumes: everything above.
- Produces: `SOUND_EVENTS`, `createPondSoundPack(bus)`; `pondGame: PondModule` with `__test: PondTestHooks`.

- [ ] **Step 1: Write the failing tests**

```ts
// games/pond/src/audio/pond-sounds.test.ts
import { describe, it, expect } from 'vitest';
import { createAudioBus } from '@bundle/core';
import { fakeContext } from '../../../../packages/core/src/audio/fake-context.js';
import { createPondSoundPack, SOUND_EVENTS } from './pond-sounds.js';

describe('the pond sound pack', () => {
  it('has a voice for every sound the game asks for', async () => {
    const bus = createAudioBus(() => fakeContext() as unknown as AudioContext);
    await bus.unlock();
    const pack = createPondSoundPack(bus);
    for (const event of SOUND_EVENTS) expect(() => pack.play(event, { step: 1 })).not.toThrow();
    expect(() => pack.play('nonsense')).not.toThrow();
  });

  it('names the moments the design cares about', () => {
    for (const event of ['flip', 'match', 'miss', 'cleared', 'board']) expect(SOUND_EVENTS).toContain(event);
  });

  it('stays silent rather than throwing before the context is unlocked', () => {
    expect(() => createPondSoundPack(createAudioBus(() => null)).play('match')).not.toThrow();
  });
});
```

```ts
// games/pond/src/integration.test.ts
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import { installCanvasStub } from '@bundle/core';
import { pondGame } from './index.js';
import { createTestHost, type TestHost } from './test-host.js';
import { BOARDS } from './logic/boards.data.js';
import * as sounds from './audio/pond-sounds.js';

let restoreCanvas: () => void;
beforeAll(() => {
  restoreCanvas = installCanvasStub();
});
afterAll(() => restoreCanvas());
afterEach(() => vi.restoreAllMocks());

const mountGame = async (startLevel?: string, host: TestHost = createTestHost()) => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const session = await pondGame.mount(container, host, startLevel ? { startLevel } : undefined);
  return { container, host, session };
};

describe('boards played through the module', () => {
  it('opens a new player on the 2×2 board and announces it', async () => {
    const played: string[] = [];
    vi.spyOn(sounds, 'createPondSoundPack').mockReturnValue({ preload: async () => {}, play: (event: string) => void played.push(event) });
    const { session } = await mountGame();
    session.__test.step(2);
    expect(session.__test.boardId()).toBe('board-2');
    expect(played).toContain('board');
    session.unmount();
  });

  it('keeps an equal pair up, and puts an unequal one back after the hold', async () => {
    const { session } = await mountGame('board-4');
    const [a, b] = session.__test.pair(true);
    session.__test.flip(a);
    session.__test.flip(b);
    expect(session.__test.state().pads[a]!.matched).toBe(true);
    const [c, d] = session.__test.pair(false);
    session.__test.flip(c);
    session.__test.flip(d);
    expect(session.__test.state().misses).toBe(1);
    session.__test.step(120);
    expect(session.__test.state().pads[c]!.up).toBe(false);
    session.unmount();
  });

  it('clears every board in turn for three stars each, and keeps them', async () => {
    const { session, host } = await mountGame();
    for (const board of BOARDS) {
      expect(session.__test.boardId()).toBe(board.id);
      session.__test.solve();
      expect(session.__test.phase()).toBe('cleared');
      session.__test.next();
    }
    const book = host.storage.get<Record<string, number>>('stars', {});
    for (const board of BOARDS) expect(book[board.id]).toBe(3);
    expect(session.__test.boardId()).toBe('board-9');
    session.unmount();
  });

  it('opens straight onto a board for ?game=pond&level=board-5', async () => {
    const { session } = await mountGame('board-5');
    expect(session.__test.boardId()).toBe('board-5');
    session.unmount();
  });

  it('picks up where the player left off', async () => {
    const host = createTestHost();
    host.storage.set('stars', { 'board-2': 3 });
    const { session } = await mountGame(undefined, host);
    expect(session.__test.boardId()).toBe('board-3');
    session.unmount();
  });

  it('opens even when the saved stars are damaged', async () => {
    const host = createTestHost();
    host.storage.set('stars', 'not a book');
    const { session } = await mountGame(undefined, host);
    expect(session.__test.boardId()).toBe('board-2');
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

Run: `npx vitest run games/pond/src/audio games/pond/src/integration.test.ts`
Expected: FAIL — no sound pack, and the placeholder module has no `__test`.

- [ ] **Step 3: Implement the sound pack**

```ts
// games/pond/src/audio/pond-sounds.ts
import { noiseBurst, tone, type AudioBus, type SoundPack } from '@bundle/core';

/**
 * Every sound the game can make, by name. A later pack backed by recorded
 * samples implements the same names and swaps in with one line of setup.
 */
export const SOUND_EVENTS: readonly string[] = ['flip', 'match', 'miss', 'cleared', 'star', 'board', 'pick'];

type Voice = (bus: AudioBus, delay: number, step: number) => void;

/** A pad turning over: a soft plip on the water. */
const flip: Voice = (bus, delay) => {
  tone(bus, { freq: 700, duration: 0.08, type: 'sine', gain: 0.1, sweepTo: 420, delay });
  noiseBurst(bus, { duration: 0.06, gain: 0.03, filterHz: 2200, delay });
};
/** Equal: a bright two-note chime. The reward. */
const match: Voice = (bus, delay) => {
  tone(bus, { freq: 659.25, duration: 0.18, type: 'triangle', gain: 0.15, delay });
  tone(bus, { freq: 987.77, duration: 0.3, type: 'triangle', gain: 0.14, delay: delay + 0.1 });
};
/** Not equal: a gentle bloop, never a buzzer. */
const miss: Voice = (bus, delay) => tone(bus, { freq: 330, duration: 0.2, type: 'sine', gain: 0.1, sweepTo: 240, delay });
const cleared: Voice = (bus, delay) => {
  [523.25, 659.25, 783.99, 1046.5].forEach((freq, index) => tone(bus, { freq, duration: 0.3, type: 'triangle', gain: 0.15, delay: delay + index * 0.09 }));
};
const star: Voice = (bus, delay, step) => tone(bus, { freq: 880 + step * 220, duration: 0.2, type: 'sine', gain: 0.14, delay });
/** A new board: three notes climbing, attention without alarm. */
const board: Voice = (bus, delay) => {
  [523.25, 659.25, 830.61].forEach((freq, index) => tone(bus, { freq, duration: 0.26, type: 'triangle', gain: 0.15, delay: delay + index * 0.11 }));
};
const pick: Voice = (bus, delay) => tone(bus, { freq: 520, duration: 0.08, type: 'sine', gain: 0.1, delay });

const VOICES: Record<string, Voice> = { flip, match, miss, cleared, star, board, pick };

export function createPondSoundPack(bus: AudioBus): SoundPack {
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
// games/pond/src/index.ts
import { createTicker, DESIGN, type GameHost, type GameModule, type GameSession } from '@bundle/core';
import { createDriver, type Driver, type DriverEvent, type Phase } from './driver.js';
import type { Intent } from './intent.js';
import { valueAt, type GameState } from './logic/game.js';
import { readBook } from './logic/progress.js';
import type { StarBook } from './logic/stars.js';
import { createPondSoundPack } from './audio/pond-sounds.js';
import { createInput } from './view/input.js';
import { createScene } from './view/scene.js';
import { TIMING } from './view/timing.js';

export interface PondOptions {
  /** A board id, so `?game=pond&level=board-5` opens straight onto the 5×5 board. */
  startLevel?: string;
}

/** Test seam: play the game without synthesising pointer geometry. */
export interface PondTestHooks {
  step(frames?: number): void;
  act(intent: Intent): void;
  flip(index: number): void;
  /** Two face-down pads that are equal (or not). */
  pair(equal: boolean): [number, number];
  /** Clear the board, matching every pair. */
  solve(): void;
  /** Wait out the stars, and move to the next board. */
  next(): void;
  boardId(): string;
  phase(): Phase;
  state(): GameState;
  stars(): StarBook;
}

export interface PondSession extends GameSession {
  readonly __test: PondTestHooks;
}

export interface PondModule extends GameModule<PondOptions> {
  mount(container: HTMLElement, host: GameHost, options?: PondOptions): Promise<PondSession>;
}

const STARS_KEY = 'stars';

export const pondGame: PondModule = {
  id: 'pond',
  title: 'Pond Pairs',

  async mount(container, host, options = {}): Promise<PondSession> {
    const sounds = createPondSoundPack(host.audio);
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
          case 'flipped':
            sounds.play('flip');
            break;
          case 'matched':
            sounds.play('match');
            break;
          case 'missed':
            sounds.play('miss', { delay: 0.15 });
            break;
          case 'scored':
            sounds.play('cleared');
            for (let step = 0; step < event.stars; step += 1) {
              sounds.play('star', { delay: TIMING.starsDelaySeconds + step * TIMING.starSeconds, step });
            }
            host.storage.set(STARS_KEY, event.book);
            break;
          case 'board':
            sounds.play('board');
            break;
          case 'picker':
            sounds.play('pick');
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
      () => ({ phase: driver.phase, size: driver.model().board.size }),
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

    const pair = (equal: boolean): [number, number] => {
      const state = driver.game.state;
      for (let a = 0; a < state.pads.length; a += 1) {
        for (let b = a + 1; b < state.pads.length; b += 1) {
          if (state.pads[a]!.up || state.pads[b]!.up) continue;
          if ((valueAt(state, a) === valueAt(state, b)) === equal) return [a, b];
        }
      }
      throw new Error(`no ${equal ? 'equal' : 'unequal'} pair left`);
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
        flip: (index) => act({ kind: 'flip', index }),
        pair,
        solve: () => {
          while (!driver.game.state.cleared) {
            const [a, b] = pair(true);
            act({ kind: 'flip', index: a });
            act({ kind: 'flip', index: b });
          }
        },
        next: () => {
          for (let i = 0; i < 60 * 5 && !driver.readyForNext; i += 1) frame(1 / 60);
          act({ kind: 'next' });
        },
        boardId: () => driver.model().board.id,
        phase: () => driver.phase,
        state: () => driver.game.state,
        stars: () => driver.book,
      },
    };
  },
};

export default pondGame;
export { createPondSoundPack, SOUND_EVENTS } from './audio/pond-sounds.js';
```

- [ ] **Step 5: Run everything**

Run: `npm test && npm run typecheck`
Expected: PASS across the bundle.

- [ ] **Step 6: Commit**

```bash
git add games/pond/src
git commit -m "feat(pond): the module, the sound pack, and every board played end to end"
```

---

### Task 10: Play it, and write it down

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Play it in the browser**

`npm run dev`, then `?game=pond`, `&level=board-5` and `&level=board-9`. Check by eye: face-down pads show no sums; a tap turns a pad over; an equal pair blooms and the match line reads like `3 + 4 = 7 = 9 − 2`; an unequal pair stays up about a second and turns back; tapping during that turns it back at once; the ★ sits in the middle of odd boards; 9×9 sums are readable and pads tappable; the picker opens from Boards, shows stars and locks, and closes on a tap outside; a cleared board shows the end card and moves on.

Fix anything wrong in the file that owns it, with a test where the mistake can be pinned by one.

- [ ] **Step 2: Add the README section**

Before "## Not built yet", add:

```markdown
## Pond Pairs

The memory game every child knows — lily pads face down, turn two over, keep
them if they match — with pictures replaced by sums, and *matching* meaning
*being the same amount*: `3 + 4` and `9 − 2` belong together. Children of six
to eight often read `=` as "the answer comes next"; here two sums that look
nothing alike pair up because they are worth the same.

**Eight square boards**, 2×2 to 9×9 (2 to 40 pairs). Odd boards have a free ★
pad in the middle. Finishing a board opens the next; the **Boards** button
picks any open one. `?game=pond&level=board-5` opens a board directly.

**The cards** are additions and subtractions within 10 on the two smallest
boards and within 20 after. Any two cards with the same value match; no two
are written the same; a pair is one addition and one subtraction wherever it
can be; every value appears an even number of times, so the pond can always be
cleared. Boards are dealt fresh every time.

**A miss** holds both pads up for a moment and turns them back, with no numbers
shown — tapping again turns them back at once. **Stars** come from misses per
pair: at most one is three stars, at most two is two.

### The test that guards it

`games/pond/src/logic/guards.test.ts` plays every board two ways. A bot with
perfect memory that works every sum out must average at least 2.5 stars on
every board; a bot that flips at random must average at most 1.5 from 4×4 up.
```

In "Not built yet", change "The other six games" to "The other five games".

- [ ] **Step 3: Final verification**

Run: `npm test && npm run typecheck && npm run build`
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add README.md games/pond
git commit -m "docs(pond): Pond Pairs in the README"
```
