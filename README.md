# Math Park

A bundle of ten little math games for iPad. Two are built, and in both the
arithmetic is the mechanic rather than the subject:

- **Seesaw Park** — animal weights drive a seesaw, and making it balance is
  addition you can see.
- **Sky Patrol** — the only plane you may shoot is the one wearing the answer to
  the sum on your fighter. One endless run on a tank of fuel.

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

Development shortcuts: `?game=seesaw&level=level-4` opens a level directly, and
`?game=sky&level=take-aways` opens Sky Patrol straight into subtraction.

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

**Getting the address onto the iPad.** Open `/ipad.html` on the Mac at the
Network address Vite printed — it shows a QR code for whatever host it was
reached on, and the iPad camera opens it in Safari. Typing a `192.168.x.x`
address by hand goes wrong more often than not, and a link tapped inside another
app is refused outright ("the URL can't be shown") unless that app holds iOS
Local Network permission.

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
games/sky/       the second game, laid out the same way
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

## Sound

The animals are recordings, cut from stock clips by `scripts/cut-cries.py` and
shipped as mono AAC at about 10KB each. Everything else - the bell, the creak,
the landing thud, the cheer - is still synthesised on the fly, so the whole
bundle carries about 45KB of audio rather than a sound library.

Both go through the same `SoundPack` seam: a game asks for an event by name and
never learns whether the answer was a recording or a synthesiser.
`createSampleSoundPack` in `@bundle/core` plays the recordings and hands
everything else to the synthesised pack underneath - which also covers the
animals until the files have loaded, or if they never do, so the game is
playable from the first frame on any connection.

One wrinkle worth knowing: a browser will not start an audio context until the
user asks for sound, and preloading happens long before the first tap. The pack
decodes through an offline context, which can be built at any time, and the
audio it produces plays through the real context later.

## Lettering

Everything is written in Chalkboard SE, a rounded hand-drawn face that ships
with iOS and macOS, so the game reads as drawn rather than typed without a font
file to download or fetch. The stack lives in
`games/seesaw/src/view/type.ts` and, for the launcher, in the `--hand` custom
property in `apps/shell/src/shell.css`; the two are kept in step.

Weights are written as coloured numbers rather than counters in a circle, and
each weight keeps its colour everywhere it appears - on the plank, in the tray,
in a pen - so a child who cannot yet read the numeral can still tell one amount
of animal from another.

Each arm hangs its running total under it. Nothing else on screen says that the
number on an animal is how heavy it is rather than a name or a count; a total
that changes as animals arrive, and matches when the plank goes flat, says it
without being read. The two opening questions add a ghost of the flag a level
plank flies, in the place the real one pops up, so the goal is the thing the
child will earn rather than a symbol to interpret.

## The artwork

Everything on screen is cut from two paintings in
`games/seesaw/assets/source/`, by `scripts/cut-seesaw.py` and
`scripts/extract-animals.py`. Neither painting is edited by hand, so a better
one can replace it and be recut with one command.

The park painting has its own seesaw in it, standing level. The game needs one
that tilts, so the plank and its two trays are lifted out as sprites and the
hole they leave is repaired; the post stays where it is, because the painting
has it in front of the plank and a taller cut of it covers the plank's middle
where the two meet. Each tray is cut in two - back rim and near wall - and the
animals are drawn between them, which is what makes them ride in the basket
rather than balance on its rim.

One number decides the size of everything: `PARK_SCALE` in
`games/seesaw/src/view/geometry.ts`, set by the furthest corner of the longer
tray having to stay on screen. Every other measurement in the scene is derived
from the painting through it, and `view/layout.test.ts` walks the real geometry
against the real artwork so a nudge to one number cannot quietly push a basket,
or a bear, off the edge.

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

## The design space

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

## Sky Patrol

Planes fall out of the sky wearing numbers. Your fighter carries a sum. Shoot
the plane wearing its answer.

**Drag to move, fire on release.** One shell per touch: lifting your finger
sends the fighter to that spot and shoots from there. Firing on touch-down
would spray a shell every time you repositioned, and repositioning is most of
what a player does. Arrow keys and space do the same on a Mac.

**One tank of fuel for the whole run.** Every plane your sum was asking for that
gets away off the bottom costs **5%** — twenty of them and the run is over. A
gold plane gives **20%** back. Shooting the wrong plane costs no fuel at all —
the plane shrugs the shell off and your gun overheats — so a slipped thumb never
ends a run.

