# Seesaw Math Game — Technical Design

Date: 2026-09-12
Source design document: `Seesaw Math Game Design Specification.docx`

## 1. Purpose and scope

Build the first game of a ten-game iPad math bundle for children aged 5–8: a
seesaw physics game in which animal weights drive the seesaw's behaviour, and
arithmetic is learned as a side effect of play.

This round delivers:

- A monorepo whose structure supports all ten games.
- A minimal bundle shell: launcher grid, settings, entitlement gate (stubbed).
- The seesaw game as the first `GameModule`: vertical slice plus Levels 1–5
  (puzzle mode).

This round deliberately excludes the arcade half (animal queue, generator,
fairness validator, environmental events, Levels 6–10), real IAP wiring,
accounts, analytics, and the other nine games. The source spec §28 requires the
core interaction to be validated before the arcade framework is built.

## 2. Product context

A single seesaw game is not a sellable product; the bundle is. Monetisation
mechanics — entitlements, progress, shell chrome — are therefore built as shared
infrastructure from the first game rather than retrofitted across ten. The
entitlement model itself (paid app, free with unlock-all IAP, per-game IAP)
remains undecided and is isolated behind one interface so it can change without
touching game code.

Apple's Kids Category rules restrict third-party advertising and analytics and
require a parental gate before any link leaving the app. The shell owns the
parental gate seam; current rules should be confirmed before a monetisation
model is chosen.

## 3. Technology

- TypeScript throughout; npm workspaces monorepo.
- Vite for dev server and production build.
- Vitest for unit and integration tests; jsdom environment for DOM-level tests.
- Canvas 2D rendering. No game framework.
- Web Audio synthesis. No audio asset files in this round.
- Deployment target: full-screen iPad Safari now; Capacitor/WKWebView wrap later.

Rationale: the machine has no full Xcode install, so a native Swift build could
not be compiled or tested. A TypeScript web app is testable end to end today and
wraps natively later.

## 4. Repository structure

```
packages/core/     @bundle/core  — game-agnostic runtime
apps/shell/        bundle app: launcher grid, settings, game host
games/seesaw/      first GameModule
docs/superpowers/  specs and plans
```

No shared UI package yet: there is one game and one shell, so shared widgets are
extracted when a second game needs them.

## 5. Shell/game boundary

```ts
interface GameHost {
  audio: AudioBus;           // shared mute/volume
  storage: ProfileStore;     // namespaced per game id
  settings: SettingsView;    // readonly + subscribe
  content: ContentManifest;  // which levels are unlocked
  exit(): void;              // return to launcher
}

interface GameModule {
  id: string;
  title: string;
  mount(container: HTMLElement, host: GameHost): Promise<GameSession>;
}

interface GameSession {
  pause(): void;
  resume(): void;
  unmount(): void;
}
```

Games never query purchase state. The shell supplies a `ContentManifest`; the
game renders locked levels as locked. Entitlements resolve through a single
function that currently returns "everything unlocked".

`unmount()` must remove every listener, cancel the animation frame, and stop all
sound. This is asserted by test.

## 6. Seesaw logic core

Pure TypeScript, no DOM, no timers. The mathematical state is authoritative and
is never derived from the rendered angle (source spec §33).

```
leftWeight        = sum of weights on the left platform
rightWeight       = sum of weights on the right platform
balanceDifference = leftWeight - rightWeight
normalizedBalance = clamp(balanceDifference / maxTiltDifference, -1, +1)
zone              = green | yellow | red, from |balanceDifference|
```

`balanceDifference > 0` means the left side is heavier and goes down.

Zone thresholds and `maxTiltDifference` are level parameters with defaults
(green `|d| <= 1`, yellow `|d| <= 3`, red beyond; `maxTiltDifference` 6).

**Perfect balance** is `leftWeight === rightWeight` with at least one animal
placed, and is **edge-triggered**: the event fires on the transition into
equality, not continuously. The view delays the audible DING until the tilt
spring has settled, so the sequence reads land → creak → settle → DING while the
logic never consults the animation.

Animals are data: `{ id, weight, palette, voice }`. Weights appear only in that
table — rabbit 1, cat 2, dog 3, bear 5.

## 7. Objectives and level data

```ts
type Objective =
  | { kind: 'balance' }
  | { kind: 'sideDown'; side: 'left' | 'right' }
  | { kind: 'tilt'; target: number }          // exact balanceDifference
  | { kind: 'sequence'; challenges: Objective[] };
```

