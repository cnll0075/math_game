# Sky Patrol — design

The bundle's second game. A plane shooter in which the only plane you may shoot
is the one wearing the answer to the sum on your fighter. Addition and
subtraction within 20; one continuous run; three hearts.

The whole design answers one question: **can a child win this without reading a
number?** Seesaw Park's arcade half was built and cut because the answer there
was yes — a player could drop each animal on the lighter side and never do
arithmetic. Everything below that looks like a constraint is there to keep the
answer here no.

## The loop

One sum is live at a time, painted large on the fighter's fuselage. Planes fall
from the top wearing numbers.

| Event | Result |
| --- | --- |
| Correct plane destroyed | It explodes, the equation completes in the air (`7 + 8 = 15`), score +1, streak +1, a new sum is chosen |
| The live sum's plane escapes off the bottom | **Heart lost**, streak resets, a new sum is chosen immediately |
| Wrong plane hit | Shell bounces, gun overheats ~0.9s, sum unchanged, streak resets, the target keeps falling |
| Any other plane leaves the screen | Nothing. It was never the player's business |
| A shot that hits nothing | Nothing. Firing is free |

A sum, once live, stays live until its plane is destroyed or escapes: a band
change never rewrites the question in front of the player. A blimp's damage
persists across shots, so two hits and a pause still leave it needing only one
more.

Hearts are spent only on escapes. A wrong shot costs **time** — the one currency
that matters more as the sky speeds up — so a misread number is punished without
a slipped thumb ever ending a run. Three hearts for the entire run.

The run ends on a summary: planes downed, longest streak, time flown, and the
best run so far, kept in `host.storage`. A "how far did you fly" card, not a
failure screen.

## Coupling the sum to the sky

**The sky comes first; the sum is written about it.** Planes spawn continuously
wearing numbers drawn from the current band's answer set. When a new sum is
needed, the game looks at what is already flying, picks an eligible plane, and
writes an equation whose answer is that plane's number.

Three properties fall out of this, and each is a test:

- **Every plane is shootable by construction.** A plane's number came from the
  band's answer set, so a sum producing it always exists. Targeting prefers the
  oldest eligible plane, so planes are asked about before they leave.
- **Urgency is emergent.** The sum asks about a plane already well into its
  fall, so the pressure is the sky itself rather than an imposed timer.
- **No positional tell.** The target sits at a different height and place every
  time, so "shoot the newest" or "shoot the lowest" never works.

The reverse arrangement — write the sum, then spawn its answer — was rejected:
the answer plane would always be the newest and highest, a tell a child learns
in under a minute, and the arithmetic would stop mattering. It survives only as
a safety net: **if no plane aloft is eligible, one is spawned directly into the
fair window**, so the game can never ask a question it has not also made
answerable.

### The fair window

A plane may only be chosen as the target if it has at least `thinkSeconds` of
fall remaining: 5.5s in the opening band, easing to 3s late in a run. The player
is always given time to compute. What a rising tempo shrinks is the margin for
error — never the thinking time. That distinction is the difference between an
arithmetic game and a reflex test.

### The trap invariant

While a sum is live the sky must also hold a **trap**: a plane wearing one of
the sum's operands, or a number within ±2 of its answer. The spawner injects one
if chance has not provided it.

Two deliberate baits:

- **Operands fly.** Writing a sum for a plane wearing 15, the generator prefers
  operands already in the sky — if a `7` is up there, the sum is `7 + 8`.
  Shooting an operand instead of the sum is the characteristic error at this age,
  so it is baited on purpose rather than left to chance.
- **A near miss is always present.** `14`, `15` and `16` aloft together means the
  answer must be computed, never scanned for as the only plausible number.

From band 2, **escort pairs** spawn: two planes side by side wearing adjacent
numbers. Free, natural traps.

## The maths, progressive by time

| From | Band | Forms | Answers |
| --- | --- | --- | --- |
| 0:00 | `easy` — Easy Sums | `a + b`, sum ≤ 10, both operands ≥ 1 | 2–10 |
| 0:45 | `over-ten` — Over Ten | sums 11–20, easy sums still mixed in (~30%) | 2–20 |
| 2:00 | `take-aways` — Take-Aways | `a − b` within 20, `b ≤ a`, answer ≥ 1; addition remains ~40% | 1–20 |

Addition persists into the subtraction band so that the **sign** is something
worth reading rather than a constant to ignore.

A band announces itself the way a Seesaw section does: a banner arrives large in
the middle, holds, and flies up into the top bar, so a change in the rules is
seen arriving rather than discovered.

Plane numbers are always drawn from the live band's answer set. Answers never
exceed 20, so no plane can wear a number no sum could produce.

## The sky