A bar rather than a row of lives on purpose: it drains where you can watch it,
and the notches show what one miss costs before you pay it. A life blinking out
of existence said nothing about why. But each wrong shell in a row holds the gun shut longer, to a
ceiling of three seconds, and a shell home on the right plane cools it
completely. One slip is cheap; a habit is not.

Shells stop at the first plane in their path, so something flying between you
and the right answer really does block the shot. Wait, or move.

**Nothing marks the plane you are after** — marking it would hand over the
answer and leave no arithmetic in the game. So the urgency is carried by the
plaque instead: it warms towards red as the plane being asked about runs out of
sky. That says *hurry* without saying *which*. And when one does get away it is
ringed in red where it left, with the sum you missed written out beside it —
after the fact, so it cannot be used to skip the thinking. A heart should never
vanish without the player seeing why.

### The three bands, by the clock

| From | Band | Sums | Numbers in the sky |
| --- | --- | --- | --- |
| 0:00 | Easy Sums | `a + b` up to ten | 2–10 |
| 0:45 | Over Ten | sums of 11–20, easy ones still mixed in | 2–20 |
| 2:00 | Take-Aways | take-aways within 20, addition still ~40% | 1–20 |

Addition keeps appearing in the last band so that the **sign** is something
worth reading rather than a constant to ignore. A band announces itself the way
a Seesaw chapter does.

### The planes

Each type is a different *reason* to be hard, so the ramp is never merely
"faster":

| Plane | From | What makes it hard |
| --- | --- | --- |
| Glider | 0:00 | Nothing. The plane the others are measured against |
| Weaver | 0:30 | Falls in an S — the number is plain, lining up is the work |
| Blimp | 0:50 | Slow and big, and **bursts into two planes whose numbers add up to the one it wore**. Shooting the 15 leaves a 9 and a 6 in the sky |
| Treasure | 1:00 | Rare, golden, and wearing a heart. Shoot it when the sum asks for it and you get 20% of the tank back. The badge is outlined rather than filled when the tank is already full, so it never promises twice |
| Scout | 1:15 | Falls nearly twice as fast. The one that threatens a heart |
| Cloud-hider | 1:50 | Ducks behind cloud, so you must remember *which* plane was the 15 |

### Why the sum is written about planes already flying

This is the part to leave alone. **The sky comes first; the sum is written about
it.** When a new question is needed the game looks at what is already in the
air, picks a plane, and writes a sum whose answer is its number.

The reverse — pick a sum, then spawn a plane wearing its answer — was rejected,
because the answer would always be the newest and highest plane, and a child
learns that tell in under a minute and stops reading numbers. That is exactly
how Seesaw's arcade half failed, and it is why it was cut.

Two guarantees come out of the arrangement, and both are tests:

- **Every plane is shootable.** Its number was drawn from the band's answer set,
  so a sum that produces it always exists.
- **The question is always fair.** A plane may only be asked about while it has
  a full *thinking window* of fall left — 5.5s early, 3s late. A rising tempo
  shrinks your margin for error, never your time to think.

And one deliberate cruelty, the **trap invariant**: while a sum is live the sky
must also hold an operand of it or a near miss. Asked `7 + 8`, there is usually
a `7` up there to shoot by mistake, and a `14` or `16` besides. Shooting an
operand instead of the answer is the characteristic error at this age, so it is
baited on purpose — otherwise the answer can be picked out as the only plausible
number on screen, without doing any arithmetic. If chance has not provided a
trap, the spawner sends one up, and sends another when the last one gets away.

### The test that guards all of it

`games/sky/src/logic/invariants.test.ts` flies two bots at the game:

- one **reads the sum**, and must still be flying after five minutes with a
  near-full tank;
- one **ignores the numbers** and shoots whatever is lowest, and must run the
  tank dry — it takes four to six minutes, because a miss costs 5% rather than a
  whole life, but it always happens.

If that second test ever passes the game, the arithmetic has stopped mattering.
Fix the game, never the test.

## Not built yet

- **Real art and sound.** Seesaw's are swappable through `SeesawTheme` and
  `SoundPack`; see above. Sky Patrol has vector planes and a synthesised pack
  only, behind the same `SoundPack` names a recorded pack would implement.
- **The other eight games.** The shell has a tile each, marked "Soon".
- **Timed or scored modes.** An arcade half was built and removed: it added
  pressure rather than arithmetic, and a player could win it by dropping each
  animal on the lighter side without reading a number. It is in the git history
  if it is ever wanted.
