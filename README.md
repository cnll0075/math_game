# Math Park

A bundle of ten little math games for iPad. One game is built: **Seesaw Park**,
in which animal weights drive a seesaw and the arithmetic is the mechanic rather
than the subject.

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # the whole suite
npm run typecheck  # tsc, strict
npm run build      # production bundle into dist/
```

It runs full-screen in iPad Safari as-is, and is structured to be wrapped in
Capacitor/WKWebView for the App Store.

Development shortcut: `?game=seesaw&level=level-4` opens a level directly.

## Testing on an iPad

With the Mac and the iPad on the same Wi-Fi:

```bash
npm run dev:ipad     # serves on the network, not just localhost
```

Vite prints a **Network:** address (`http://192.168.x.x:5173/`). Open that in
Safari on the iPad. Changes on the Mac reload the iPad immediately.

macOS may ask to allow incoming connections the first time — say yes, or the
iPad will not reach it.

**Make it feel like an app.** In Safari, Share → *Add to Home Screen*, and open
it from the icon. That drops the browser chrome and runs it full-screen, which
is how a child would actually meet it. The page already declares itself
web-app-capable and locks out pinch-zoom and rubber-band scrolling.

**Hold it in landscape.** The scene is laid out for a landscape iPad; portrait
works but wastes most of the screen.

**If there is no sound**, tap the screen once (browsers only allow audio to
start after a touch — the game unlocks it on the first tap), then check the
iPad's volume and that its side switch is not set to mute.

**To test what will actually ship**, serve the built bundle rather than the dev
server:

```bash
npm run build && npm run preview   # http://192.168.x.x:4173/
```

**To see errors from the iPad**, enable iPad Settings → Safari → Advanced → Web
Inspector, connect it by cable, then on the Mac open Safari → Develop → [your
iPad] → the page. The console appears on the Mac.

## Layout

```
packages/core/   shared runtime: audio bus, storage, settings, entitlements, ticker, rng
apps/shell/      the bundle app: launcher grid, settings, sound lab, game host
games/seesaw/    the first game
  src/logic/     pure rules — no DOM, no timers, no audio
  src/view/      canvas presentation — reads state, never writes it
  src/audio/     the seesaw's sound pack
docs/superpowers/specs/   design spec
docs/superpowers/plans/   implementation plan
```

The shell owns the single audio bus, profile store, settings object, and
entitlement check, and passes them to a game through `GameHost`. Games own
nothing global, so adding the next nine changes the catalog and nothing else.

## The curriculum

Fifteen levels, one mechanic: put animals on the seesaw until it does what was
asked. The depth is in the problems, not in the verbs. Every level is three to
five **rounds** of the same idea with different numbers, because a child who has
met "3 and 2 make 5" once has not met it.

| | Level | The idea |
|---|---|---|
| 1 | Same | equality |
| 2 | Count Them | counting and matching |
| 3 | Two Little Ones | composing: 2 = 1+1 |
| 4 | The Dog | two ways to make 3 |
| 5 | Make Three | missing addend |
| 6 | Make Five | missing addend, bigger |
| 7 | No Four | nothing weighs four, so four must be built |
| 8 | All the Same | repeated addition: six is three cats |
| 9 | No Little Ones | compensation: add to *both* sides |
| 10 | Make Ten | the biggest sums |
| 11 | Take One Off | subtraction: lift an animal instead |
| 12 | Two Ways | several right answers, all accepted |
| 13 | Fair Shares | halve a whole pile |
| 14 | Big Ones, Small Ones | one bear, answered many ways |
| 15 | Animal Park | one round of each idea |

**The tray is the level design.** What is *missing* from it is what makes a
round interesting. Level 9 offers a gap of one and no chicken, so the only way
through is a dog on the light side and a cat on the heavy one — 3 − 2 = 1, and
the first time a child sees that adding to the heavy side can help. Level 8
offers one species, so the question becomes "how many of these?".

There is deliberately **no animal weighing four**: chicken 1, cat 2, dog 3,
bear 5. Making four is always 3+1 or 2+2.

