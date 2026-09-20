# Bramble Dash — design

The bundle's third game. A rabbit runs forward on its own, wearing a sum. Three
lanes of obstacles come at it, each wearing a number, and exactly one wears the
answer. Steer into that one and it bursts; steer into either other and you lose
a tenth of the tank.

Where Sky Patrol gives a child time to *work a sum out*, this one gives them
about three seconds and asks them to *know it*. Same facts, different demand:
one teaches, the other drills.

## The loop

The rabbit runs whether you do anything or not. Steering is the whole input.

| Event | Result |
| --- | --- |
| Burst through the right one | It explodes in leaves, score +1, the next sum is on the rabbit's head immediately |
| Thump a wrong one | The rabbit tumbles, **−10%**, a brief stumble, the row passes |
| Catch a berry | **+10%**, never past full |
| The tank empties | The run ends on a card: how far, how many, longest streak, best so far |

**Every row is a forced choice.** All three lanes are occupied, so the rabbit
always hits something. There is no coasting and no lane that is safe by default
— which is the difference between a maths game and a dodging game.

Ten misses to a run. A wrong answer costs a tenth of the tank rather than a life,
for the reason the bar exists at all: it drains where the player can watch it,
and a life blinking out of existence said nothing about why it went.

### Berries

A berry sits alone in one lane, between rows, and is worth 10%. It is free —
no arithmetic gates it.

Its job is the tension it creates: the berry is often in a different lane from
the next answer, so the player has to decide whether there is time for both.
That is the only moment in the game where steering is a choice rather than an
answer, and it is what stops the run from being a metronome.

**A berry never costs fuel to take.** It arrives no later than halfway through
the gap between rows, so there is always time to collect it and still reach any
lane before the next row lands. The choice it offers is whether to bother, never
whether to survive — a reward that could cost 10% is a trap wearing a berry's
face.

## The row

Three lanes. **Exactly one wears the answer.** Never two — two would be
ambiguous, and a child who noticed could stop reading.

The other two are drawn in the same order of preference Sky Patrol uses, and for
the same reason:

1. **An operand of the sum** — a `6` or a `9` when the rabbit wears `6 + 9`.
   Grabbing an operand instead of the answer is the characteristic error at this
   age, and it should be there to make.
2. **A near miss** — within two of the answer.
3. Anything else the band allows, if neither of those can be drawn.

Two obviously-wrong lanes would let a child pick by elimination without adding
anything. This is the same trap invariant as Sky Patrol, and it is the load-
bearing rule in both games.

Guessing is measurable here in a way it was not in Sky Patrol: three lanes means
random play is right one time in three and pays 10% on the other two, so a
guesser should be dead inside a minute. That makes the guard test sharper.

## The maths

The same three bands as Sky Patrol, by the clock:

| From | Band | Forms | Answers |
| --- | --- | --- | --- |
| 0:00 | Easy Sums | `a + b`, sum ≤ 10 | 2–10 |
| 0:45 | Over Ten | sums 11–20, easy ones still mixed in | 2–20 |
| 2:00 | Take-Aways | `a − b` within 20, addition still ~40% | 1–20 |

Two games on the same facts is deliberate. Sky Patrol is where a child works out
that 7 + 8 is 15; Bramble Dash is where that stops needing working out.

A band announces itself with the same banner grammar the other two games use.

## Pace and camera

**Top-down: the path scrolls toward the player.** Not a behind-the-shoulder
perspective view.

In a perspective runner an obstacle's number is smallest exactly when the player
most needs to read it, and biggest when it is too late to act. That would
quietly break the game — the arithmetic would lose to the eyesight. Scrolling
the path towards the camera keeps every number at full size from the moment it
appears.

| | Start | By ~3:00 |
| --- | --- | --- |
| Gap between rows | 3.5s | 1.8s |
| Berries | about every third gap | about every fifth |

The ramp is in **reading speed**, not reaction time: the rabbit's steering stays
as quick as it ever was, and what shrinks is how long the numbers are on screen.

