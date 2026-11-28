# Picnic Pals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Build Picnic Pals, the bundle's eighth game: share treats equally among 2–4 friends, by tapping plates or with a group-size dial, with leftovers to the dog, a chairs round, and cutting pizza and cake.

**Architecture:** Same shape as Bucket Bay. Pure, discrete logic in `games/picnic/src/logic/` (no time-stepping needed: the table changes only on taps), a driver for intro → playing → done → next round, a canvas view that reads the model and keeps its own animations, synthesised sounds, art cut from the sheet.

**Tech Stack:** TypeScript, Vitest, canvas 2D, `@bundle/core`, Python 3 + numpy/Pillow for the cutter.

**Spec:** `docs/superpowers/specs/2026-11-26-picnic-pals-design.md`

**Note on this plan's form:** the user waived approval gates and asked for implementation straight after the spec, so this plan fixes the interfaces and the test cases for each task and the code is written test-first during execution, rather than written out here first.

## Global Constraints

- Package `@bundle/picnic`, folder `games/picnic/`, id `'picnic'`, title `'Picnic Pals'`, tile blurb `'Share it fairly'`, replacing the `halves` placeholder.
- Design space 1152×768. No clock, no losing. Stars count shares only; every finished round earns ≥1 star.
- Friends: `teddy`, `bunny`, `fox`, `raccoon` (max four at a table). Moods: `happy`, `eating`, `puzzled`, `grumpy`.
- Treats: `cookie`, `strawberry`, `grapes`, `sandwich`. Foods to cut: `pizza` (2 pieces), `cake` (4 pieces).
- Dial range 1–10 for sharing; for chairs, the course's `choices`.
- Best stars per round in `host.storage` under `'stars'`. `?game=picnic&level=<id>` opens a round.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

- A tap or share must never leave plates unequal, and never take more treats than the basket holds.
- Leftovers given to Biscuit are always fewer than the friends seated.
- A dial change during the end-of-round celebration, or a second finger, must not change the table.
- A swipe that starts or ends outside the food must still be judged by the line it draws, not crash or count twice.
- Opening a round by URL that does not exist falls back to where the player left off.

---

### Task 1: Package, registration, data

**Files:** `games/picnic/{package.json,tsconfig.json}`, `src/{vite-env.d.ts,test-host.ts}`, `src/logic/{friends.ts,levels.data.ts}`, test `src/logic/levels.test.ts`; aliases in `tsconfig.json`, `vitest.config.ts`, `apps/shell/vite.config.ts`.