| Type | From | Behaviour |
| --- | --- | --- |
| **Glider** | 0:00 | Straight down, steady. The default |
| **Weaver** | ~0:30 | Falls in an S. The number is plain; lining up is the work. Delays a child who knows the answer, never punishes them |
| **Blimp** | ~0:50 | 0.55× speed, large readable number, **three hits**. Rewards committing to an answer — you cannot dab at it and change your mind. Also a breather |
| **Scout** | ~1:15 | 1.8× fall speed. The type that genuinely threatens a heart; the fair window still applies, so a scout you are asked about is always winnable |
| **Cloud-hider** | ~1:50 | Ducks behind cloud, its number gone ~1.2s at a time, so the player must remember *which* plane was the 15. Never hidden at the instant a sum is chosen; it hides afterwards |

Each type is a different *reason* to be hard — thumbs, time, commitment, memory
— so the ramp is never merely "faster".

## Tempo

The design space is 1152×768 landscape, as Seesaw's.

| | Start | By ~3:00 |
| --- | --- | --- |
| Fall time, top to bottom | 13s | 5.5s (floor 5s) |
| Planes aloft | 4 | 7 |
| Fair window (`thinkSeconds`) | 5.5s | 3s |

Tempo is a function of elapsed time, so a run tightens whether the player is
doing well or badly. Skill shows up in the score, not in the difficulty.

## Controls

**Drag to move, fire on release.** A touch anywhere eases the fighter toward the
finger's x; dragging tracks it; lifting fires one shell. Aim, then let go.

One shot per touch, and repositioning firing a shell is harmless because a shot
that hits nothing costs nothing. Three quick taps bring down a blimp. Arrow keys
and space do the same on a desktop, for testing on the Mac.

Firing on touch-down was rejected: every reposition would spray shots.

## Feel

- **Correct kill** — explosion, and the equation completes in the air
  (`7 + 8 = 15`) for a beat. That beat is the actual teaching: the child's
  confirmation that they were right. Ka-ching, streak chevron advances.
- **Jam** — the barrel glows red, sparks, a cough, ~0.9s of nothing.
- **Escape** — the plane dips off the bottom trailing smoke as a heart cracks,
  under a low horn.
- **HUD** — hearts top-left, score top-right, band banner centre.

## Structure

```
games/sky/                      package @bundle/sky, module id 'sky', "Sky Patrol"
  src/index.ts                  GameModule + __test hooks
  src/driver.ts                 rules <-> scene, sound, input
  src/logic/                    pure: no DOM, no timers, no audio
    tempo.ts                    how the sky tightens with elapsed time
    bands.data.ts               the three bands, their times and mixes
    equation.ts                 sum generation over a band, answer sets
    planes.ts                   plane-type catalog: speed, hits, behaviour
    sky-state.ts                one plane falling: position, damage, hiding
    spawner.ts                  number choice and the trap invariant
    targeting.ts                choosing the plane a sum asks about
    run.ts                      the run: planes, shells, hearts, band clock
  src/view/                     canvas: reads state, never writes it
    geometry.ts timing.ts plane-art.ts hud.ts scene.ts input.ts
  src/audio/sky-sounds.ts       the sky's sound pack
```

Registration touches exactly the four places Seesaw touches:
`tsconfig.json` paths, `vitest.config.ts` alias, `apps/shell/vite.config.ts`
alias, and the `apps/shell/src/catalog.ts` tile (replacing a placeholder, so the
bundle stays ten games).

The shell's `openGame(id, { startLevel })` contract is unchanged; Sky Patrol
reads `startLevel` as a **band id**, so `?game=sky&level=take-aways` opens
straight into subtraction for testing.

## Testing

The logic layer is pure and seeded through core's `createRng`, so the invariants
above become tests rather than intentions:

- every plane's number lies in its band's answer set
- a live sum always has at least one plane aloft wearing its answer
- a chosen target always has its full fair window remaining
- the trap invariant holds whenever a sum is live
- a wrong hit never costs a heart; an escape of the target costs exactly one
- a blimp takes three hits and no fewer
- seeded ten-minute simulated runs never deadlock and never reach a state with
  no answerable sum

And the one that guards the Seesaw lesson directly:

- **a bot that always shoots the lowest plane loses all three hearts within
  ninety seconds.** If that test ever passes the game, the arithmetic has
  stopped mattering and the design has regressed.

The viewport maths, the spring, the lettering and the canvas test helpers move
out of `games/seesaw/src/view/` into `packages/core` first, since both games need
them verbatim and two copies of the game's lettering would let the two drift
apart.

There is **no theme interface**: with no art assets for this game, a seam with one
implementation would be a seam for its own sake, so the vector art is one file and
swapping it later is a change to that file.

## Deliberately not in the first build

- **Real art and sound.** Vector planes and a synthesised pack, behind the same
  `SoundPack` names a recorded pack would implement.
- **Enemy fire to dodge.** A heart lost to dodging is a heart lost to something
  other than arithmetic — the exact failure Seesaw's arcade half was cut for.
- **Missing-number sums** (`7 + ? = 15`). A fourth form to read; the plane types
  and tightening decoys carry the late ramp without it.
- **Levels.** One endless run, as this is the arcade counterpart to Seesaw's
  32 questions.