## Adding or changing a level

Edit `games/seesaw/src/logic/levels.data.ts`. A level is data:

```ts
{
  id: 'level-9',
  title: 'No Little Ones',
  objective: { kind: 'balance' },
  hint: 'You can add to both sides',
  rounds: [
    { initial: { left: ['dog'], right: ['cat'] }, tray: ['cat', 'dog'] },
    // ...
  ],
}
```

Objectives are `balance`, `sideDown`, and `tilt` (an exact weight difference,
shown as a star). A round may carry its own objective, so a level whose rounds
ask different things needs no special machinery. Two level-wide switches change
what is allowed: `allowRemoval` lets the player lift animals the round started
with (subtraction), and `requireEmptyTray` makes every animal have to be seated
(sharing a pile).

`levels.test.ts` brute-forces every round of every level — searching removals as
well as placements — so a round that cannot be solved fails the suite rather
than reaching a child. It also checks each level's mathematical intent: that
level 7's rounds always need more than one animal, that level 9's always need
both sides, that level 11's always need a removal, that level 12's have several
answers, and that level 13's piles actually halve.

## Swapping the art

All drawing goes through `SeesawTheme` (`games/seesaw/src/view/theme.ts`).
`createVectorTheme()` is the prototype: flat shapes drawn in code, no assets.

To use real art, implement the same interface — `drawBackground`, `drawSeesaw`,
`drawTarget`, `drawGauge`, `drawFlag`, `drawCelebration`, and an `AnimalArtist`
— and pass it to `createScene`. `preload()` is awaited during `mount`, so a
theme that loads images needs no other change.

Animals are drawn from an `AnimalPose`: position, scale, plank angle, wobble,
slide, a `dance` value, and one of four expressions. Whole-body art per
expression drops in unchanged, and a sprite theme drives a dance clip from
`dance` instead of the procedural hop. Sprite-sheet or rigged animation (Rive,
Spine) for the *other* states needs one more field on `AnimalPose` — a clip name
and time — with the theme driving clips instead of the procedural transforms.

Animation timing lives in `view/timing.ts`, separate from the theme, so retuning
the feel and swapping the art stay independent jobs.

## Swapping the sounds

Sounds are synthesised through Web Audio; there are no audio files.
`createSynthSoundPack` implements `SoundPack`, whose events are `ding`, `creak`,
`land`, `danger`, `success`, `cheer`, `goal`, `stamp`, and `voice:<species>`.
Every event honours a `delay` param, which is how the celebration staggers its
cries without timers. A pack backed by recordings implements the same names and
is swapped in one line.

**The animals speak.** Touching one plays its cry, so a child who cannot read
the number still knows what they are holding — which is why the smallest animal
is a chicken rather than a rabbit. Each cry is described in the animal catalogue
as a pitch that slides, repeated a few times, with a roughness: a cluck is three
clipped squares, a growl is one long rough slide down.

The **sound lab** fires each event from a button, for auditioning candidates
without replaying a level: open Settings and long-press the "Settings" heading
for three seconds.

Music defaults to off — the game is built to feel complete muted.

## Layout

The design space is 1152x768 (3:2). Gameplay stays inside it and is visible on
every screen; scenery paints across the whole canvas, so a screen of a different
shape is filled with park rather than letterbox bars. The clearances that let
the seesaw fill the frame — baskets missing the ground and the gauge at full
tilt, the tray clearing the fulcrum — are pinned by tests in `layout.test.ts`,
because they all sit close to something they must not collide with.

## Telling the player what is being asked

Each level asks for something different, and in play that was easy to miss. Two
things carry it:

- **The goal announces itself.** It arrives large in the middle of the screen
  with a sound, holds, then flies up into the top bar. It fires again for each
  challenge inside a level, so a new ask is always seen arriving rather than
  discovered.
- **Stage dots.** A level with several challenges shows one dot per challenge,
  ticked off as they are cleared, so it visibly differs from a level that asks
  for one thing.