**Produces:**
- `type FriendId = 'teddy' | 'bunny' | 'fox' | 'raccoon'`, `FRIENDS: readonly FriendId[]`, `type Mood = 'happy' | 'eating' | 'puzzled' | 'grumpy'`
- `type TreatId = 'cookie' | 'strawberry' | 'grapes' | 'sandwich'`, `TREAT_NAMES: Record<TreatId, [singular, plural]>`
- `type Course = { kind: 'share'; treat: TreatId; count: number; mode: 'tap' | 'dial' } | { kind: 'chairs'; treat: TreatId; count: number; choices: readonly number[] } | { kind: 'cut'; food: 'pizza' | 'cake'; pieces: 2 | 4 }`
- `interface LevelDef { id: string; title: string; line: string; friends: readonly FriendId[]; courses: readonly Course[]; coach?: boolean }`, `LEVELS` (the spec's 12 rounds), `levelIndex(id)`

**Tests (levels.test.ts):** 12 rounds with unique ids; 2–4 distinct friends each; every share course has count ≥ friends; tap only in rounds 1–4, dial from 5; every dial course's answer (count ÷ friends, floored) is 1–10; the chairs course has exactly one choice that divides its count, and that choice ≤ its friends; cut rounds: pizza has 2 friends and 2 pieces, cake 4 and 4; remainder rounds (3, 4, 8) leave fewer than the friends.

### Task 2: The table — sharing

**Files:** `src/logic/table.ts`, test `src/logic/table.test.ts`.

**Produces:**
- `interface Summary { treat: TreatId; count: number; friends: number; each: number; leftover: number }` (cut courses: `count` = 1, `each` = pieces per friend, treat → the food)
- `interface TableState { def; course: number; seated: FriendId[]; plates: number[]; basket: number; dial: number; shares: number; cuts: Cut[]; phase: 'sharing' | 'chairs' | 'cutting' | 'done'; summaries: Summary[]; biscuit: number }`
- `type TableEvent = { type: 'gave'; plate: number } | { type: 'refused'; plate: number } | { type: 'shared'; each: number } | { type: 'short'; need: number; have: number } | { type: 'leftover'; count: number } | { type: 'course'; summary: Summary } | { type: 'seated'; chairs: number } | { type: 'unseated'; chairs: number; leftover: number } | { type: 'cut'; ok: boolean } | { type: 'served' } | { type: 'done' }`
- `createTable(def: LevelDef): Table` with `state`, `tap(plate)`, `setDial(n)`, `share()`, `seat()`, `cut(from: Point, to: Point)` (points relative to the food's centre, in units of its radius)
- `preview(state): { each: number; fits: boolean; leftover: number }` — what the next share (or seating) would do

**Tests:** tapping gives one; a plate with more than another is refused; when the basket cannot give everyone one more, the course ends, leftovers go to Biscuit (`leftover` event, count < friends); dial share gives `dial` to every plate in one `shared` event and counts one share; a share needing more than the basket is refused with `short` and changes nothing; dial clamped 1–10; changing the dial between shares works (12/3: dial 3 then 1 → 2 shares); the course summary says count, friends, each, leftover; the next course starts with fresh plates and basket; `done` after the last course; nothing changes once done.

### Task 3: The table — chairs and cutting

**Files:** `src/logic/table.ts`, tests in `table.test.ts`.

**Tests:** a chairs course starts in phase `chairs` with the dial on its smallest choice and no one seated; the dial moves only through its choices; seating at a number that leaves some over is refused (`unseated` with the leftover) and nothing changes; seating at the right number seats that many friends from the round's list and turns the course into dial sharing; a cut through the middle (line passes within 0.2 radius of the centre and crosses the food) is accepted, an off-centre one refused (`cut` ok false), and a too-short swipe ignored; pizza is done after one good cut, cake after two good cuts at least 45° apart (a second cut nearly parallel to the first is refused); when done, each friend is served one piece (`served`) and the course summary records it.

### Task 4: Stars, progress, bot

**Files:** `src/logic/{stars.ts,progress.ts,bot.ts}`, tests `stars.test.ts`, `progress.test.ts`, `bot.test.ts`.

**Produces:** `bestShares(def): number` (number of dial-shared courses, chairs included); `starsFor(def, shares): 1 | 2 | 3` (tap/cut-only rounds 3; shares ≤ best → 3, best + 1 → 2, else 1); `type StarBook`, `recordStars`, `readBook`, `startIndex(book, id?)`, `totalStars`, `MAX_STARS`; `playRound(table, policy: 'best' | 'ones')` — `best` sets the dial to the answer and cuts through the middle, `ones` shares one at a time.

**Tests:** star thresholds; the `best` bot finishes every round with 3 stars; the `ones` bot finishes every dial round with 1 star (and in round 5 at least, fewer than 3); progress opens the first round without three... (as Bucket Bay: the first round not yet starred), an unknown id falls back.

### Task 5: Art

**Files:** `scripts/cut-picnic.py`, `games/picnic/assets/*.png`, `src/view/sprites.ts`, test `sprites.test.ts`.

Boxes measured on the 1536×1024 sheet: friends in a 4×4 grid — columns eating [882,1056], happy [1064,1220], puzzled [1230,1398], grumpy [1398,1532]; rows teddy [10,196], bunny [203,388], fox [390,582], raccoon [588,772] — cut as `<friend>-<mood>.png`; table (4,58,632,306) with its three painted plates painted out from the tablecloth beside them; basket (600,36,774,207); chair (618,843,762,1002); dog-sneak (32,352,318,538); dog-caught (362,318,568,556); cookie (20,588,102,657), strawberry (338,583,412,667), grapes (528,583,647,690), sandwich (676,583,772,674); pizza (22,692,264,822), pizza-half (283,703,422,823), cake (590,702,750,824), cake-slice (766,716,880,824); dial (28,838,267,1002) with its "3" wiped; share (293,873,580,962); fence (793,848,1122,1002); grass (1138,843,1532,1002). The script verifies the sheet is 1536×1024; every cut is checked by eye on a contact sheet.

**Test:** the sprite names load to null without a browser.

### Task 6: Driver

**Files:** `src/{intent.ts,driver.ts}`, `src/view/timing.ts`, test `driver.test.ts`.

**Produces:** `type Intent = { kind: 'tap'; plate: number } | { kind: 'dial'; step: 1 | -1 } | { kind: 'share' } | { kind: 'cut'; from: Point; to: Point } | { kind: 'next' }` (Share also seats in a chairs course); `type Phase = 'intro' | 'playing' | 'done' | 'finished'`; `DriverEvent = TableEvent | { type: 'level'; level } | { type: 'won'; id; stars; book } | { type: 'finished' }`; `SceneModel { table, level, number, count, phase, since, earned, totalStars, maxStars }`; `createDriver({ book, startLevel?, seed? })`.

**Tests:** opens at the first unstarred round with a `level` event; intents are ignored in intro except that any intent starts play; a finished round goes to `done` with `won` and stars recorded; a tap in `done` before the celebration has been shown is ignored, after it moves on; the last round leads to `finished`, and a tap there starts again at round 1; nothing on the table changes in `done`.

### Task 7: The scene

**Files:** `src/view/{geometry.ts,art.ts,hud.ts,scene.ts}`, tests `geometry.test.ts`, `scene.test.ts`.

Layout: drawn sky; fence along the back on the grass; the table centred low; friends behind it with their plates on its top, spaced for 2–4; plate counts under each plate, glowing when equal; the treats to share in rows of five on the grass in front with a count tag; the basket beside the table; dial and Share bottom right; level line along the top under the banner; progress top right. Ghost treats over the plates preview the next share; friends puzzled while it would run short. Chairs: chairs set behind the table, as many as the dial says. Cutting: the food large on the table; accepted cuts drawn as lines; a refused cut flashes and fades. Biscuit runs in for leftovers. Celebration: all eating, then the card with each course's sentence and the stars.

**Produces:** `layout(seated: number)` positions; `plateAt(point, seated)`, `onDial(point): 1 | -1 | null`, `onShare(point)`, `onFood(point)`; `Scene { update, observe, render, toDesign }`; `courseLine(summary): string[]` (`12 cookies, 3 friends: 4 each!`, `1 for Biscuit!`).

**Tests:** geometry hit tests for 2, 3, 4 friends; the scene draws each plate's count, the basket count, the dial number, the level line; previews show; the card shows the course lines; recording context depth balanced in every phase.

### Task 8: Input

**Files:** `src/view/input.ts`, test `input.test.ts`.

Tap on a plate → `tap`; on the dial's left/right half → `dial` −1/+1; on Share → `share`; a drag that starts on the food → `cut` with both ends relative to the food centre in radius units; when not playing, a tap → `next`; one finger at a time.

**Tests:** each gesture's intent; a drag elsewhere does nothing; second finger ignored; tap between rounds → `next`.

### Task 9: Sounds, module, catalog, README

**Files:** `src/audio/picnic-sounds.ts`, `src/index.ts`, test `integration.test.ts`; `apps/shell/src/catalog.ts`, `apps/shell/src/shell.test.ts`, `README.md`.

Sounds: `level`, `pop`, `whoosh`, `nope`, `woof`, `chop`, `munch`, `cheer`, `star`. Test hooks: `step`, `act`, `play(policy)`, `levelId`, `phase`, `table`, `stars`.

**Tests:** mounts and unmounts; plays round 1 to `done` and records stars; opens a round from the URL; follows mute; the sound pack knows every event.

### Task 10: Look at it, tune it

Render staged frames in Chrome (friends for 2, 3 and 4; a preview running short; leftovers and Biscuit; chairs; a cut pizza and cake; the card) and fix what looks wrong. Full suite and typecheck green.
