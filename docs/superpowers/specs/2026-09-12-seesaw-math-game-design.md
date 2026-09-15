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


**Levels 9 and 10 complete the set** (2026-09-12). Level 9 adds wind, the single
environmental event section 20 asks for, at 45 seconds. Level 10 is the endless
park of section 21.

Wind is modelled as a **phantom weight**: a gust adds one or two units to a side
for a few seconds. The alternative — tilting the rendered plank without touching
the state — would have left the gauge, the zone and the danger meter blind to
it, making the weather decoration. As a phantom weight it flows through the one
authoritative balance, so every subsystem reacts correctly with no changes,
including the fairness validator, which consequently only offers animals that
can be placed safely in the weather actually blowing. A gust announces itself
for a second and a half before it pushes, so the child gets a beat to prepare.

Level 10 has no finish line: the arrival pace tightens towards a floor, so every
run ends eventually and its length is the score. It records the statistics
section 21 lists and keeps a best time per child in the host's storage. Against
section 10's advice about reward screens, there is no scoreboard — the survival
bar becomes a "beat your best" bar with a seconds count beside it.

Unlocks, new animals and new environments remain unbuilt, per section 35.


**Legibility pass after playtesting** (2026-09-12). Five problems found by an
adult playing it, and what each turned out to be:

- **The star was a decoy.** Level 4 drew two indicators for one goal: a dashed
  ghost showing where the plank must go, and a star floating above the basket.
  Players aimed at the star. They are now one object — a ghost plank with the
  star at its end — and the star flares when the plank reaches it.
- **Goals went unnoticed.** A caption that merely changed was too quiet for a
  game where every level asks something different. Goals now arrive large in the
  centre with a sound and fly up to the bar, re-firing for each challenge within
  a level.
- **Level 5 did not feel like three challenges.** It now shows a dot per
  challenge, ticked off with a stamp as each is cleared.
- **Level 6 was unsolvable by an adult.** The cause was not difficulty: in
  puzzle levels, picking up an animal highlights both platforms, and arcade mode
  had that highlight disabled, so nothing on screen said that tapping a side
  seats the waiting animal. The zones now glow whenever an animal waits, arrows
  point at them until the player has seated two, the objective reads "Keep it
  out of the red", and level 6's pacing was loosened considerably.
- **The countdown was easy to miss.** The bar is taller, carries the seconds
  remaining as a numeral, pulses over the last five seconds, and ticks once a
  second through them.


**The arcade half became Balance Rush** (2026-09-12). The survival arcade of
sections 17 to 21 was built, played, and found to contain very little
arithmetic — the fairness simulation's own "competent player" won every level by
dropping each animal on the lighter side, which consults no numbers at all. A
turn of one animal and two choices is a comparison, not a sum.

The mode was rebuilt around a different turn:

- A gap is seeded on the plank; the player chooses **which** animal from a hand
  of several closes it, and on which side.
- Exact balance is the score rather than a bonus: the bell rings, the animals
  hop off, and a fresh gap is set. Rounds ask for a number of bells against a
  clock; level 10 counts them forever.
- Gaps are wider than any single animal, so closing one means combining.
- Families (level 8) arrive roped together and must be split between the sides,
  which is partitioning; wind (level 9) adds itself to the sum.

Three things had to be true at once for the arithmetic to matter, and each was
found by simulation rather than by reasoning: the hand must hold several options
(arrivals now outpace a deliberating child), the fairness rule must not narrow
the pool to near-identical animals (its thresholds were widened per level), and
the clock must reward efficiency rather than merely punish slowness.

The suite asserts what can honestly be claimed: a player who works out the sums
wins from every seed and rings at least half again as many bells as one who
guesses. It does not assert that guessing always loses — a clock tight enough
for that also fails careful players on unlucky seeds, and punishing a child for
a bad shuffle is worse than letting a guesser scrape through.


**The arcade half was removed, and the curriculum rebuilt** (2026-09-13). Played
end to end, the arcade added pressure rather than arithmetic, and the game as a
whole moved far too fast for a five-year-old: each puzzle level was a single
puzzle, solved once and left behind.

The game is now fifteen levels of one mechanic — put animals on the seesaw until
it does what was asked — with the depth in the problems:

- Every level is three to five **rounds** of the same idea with different
  numbers. The `sequence` objective was deleted: a round can carry its own goal,
  so one concept replaced two.
- The **tray is the level design**. Level 9 gives a gap of one and no chicken,
  so the only way through is adding to both sides — 3 − 2 = 1. Level 8 gives one
  species, so the question becomes how many of them. Level 7's gaps are always
  four, and no animal weighs four.
