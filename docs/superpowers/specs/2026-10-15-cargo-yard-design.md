# Cargo Yard — design

The bundle's seventh game. Crates come out of the port, each wearing its
weight, and wait in a queue along the yard floor. Three trains wait on three
tracks, each wanting an exact load. Drag crates onto trains: exactly right and
the train steams off, too heavy and it breaks. Crates arrive faster and faster;
the run ends when the queue reaches the overflow line.

Bucket Bay asks a child to make one total exactly. Cargo Yard asks for three at
once, under a rising tempo, so the arithmetic becomes a choice: *"this 4 fits
the 9-train's gap of 4, not the 12-train's gap of 6."* Missing addend, three
ways, with a reason to be quick and a reason to be careful.

For ages 6–8. No levels: one continuous run that tightens with time, like Sky
Patrol, ending on a "how far did you get" card.

## The yard

Laid out as the asset sheet's main scene (`Colorful Train Cargo Game Asset
Sheet.png`, moved to `games/train/assets/source/board.png`):

- The **port** and its crane on the left. Crates come out of it.
- **Three tracks** across the middle, red on top, blue in the middle, green at
  the bottom. Trains roll in from the left and leave to the right, towards the
  sea. Colour is only which track; it says nothing about the target.
- At each track's right end, a **sign** with the load and the target (`7 / 12`)
  and the sheet's train-progress bar under it.
- The **queue** along the front floor, left to right from the port, towards a
  marker at the right end of the dashed **overflow line**.

## The loop

Crates come out of the port one at a time and join the end of the queue.
**Every crate fits at least one waiting train's gap at the moment it arrives**:
a crate is never a trap when it appears, though it can stop fitting once other
crates have been loaded.

Drag any crate in the queue — not only the first — onto a train. The gap in the
queue closes up behind it.

| Dropped | Result |
| --- | --- |
| On a train, load still **under** its target | The crate goes into the wagon; the sign and bar go up |
| On a train, load **exactly** its target | Tick, "Train ready!", a whistle, the train steams off right. A new train with a new target rolls in from the left |
| On a train, load **over** its target | "Too heavy!", the train breaks: smoke, the broken-track piece, and its crates are lost. Workers come and fix it while a repairing bar fills. When they are done, a fresh train rolls in |
| Anywhere else, or on a broken track | The crate slides back to its place in the queue. No cost |

While a crate is held over a train, that train's sign previews the drop —
`7 + 3 = 10` — green if exact, white if still under, red if over. The child
still decides to let go.

**The run ends when the queue reaches the marker** (it holds about 12 crates).
The summary card shows trains sent, time survived, and the best run so far,
kept in `host.storage`.

## Numbers

Three bands by elapsed time, each announced by a banner that arrives large and
settles, as in Sky Patrol:

| From | Band (id) | Train targets | Crates |
| --- | --- | --- | --- |
| 0:00 | Little Loads (`little`) | 5–10 | 1–5 |
| 1:00 | Bigger Loads (`bigger`) | 5–15 | 1–7 |
| 2:00 | Heavy Loads (`heavy`) | 5–20 | 1–9 |

- A new train takes any target in the current band, whatever its colour. The
  three waiting trains never share a target, so "which train?" always has a
  real answer.
- A crate's weight is chosen from the band's crate range among those that fit
  some waiting train's gap. If no gap is within the crate range (every gap is
  bigger than the biggest crate), it is any crate in range, since it still fits.
  A band change never rewrites a waiting train's target.
- The first train of a run is always reachable with the first two crates.

## Pace

- A crate every **2 seconds** at the start.
- Every **15 seconds**, crates come **10% faster** (the gap is divided by 1.1).
- The gap levels off at **0.75 seconds**, reached after about 2:35.
- "Speed up!" flashes, with the sheet's lightning bolt, on each step.
- Pace is a function of elapsed time only: skill shows in how long the run
  lasts, not in the difficulty.

A broken train is out for **5 seconds** of repair, then **1.5 seconds** for the
fresh train to roll in. A sent train's replacement takes the same 1.5 seconds.

## The star train

From 0:30, about one train in eight rolls in as a **star train**, never two at
once. It wears the sheet's star on its wagon and its sign.

- It arrives with a horn; its sign pulses gold, it judders impatiently, and a
  little stopwatch above its sign counts down **5 seconds**, ticking each second
  and turning red for the last two.
- Its target is always a sum of two or three crates already in the queue, so a
  child who spots them can make it in time.
- **Filled exactly in time**: "Bonus!", the star bursts, the train steams off,
  and **the half of the queue nearest the line pops away** in stars (rounding
  down: 7 crates leave 4). The queue slides back from the danger line.
- **Not in time**: the star fades and it is an ordinary train with the same
  target. Nothing else is lost.
- Too heavy breaks it like any other train.

## Feel

- **Danger**: as the queue nears the marker, the overflow line's warning light
  blinks and the last slots tint amber, then red, so the end is seen coming.
- **Top bar**: the clock counting up the time survived, trains sent in the
  sheet's crate badge, and the pause button.
- **Coach**: in the first seconds of a run, the line along the bottom says
  "Drag a crate onto a train", until the first crate is loaded.
- **Sound**, synthesised: a thunk as a crate lands in a wagon, the whistle, the
  crunch of a break, hammering while the crew works, the star train's horn and
  ticks, a rising tick as the queue nears the line.
- **Art**: everything comes from the sheet — the backdrop with its sea,
  lighthouse, boat and seagull; three trains in their normal, broken and
  leaving states; ten cargo pieces wearing 1 to 10; four workers; the broken
  track; the HUD pieces and the effect icons ("Train ready!", "Too heavy!",
  "Broken!", "Bonus!", "Speed up!").

## Structure

```
games/train/                    package @bundle/train, module id 'train', "Cargo Yard"
  assets/                       sprites cut from the sheet
  assets/source/board.png       the sheet itself
  src/index.ts                  GameModule + __test hooks
  src/driver.ts                 run <-> scene, sound, input
  src/intent.ts                 load {crate, track}, pause, next
  src/logic/                    pure: no DOM, no timers, no audio
    tempo.ts                    the pace and the bands, by elapsed time
    choose.ts                   targets for new trains, weights for new crates, star targets
    run.ts                      the run: queue, three tracks, repairs, star timer, the end
    bot.ts                      players for the tests
  src/view/
    geometry.ts timing.ts art.ts hud.ts scene.ts input.ts sprites.ts
  src/audio/train-sounds.ts
scripts/cut-train.py            cuts the sheet (numpy and Pillow)
```

Registration touches the same places as before: `tsconfig.json` paths,
`vitest.config.ts` alias, `apps/shell/vite.config.ts` alias, and a tile in
`apps/shell/src/catalog.ts` — "Cargo Yard", "Load the trains exactly" —
replacing a placeholder. `?game=train&level=heavy` opens a run straight into a
band, for testing.

## Testing

The logic is pure and seeded through core's `createRng`:

- every crate fits some waiting train's gap when it arrives
- the three waiting trains never share a target, and every target is in band
- a star train's target can always be made from two or three queued crates
- the pace follows the schedule: 2s, 10% faster every 15s, never under 0.75s
- loading exactly sends a train; over breaks it for the repair time; the run
  ends when the queue reaches the marker; a bonus clears the right half
- **bot guards**, over many seeds:
  - a careful bot loading at a child's pace (a crate every ~1.2s, always into a
    train it fits) survives at least 2 minutes
  - a bot that does nothing loses in under 30 seconds
  - a bot that loads at random breaks trains often and loses much sooner than
    the careful one
