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

**One level is one question.** There are 32 of them, grouped into sections that
each introduce an idea and then practise it a few times with different numbers.
A section announces itself when it begins, and the dots under the gauge show how
far through it the player is.

| Chapter | Idea | Questions |
|---|---|---|
| Make It Flat | what "level" means; two small ones can equal a big one | 5 |
| Who Else Can Come? | missing addend: how much more? | 5 |
| Tricky Numbers | four, which nothing weighs; and gaps that need **both** sides | 5 |
| Everybody Together | ready-made bundles: which group fits? | 5 |
| Time to Go Home | subtraction, by lifting an animal | 5 |
| Share and Share Alike | split a whole pile evenly | 3 |
| A Day at the Park | one of each, met again | 4 |

Chapters and questions are written as little stories rather than as labels:
"Nobody weighs four!" rather than "No Four", "One chicken wants to go home"
rather than "Tap an animal to take it off". They talk about species — the cat,
the dogs — never about named individuals: a pet name muddles with a count as
soon as a question holds three cats.

A chapter announces its name on its first question, and that is the only
progress indicator. Two earlier attempts — abstract dots, then a row of animal
portraits — both had to be explained, which is the answer about whether they
worked.

**Groups can be counted.** A group's animals are drawn small and laid out so
none hides behind another, and each still wears its weight — nobody should have
to remember what a cat weighs. The tag stops shrinking once the animal is small,
so it stays readable inside a pen. No group holds more than four, which is as
many as reads at a glance.

**A real seesaw has no reason to be level**, so the first two questions show a
ghost of the plank lying flat with a star at its end. The goal is shown rather
than explained, which is the only way to explain anything to a pre-reader.

**Nothing is ever lost.** An animal lifted off the seesaw waits in the tray and
can go back on either side. Taking the wrong one off must never end a question:
a child who cannot undo a mistake is stuck, and being stuck is the one thing the
game must never do.

**The two sides never share an animal**, once past the opening chapter. A bear
opposite a bear can be cancelled by spotting a pair, which is matching rather
than arithmetic. A test enforces it, as it does that no question is ever
repeated later in the game.

**The tray is the level design.** What is *missing* from it is what makes a
question interesting:

- **Build It** gives a gap of one and no chicken, so the only way through is a
  dog on the light side *and* a cat on the heavy one. 3 − 2 = 1, and it is the
  first time a child sees that adding to the heavy side can help.
- **Groups** offers ready-made bundles — two cats, three cats, four cats — as
  single things to pick up. The question is which group fits, answered by
  counting in twos, not by dragging cats one at a time.
- **Take One Off** starts with an empty tray and one animal too many, so lifting
  is the only thing to try. Nothing before that section ever requires a removal,
  which the suite checks.

There is deliberately **no animal weighing four**: chicken 1, cat 2, dog 3,
bear 5. Making four is always 3+1 or 2+2.

## Adding or changing a level

Edit `games/seesaw/src/logic/levels.data.ts`. A level is one question:

```ts
{ id: 'l16', section: 'groups', objective: { kind: 'balance' }, hint: 'Which group fits?',
  initial: { left: ['dog', 'dog'], right: [] },
  tray: [{ of: 'cat', count: 2 }, { of: 'cat', count: 3 }, { of: 'cat', count: 4 }] },
```

A tray entry is either an animal or `{ of, count }` — a group, picked up and put
down as one thing. Two switches change what is allowed: `allowRemoval` lets the
player lift animals the level started with, and `requireEmptyTray` makes every
animal have to be seated.

`levels.test.ts` brute-forces every level — searching removals as well as
placements — so a question that cannot be answered fails the suite rather than
reaching a child. It also checks each section's intent: that every Take One Off
question genuinely needs a removal and that nothing earlier does, that every
Groups question offers at least two groups and is answered in one placement with
no two groups weighing the same, and that every Fair Shares pile actually halves.

## The animals' artwork

The four animals are painted PNGs, cut from a character sheet in
`games/seesaw/assets/source/`. `scripts/extract-animals.py` does the cutting;
the sheet itself never ships, only the four cut files.

`createSpriteTheme()` draws them. Everything about how an animal behaves is
unchanged by the swap — the gaits it travels in, the wobble on a tilted plank,
the hop of the finishing dance, the weight tag — because all of that lives in
the pose rather than in the drawing. Animals face in towards the middle, so the
two sides look at each other.

**When the plank goes badly over**, a red glow pulses in from the edges and a
flag rises on the low side. It means "you have made this worse", not "this is a
hard question": a level that *begins* lopsided is the puzzle, so the starting
gap is the mark, and the warning only appears past it. Nothing is lost and
nothing ends — it fades the moment the seesaw comes back.

Two things the painted art cannot do that the drawn art could:

- **Pull a face.** There is one expression per animal, so alarm is shown as a
  mark above the animal rather than in its eyes, and only the animal at the end
  of the side that is down gets one. Four marks is noise; one says trouble.
- **Arrive instantly.** Loading waits 250ms at most and then starts anyway, with
  the drawn animals standing in until the pictures land. A missing or slow file
  can never hold up a child, and `createVectorTheme()` remains a complete,
  working set of animals.

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
is a chicken rather than a rabbit. **And they move in character**: an animal
placed on the seesaw travels there under its own power, and each species has its
own gait — a chicken beats its wings in a high arc, a cat pours along low and
fast, a dog trots, a bear lumbers. On the plank they breathe. Each cry is described in the animal catalogue
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