- Two new level switches: `allowRemoval` makes lifting an animal off a legal
  move, which is subtraction; `requireEmptyTray` makes the whole pile have to be
  seated, which is sharing.
- The smallest animal became a **chicken**, because touching an animal now plays
  its cry and nobody knows what a rabbit sounds like.

The solver searches removals as well as placements, so every round of every
level is proved solvable, and each level's mathematical intent is asserted
directly: that level 9's rounds cannot be solved from one side, that level 11's
always need a removal, that level 13's piles halve.


**One question per level, and groups as objects** (2026-09-13). Playtesting
found the rounds-per-level structure repetitive — the same level had to be
beaten several times — and the multiplication section had been misread: offering
several identical animals to drag one at a time is not the same as choosing
between a group of three and a group of four.

- **A level is one question.** There are 32, grouped into seven sections that
  each introduce an idea and practise it. A section announces itself as it
  begins, and the dots show progress through it.
- **A tray entry can be a group**: `{ of: 'cat', count: 3 }` is picked up,
  placed and taken back as one thing. Choosing between a two, a three and a four
  is where multiplying starts.
- **Subtraction is its own section**, and it is taught before it is needed: the
  first question has an empty tray and one animal too many, so lifting is the
  only thing to try. The suite checks that nothing before that section requires
  a removal.
- **Animals move in character.** One placed on the seesaw travels there under
  its own power, with a gait per species: a chicken flaps in a high arc, a cat
  runs low and fast, a dog trots, a bear lumbers. Animals a level starts with are
  already in place and do not travel.


**Told as stories** (2026-09-13). Chapter names and question lines were written
as labels — "No Four", "Take One Off" — which describe the mechanic to an adult
and say nothing to a five-year-old. Both now read as stories: "Tricky Numbers /
Nobody weighs four!", "Time to Go Home / One chicken wants to go home". The
animals have names for the questions that are about one of them.

The progress row was abstract dots that appeared inert, because a level is one
question and so the row only changed during the win. It is now the **friends
helped in this chapter**: a portrait of the animal each question is about, grey
until answered, then filled in and cheering. The same information, in a form a
child can read.


**Plainer words, and countable groups** (2026-09-13). Playtesting again:

- The animals' pet names were dropped. "How many chickens match Mango?" mixes a
  species with an individual, and a question can hold three cats anyway.
  Questions now talk about species throughout.
- The progress row was removed. It was tried as abstract dots and then as
  portraits of the animals helped; both had to be explained, which is the answer.
  The chapter card is now the only indicator of where the player is.
- Several questions were still labels rather than stories ("Four again: 2 and 2",
  "Use both sides") and were rewritten.
- Groups are capped at four and laid out so no animal hides behind another, with
  a test that checks the geometry. They carry no weight tags: the question is how
  many there are, and a number on each would turn counting into reading.


**Four more from playtesting** (2026-09-13):

- **No animal appears on both sides** after the opening chapter. A bear opposite
  a bear can be cancelled by spotting the pair, which is matching rather than
  adding; nine levels were rewritten, the Time to Go Home chapter most of all,
  where the extra animal used to have a twin facing it.
- **Groups show their weights again.** Hiding them, decided a day earlier to
  stop the answer being read off, required a child to remember that a cat weighs
  two. The tag now stops shrinking once the animal is small, so it stays legible
  inside a pen.
- Two more question lines were still labels ("Four again") and were rewritten.
- **The last chapter no longer repeats the earlier ones.** Each of its questions
  now needs two ideas at once: two groups combined, a removal plus a group, or a
  whole pile shared where one of the pieces is a group. A test checks both that
  no question shape appears twice and that the final chapter's answers use more
  than one idea.


**Painted animals** (2026-09-14). Artwork arrived as a character sheet and
replaced the drawn animals, which is what the theme seam existed for. The four
side views were cut from it — the row without a watermark, and the right view
for a seesaw seen from the side — keyed to transparency and scaled by one shared
factor so their relative sizes stay true.

Nothing about how an animal behaves changed: gaits, wobble, the dance, the
weight tag and the arrival all live in the pose, so `createSpriteTheme()` only
supplies a different way of drawing at the end of it. Two accommodations were
needed:

- The painted animals have one expression each, so alarm moved from the face to
  a mark above the animal, shown only on the one at the end of the side that is
  down.
- Loading waits 250ms and then starts regardless, with the drawn animals
  standing in until the pictures arrive. `createVectorTheme()` stays a complete
  working set, so a missing file degrades rather than breaks.