In the arcade there is no picking-up step, so both landing zones glow whenever
an animal is waiting, and arrows sweep out from it towards them until the player
has seated two animals themselves. Without that there is nothing on screen
saying that tapping a side is the verb.

The target for a tilt objective is **one** thing: a ghost of the plank where it
should end up, with the star at the end of it. An earlier version drew the ghost
and floated the star above the basket, which read as two separate goals and sent
players aiming at the wrong one.

## Design rules worth keeping

- The mathematical state is authoritative. Perfect balance is
  `leftWeight === rightWeight`, edge-triggered, never derived from the rendered
  angle — visual smoothing can never move the moment the bell rings.
- The presentation layer reads game state and never writes to it.
- Animal weights exist only in the animal catalog, including the numeral each
  animal wears.
- Finishing a level is celebrated by the animals themselves — they hop, cheer,
  and chirp in a wave while the plank bobs — not by a score screen. The bob is
  added to the rendered angle only and never reaches the balance state.
- Games never ask whether the player paid; the shell hands down a content
  manifest.

## Telling the player what is being asked

Each level asks for something different, and in play that was easy to miss. Two
things carry it:

- **The goal announces itself.** It arrives large in the middle of the screen
  with a sound, holds, then flies up into the top bar. It fires again for each
  challenge inside a level, so a new ask is always seen arriving rather than
  discovered.
- **Stage dots.** A level with several challenges shows one dot per challenge,
  ticked off as they are cleared, so it visibly differs from a level that asks
  for one thing.

In the arcade there is no picking-up step, so both landing zones glow whenever
an animal is waiting, and arrows sweep out from it towards them until the player
has seated two animals themselves. Without that there is nothing on screen
saying that tapping a side is the verb.

The target for a tilt objective is **one** thing: a ghost of the plank where it
should end up, with the star at the end of it. An earlier version drew the ghost
and floated the star above the basket, which read as two separate goals and sent
players aiming at the wrong one.

## Design rules worth keeping

- The mathematical state is authoritative. Perfect balance is
  `leftWeight === rightWeight`, edge-triggered, never derived from the rendered
  angle — visual smoothing can never move the moment the bell rings.
- The presentation layer reads game state and never writes to it.
- Animal weights exist only in the animal catalog, including the numeral each
  animal wears.
- Finishing a level is celebrated by the animals themselves — they hop, cheer,
  and chirp in a wave while the plank bobs — not by a score screen. The bob is
  added to the rendered angle only and never reaches the balance state.
- Games never ask whether the player paid; the shell hands down a content
  manifest.

## The arcade half: Balance Rush (levels 6–10)

A gap sits on the plank — say the left is 5 heavier. A hand of animals waits
below. The player picks **which** animal closes the gap and **which side** it
goes on. Land exactly level and the bell rings, the animals cheer and hop off,
and a fresh gap is set.

That shape is deliberate. An earlier arcade asked only "keep it balanced", one
animal at a time, two choices — and the whole game could be won by dropping each
animal on the lighter side without ever reading a number. Ringing the bell is
now the score rather than a bonus, gaps are wider than any single animal, and
the hand holds several options, so closing one means combining: 7 is 5 and 2, or
3 and 3 and 1.

The pressure comes from the physical world rather than from arithmetic drills:

- **Impatience.** The chosen animal climbs on by itself if ignored, onto the
  side already down — so dithering makes the gap worse.
- **Families** (level 8 on). Two or three animals arrive roped together and all
  must be seated, so they have to be split between the sides. That is
  partitioning a set, the richest arithmetic in the game.
- **Wind** (level 9 on) leans on the plank as a phantom weight, so the sum has
  to account for it.
- **The danger meter** ends a round that gets away from the player entirely, and
  a lost round simply starts again.

`animal-generator.ts` proposes an arrival; `fairness.ts` disposes. Keeping them
apart means difficulty is tuned in one place rather than smeared through the
random draw. The generator judges against `snapshot()`, so it accounts for the
wind that is actually blowing.

**Level 10** never ends: the pace keeps tightening, so every run is eventually
lost, and the bells rung are the score. It tracks time survived, animals
handled, perfect balances, longest streak and near misses, and keeps a personal
best.