## Controls

**Drag the rabbit.** A finger anywhere on the glass and the rabbit slides to
follow it, easing rather than teleporting, exactly as Sky Patrol's fighter does.
The lane it counts as being in is whichever third of the path it is over when a
row reaches it.

Forgiving on purpose: the player can change their mind until the last moment,
which matters when the answer arrives late. A child who has played Sky Patrol
already knows this control.

## Feel

- **The sum rides on a sign above the rabbit**, clear of its body — the lesson
  from Sky Patrol, where the fighter's own nose covered the operator.
- **A correct burst** scatters leaves and completes the sum in the air:
  `6 + 9 = 15`. That beat is the teaching.
- **A miss** tumbles the rabbit and the world slows for about 0.8s, with the sum
  that was missed written out. A runner cannot stop dead, but it can stumble,
  and the stumble is what ties the lost fuel to the question it was lost on.
- **The HUD** is the fuel bar top-left, score top-right, band banner centre —
  the same furniture as Sky Patrol.

## Structure

```
games/bramble/                  package @bundle/bramble, id 'bramble', "Bramble Dash"
  src/index.ts                  GameModule + __test hooks
  src/driver.ts                 rules <-> scene, sound, input
  src/logic/                    pure: no DOM, no timers, no audio
    tempo.ts                    how the gaps tighten with elapsed time
    lanes.ts                    three lanes, and which one a position is in
    row.ts                      one row: the answer lane and its two traps
    berries.ts                  when a berry comes and where
    run.ts                      the run: rows, fuel, score, band clock
  src/view/                     canvas: reads state, never writes it
    geometry.ts timing.ts art.ts hud.ts scene.ts input.ts
  src/audio/bramble-sounds.ts
```

### Shared with Sky Patrol

The three bands, the equation writing, and the trap-choosing rules are the same
in both games. They move into a new **`packages/math`** (`@bundle/math`) that
both import, rather than being copied:

- `bands.data.ts` — the three bands, their times and mixes
- `equation.ts` — `Sum`, `sumText`, `writeSum`, `drawAnswer`
- `traps.ts` — `isTrapFor`, `trapNumber`, the near-miss and operand rules

Sky Patrol keeps every one of its existing tests through the move, which is what
proves the move was faithful — the same arrangement as when the viewport, spring
and lettering went into core.

Registration touches the same four places as before: `tsconfig.json` paths,
`vitest.config.ts` alias, `apps/shell/vite.config.ts` alias, and the
`apps/shell/src/catalog.ts` tile, replacing **Sorting Station** — the
placeholder whose skill Seesaw Park already covers.

The shell's `openGame(id, { startLevel })` contract is unchanged; Bramble Dash
reads `startLevel` as a band id, so `?game=bramble&level=take-aways` opens
straight into subtraction.

## Testing

The logic layer is pure and seeded through core's `createRng`, so every rule
above becomes a test:

- every number in a row is one the live band allows
- **exactly one lane per row wears the answer** — never none, never two
- both other lanes are plausible: an operand or within two of the answer
- a wrong lane costs exactly 10% and a berry gives exactly 10%, never past full
- a berry always arrives with at least half the gap left, so taking it can never
  strand the rabbit in the wrong lane
- seeded ten-minute runs never deadlock and never produce a row without an answer

And the two that guard the design:

- **a bot that reads the sum** survives five minutes with a near-full tank;
- **a bot that picks a lane at random** drains the tank inside a minute, and so
  does one that simply stays in the middle.

If either guessing bot survives, the arithmetic has stopped mattering. Fix the
game, never the test.

## Deliberately not in the first build

- **Jumping or ducking.** A second axis of input would make this a dexterity
  game with sums attached. The lane is the answer; that is the whole input.
- **Perspective 3D.** See above: it costs readability exactly where the game
  needs it.
- **Real art and sound.** Vector rabbit, rocks, bears and berries, and a
  synthesised pack behind the same `SoundPack` names a recorded one would use.