Level 4's target marker is a star on the tilt arc at a specific
`balanceDifference`, so dog(3), cat+rabbit(3) and rabbit×3 all satisfy it with
no special-casing — satisfying the source spec's "accept all valid solutions".

Level 5 is the `sequence` kind; completing it opens the gate.

```ts
interface LevelDef {
  id: string;
  mode: 'puzzle';
  objective: Objective;
  initial: { left: AnimalId[]; right: AnimalId[] };
  tray: AnimalId[];
  maxTiltDifference?: number;
  thresholds?: { green: number; yellow: number };
}
```

Levels 1–5 are five entries in one data file. No level number is branched on
anywhere in gameplay code (source spec §30).

Level intents, from the source document:

1. Balance — rabbits only; equality and counting.
2. Different animals — one cat versus two rabbits; equivalent combinations.
3. Make a named side go down — comparison and direction.
4. Hit the target tilt — decomposition, multiple solutions.
5. Three consecutive challenges — switching objectives; opens the gate.

## 8. Interaction

Two input paths, both supported:

- Drag an animal from the tray onto a platform.
- Tap an animal, then tap a side; both platforms highlight while armed.

Tap-then-tap exists because five-year-olds drag imprecisely.

Tapping a placed animal returns it to the tray. Puzzles need a forgiving undo,
and removing an animal to try the other side is the experimentation the source
spec asks for.

## 9. Presentation

A fixed 1024×768 design space, scaled and letterboxed to the device, drawn at
device pixel ratio. The seesaw occupies most of the screen; UI is secondary.

Tilt angle is a critically damped spring chasing `normalizedBalance * 22°`.
Animals receive a slide offset along the plank proportional to tilt, a wobble
phase, and one of three expressions (calm, surprised, alarmed) selected by zone.

The balance gauge is a RED–YELLOW–GREEN–YELLOW–RED bar with a needle at the
smoothed normalized balance. The danger flag rises on the heavy side while the
zone is red.

Prototype art is code-drawn vector shapes, no image assets: four distinct
silhouettes (rabbit — tall ears, small; cat — curled tail, medium; dog — square
snout; bear — large round mass), plus grass, trees, clouds, fence and gate.

### 9.1 Art swap seam

All drawing goes through a theme interface so final art replaces prototype art
without touching logic or choreography:

```ts
interface SeesawTheme {
  preload(): Promise<void>;        // called during mount()
  drawBackground(ctx, view): void;
  drawSeesaw(ctx, view): void;
  drawGauge(ctx, view): void;
  drawFlag(ctx, view): void;
  drawGate(ctx, view): void;
  animals: AnimalArtist;
}

interface AnimalArtist {
  draw(ctx: CanvasRenderingContext2D, species: AnimalId, pose: AnimalPose): void;
}

type AnimalPose = {
  x: number; y: number; scale: number;
  tiltRad: number;
  wobble: number;                              // -1..1
  slide: number;                               // offset along plank
  expression: 'calm' | 'surprised' | 'alarmed';
};
```

`VectorTheme` ships now. A future `SpriteTheme` implements the same signatures
by blitting images under the same transforms. `preload()` exists so an
asset-loading theme does not require restructuring startup.

Known limit: whole-body art per expression drops in unchanged. Sprite-sheet or
rigged animation (Rive, Spine) requires adding a clip name and clip time to
`AnimalPose`, with the sprite theme driving clips instead of procedural
transforms — a contained change, but not a free one.

Animation timing constants (settle duration, DING delay after settle, gate
opening) live in a single `timing.ts` so feel can be retuned in one place.

## 10. Sound

Synthesised through Web Audio; no audio files this round.

- DING — two-partial bell with exponential decay; the game's signature sound.
- Creak — filtered noise with a pitch bend.
- Danger — low double blip.
- Success — short arpeggio.
- Gate — click and creak.
- `chirp:<species>` — a short pitched blip per animal.

All routed through the core `AudioBus`, which owns mute and volume and is
unlocked on first touch as iOS requires.

### 10.1 Sound swap seam

```ts
interface SoundPack {
  preload(): Promise<void>;
  play(event: SoundEvent, params?: SoundParams): void;
}
```

`SynthSoundPack` ships now; a later `SampleSoundPack` loads files and honours
the same event names. Switching packs is one line of setup.