### Proving the math matters

`arcade-levels.test.ts` plays every level two ways at a child's pace — one
placement every 1.6 seconds, so a hand of options actually accumulates:

- **Arithmetic:** pick the animal and side that land closest to level.
- **Comparison:** take the first animal, drop it on the lighter side. No numbers
  consulted. This is the strategy that used to win.

The suite requires that arithmetic wins from every seed (so the generator can
never deal a dead round) and that it rings at least half again as many bells as
comparison in the same time. Level 6 is exempt from the second: it teaches the
loop and should be winnable by feel.

## Telling the player what is being asked

Each level asks for something different, and in play that was easy to miss. Two
things carry it:

- **The goal announces itself.** It arrives large in the middle of the screen
  with a sound, holds, then flies up into the top bar. It fires again for each
  challenge inside a level, so a new ask is always seen arriving rather than
  discovered.
- **Stage dots.** A level with several challenges shows one dot per challenge,
  ticked off as they are cleared, so it visibly differs from a level that asks
  for one thing.

In the arcade there is no picking-up step, so both landing zones glow whenever
an animal is waiting, and arrows sweep out from it towards them until the player
has seated two animals themselves. Without that there is nothing on screen
saying that tapping a side is the verb.

The target for a tilt objective is **one** thing: a ghost of the plank where it
should end up, with the star at the end of it. An earlier version drew the ghost
and floated the star above the basket, which read as two separate goals and sent
players aiming at the wrong one.

## Design rules worth keeping

- The mathematical state is authoritative. Perfect balance is
  `leftWeight === rightWeight`, edge-triggered, never derived from the rendered
  angle — visual smoothing can never move the moment the bell rings.
- The presentation layer reads game state and never writes to it.
- Animal weights exist only in the animal catalog, including the numeral each
  animal wears.
- Finishing a level is celebrated by the animals themselves — they hop, cheer,
  and chirp in a wave while the plank bobs — not by a score screen. The bob is
  added to the rendered angle only and never reaches the balance state.
- Games never ask whether the player paid; the shell hands down a content
  manifest.

## The arcade half (levels 6–10)

Animals arrive on a timer and wander off after a while, so the balance drifts
whether or not the child acts. Three rules make that fair:

- **Impatience.** The waiting animal climbs on by itself if ignored, choosing
  the side that is already down — the end it can reach. Ignoring the game makes
  a lean worse, which is what stops standing still from being a winning move.
- **Recovery.** In the red with an empty queue there is no move left to make, so
  the next animal is sent within half a second. The generator only offers
  animals that can be placed safely, so the help is real help.
- **The danger meter.** Red fills it, safety drains it, full ends the round —
  and a lost round simply starts again. One bad move never ends a round.

`animal-generator.ts` proposes; `fairness.ts` disposes. Keeping them apart means
difficulty is tuned in one place rather than smeared through the random draw.

**Wind** (levels 9 and 10) is a phantom weight, not a nudge to the drawing: a
gust adds one or two units to a side for a few seconds. Because every system
reads the one authoritative balance, the tilt, gauge, zone, flag, animal
reactions, danger meter — and the fairness validator, which therefore only
offers animals that can be placed safely in the weather actually blowing — all
respond correctly with no code of their own. A gust announces itself with
blowing leaves and a rising sound before it pushes.

**Level 10** never ends: the arrival pace keeps tightening towards a floor, so
every run is eventually lost, and how long it lasted is the score. It tracks
time survived, animals handled, perfect balances, longest streak and near
misses, and keeps the best time in the host's storage. The survival bar becomes
a "beat your best" bar rather than a reward screen.

## Not built yet

- **Real art and sound.** The prototype's are swappable through `SeesawTheme`
  and `SoundPack`; see above.
- **The other nine games.** The shell has a tile each, marked "Soon".
- **Timed or scored modes.** An arcade half was built and removed: it added
  pressure rather than arithmetic, and a player could win it by dropping each
  animal on the lighter side without reading a number. It is in the git history
  if it is ever wanted.