Background music is a simple generative loop, **default off**: the source spec
requires the game to feel good muted, and unbidden looping music is a common
cause of deletion.

### 10.2 Sound lab

A hidden developer screen in the shell fires each sound event from a button, so
candidate sounds can be compared without replaying a level.

## 11. Error handling

- Level data is validated on load; malformed data fails loudly in development.
- Audio failures degrade silently to no sound; play never blocks.
- Storage failures fall back to an in-memory store.
- A missing canvas 2D context renders a plain message rather than throwing.

## 12. Testing strategy

Test-driven throughout. The logic/presentation split exists so the meaningful
behaviour is testable without a browser.

**Logic** — weight sums, `balanceDifference`, normalization clamping, zone
thresholds, edge-triggered perfect balance (including no fire on repeat frames
and no fire on an empty seesaw), every objective evaluator, sequence
advancement, take-back, reducer event emission.

**Level data** — a brute-force solver proves each of Levels 1–5 is reachable
from its tray, and that Level 4 admits at least two distinct solutions.

**Core** — audio bus routing and mute with a mocked Web Audio context, storage
round-trip and per-game namespacing, entitlement gating, seeded RNG determinism,
ticker behaviour.

**View helpers** — spring convergence and stability (no oscillation, settles
within the configured duration), world-to-screen mapping, animal slot layout for
three to five animals per side.

**Integration (jsdom)** — each of Levels 1–5 is driven to completion through the
real game module; the shell mounts and unmounts the game with no leaked
listeners, timers, or audio nodes.

Not automatable, and left to human review: how the sounds actually sound, and
how the animation feels.

## 13. Forward compatibility with the arcade half

Not built now, but designed around:

- The `Objective` union accepts new kinds (`survive`) without changing existing
  evaluators.
- `LevelDef` accepts `mode: 'arcade'` with sequence and timing fields alongside
  the puzzle fields.
- The animal generator and the fairness validator are separate units (source
  spec §34); the seeded RNG in core exists for them.
- Environmental events act on the same state as animal placement, so the gauge,
  flag, and animal reactions need no changes to respond to them.


## 14. Revisions after the first playable

Decisions taken while playing the prototype, superseding the sections above.

**Weights are shown as numerals** (2026-09-12). Each animal wears a small tag
with its weight: rabbit 1, cat 2, dog 3, bear 5. This departs from the original
principle that weight should be inferred from the physical result alone; the
tradeoff was raised — numerals move the game toward the arithmetic-first framing
§36 argues against — and the decision was to show them. Side totals are still
not shown: the plank and the gauge remain the only statement of who is heavier.

**The gate is replaced by a finishing dance** (2026-09-12). §10 proposed a gate
opening as the progression reward. In play it celebrated off to the side of
where the child was looking, so it was removed from the scene entirely. A
finished level is now celebrated by the animals on the plank: a staggered wave
of hops and spins, a cheer expression, chirps in the same wave, falling petals,
and a gentle bob of the plank. The bob is added to the rendered angle only and
never reaches the balance state.

**The design space is 1152x768, and scenery paints past it** (2026-09-12).
§9 specified 1024x768 letterboxed. iPad landscape is wider than 4:3, so the
seesaw was confined to a middle band with bars at the sides. The design space is
now 3:2, the plank is as long as it can be while both baskets stay on screen at
full tilt, and the sky and grass are painted across the whole canvas rather than
the design rectangle, so no letterbox bars show on any screen shape. Gameplay
stays inside the design rectangle, which is visible on every screen.


**The arcade half is built, with three added rules** (2026-09-12). Levels 6 to 8
are implemented as specified in sections 17 to 19, at 30, 40 and 45 seconds —
level 8 shortened from the source document's 60, which is a long first taste of
losing for a six-year-old. Three mechanics the source document does not specify
were needed to make the mode fair and tense, each found by simulating play:

- Animals wander off after 8 to 14 seconds, so the balance drifts on its own and
  the seesaw never fills past what a basket can show.
- The waiting animal climbs on by itself when ignored, onto the side already
  down. Without this, doing nothing survived every round: nothing was on the
  plank to drift.
- In the red with an empty queue, the next animal arrives within half a second.
  Without this a player who placed quickly could be left in the red with no move
  available — losing to helplessness rather than to a mistake. This is the
  "recovery opportunity" section 34 asks the fairness validator to ensure.

A lost round restarts the same level rather than ending the session.
