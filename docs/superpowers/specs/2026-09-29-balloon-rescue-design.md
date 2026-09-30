# Balloon Rescue — design

The bundle's fourth game. Someone small is stuck on the ground and a ledge waits
above them. Clip balloons to their harness until the lift is exactly their
weight, then let go. Too little and they strain and stay put; too much and they
whoosh past the ledge into the clouds; exactly right and they float up and step
off onto it.

Sky Patrol and Bramble Dash ask a child to *recall* an answer: `6 + 9` is on the
screen and 15 is somewhere to be found. Balloon Rescue turns that round and asks
them to *build* one: 8 is on the screen, and 5 + 3, 4 + 4 and 6 + 1 + 1 are all
theirs to find. Composing a number is the skill this game adds to the bundle.

For ages 6–8. Addition and comparison within 20, then taking away, then a
missing number sideways.

## The rescue

One rescue is one question. There is no clock.

| On "Let go!" | Result |
| --- | --- |
| Lift **less** than weight | The character strains upward, hops, settles back. A gauge shows `6 / 8` and says **"2 more!"** The balloons stay clipped on |
| Lift **exactly** weight | They float up and land on the ledge. The sum completes in the air — `5 + 3 = 8` — and they celebrate |
| Lift **more** than weight | They shoot past the ledge, bump a cloud, and drift back down under a little parachute to where they started. The gauge shows `11 / 8` and says **"3 too many!"** |

A wrong try is never a dead end: the bunch is left as it was, so the child
adjusts it rather than starting over.

**Stars reward working it out before letting go.** Right on the first try is
three stars, the second is two, anything later is one. A rescue is never
failed — it is only rescued more or less cleanly. The best stars per rescue are
kept in `host.storage`.

**No running total while building.** The character wears its weight on a tag;
the harness never shows the lift so far. A live total would turn the game into
watching a number climb to 8, which needs no adding at all. The total is shown
only after "Let go!", counted on balloon by balloon — *5… 8!* — and that count
is the teaching beat.

## Balloons

A balloon wears its number, **1 to 10**, and **its size grows with its number**:
a 1 is a small round balloon, a 10 a big one. Size is a loose hint and never
the answer — a 6 and a 7 are nearly the same size, so the number must be read.

There is no fixed set of values. Each rescue's tray holds whatever that rescue
needs; the 10-balloon exists so that "make ten, then a bit more" is available
once totals pass ten.

The **harness** has hooks. Usually there are enough for anything sensible (six);
in the Tiny Harness chapter and later there are two or three, drawn as empty
clips so the limit is seen rather than discovered.

## The chapters

Eight chapters, four or five rescues each, around 34 in all. Each introduces one
idea and then practises it, and announces itself with a chapter card as it
begins.

| # | Chapter | New idea | Targets | Example |
| --- | --- | --- | --- | --- |
| 1 | **First Flight** | Exact lift floats | 2–6 | weight 4, tray `3 · 6 · 1` → 3 + 1 |
| 2 | **Whoosh!** | Going over sends you flying | 5–10 | weight 7, tray `6 · 4 · 3 · 1` → 4 + 3 or 6 + 1; 6 + 4 is the bait |
| 3 | **Big Bunches** | Three balloons needed | 6–10 | weight 9, tray `4 · 4 · 6 · 1` → 4 + 4 + 1; no pair makes 9 |
| 4 | **Heavy Cargo** | Past ten, with a 10-balloon | 11–20 | weight 13, tray `10 · 8 · 3 · 2` → 10 + 3 or 8 + 3 + 2 |
| 5 | **Tiny Harness** | A hook limit forces a smart choice | 8–16 | weight 12, 2 hooks, tray `4 · 4 · 4 · 8 · 6 · 5` → 8 + 4; 4 + 4 + 4 is the bait |
| 6 | **Pop!** | Already tied to too much; take some away | 5–15 | weight 7, tied `6 · 3 · 1` → pop the 3 |
| 7 | **Windy Ridge** | Sideways: the wind gives some, puffs make the rest | 3–10 across | ledge `7 →`, wind `3 →`, puffs `5 · 4 · 2` → 4 |
| 8 | **The Big Rescue** | Two ideas in every rescue | mixed | weight 15, 2 hooks, wind blowing against |

Story lines are about the rescue, not the mechanic: *"Pip's kite pulled him
into the mud!"*, *"The ledge is where the picnic is."* No chapter title or story
line repeats one of Seesaw Park's.

### Pop!

The character starts already tied to a bunch that is too strong, held down by a
rope to a peg. Tapping a tied balloon pops it. A popped balloon hangs limp on
its hook, still showing its number, and tapping it again re-inflates it — so a
wrong pop can be taken back, and a child can never be left with a rescue that
cannot be finished. "Let go!" unties the rope.

The first rescue of the chapter has an empty tray, so popping is the only thing
to try.

### Windy Ridge

The ledge is no longer straight above: it is a number of steps to the side,
marked along the ground `1 2 3 … 7`. A wind sock shows the wind's own push,
`3 →` or `← 2`. A second tray holds **puffs** — little fans, worth 1 to 5 — that
push sideways.

- Needed sideways = ledge distance − wind, with the wind's direction counted:
  ledge `7 →` with wind `3 →` needs 4; ledge `5 →` with wind `← 2` needs 7.
- Too few puffs: they rise to ledge height and dangle short of it, "1 more
  puff!". Too many: they drift past it. Either way the parachute brings them back.
- Up is judged before across. If the lift is wrong, that is what the gauge says.

The chapter's first rescues come with the lift already right, so the only new
thing is the sideways number. Wind blowing *against* the ledge arrives last.

## Curriculum rules

Every one of these is a test over the level data, using a brute-force solver
that searches clips, pops and puffs:

- every rescue has at least one exact answer within its hook limit
- only the very first rescue can be answered by clipping a single balloon (the
  lift already clipped at the start of an early Windy Ridge rescue is given,
  not an answer)
- nothing before **Pop!** needs a pop; every rescue in **Pop!** needs one
- in **Big Bunches** no pair from the tray makes the weight
- in **Tiny Harness** the tray holds a correct bunch that needs too many hooks,
  and a correct bunch that fits
- in **Whoosh!** some pair from the tray overshoots by no more than 3 — the bait
- every rescue in **The Big Rescue** needs two of: past ten, a hook limit, a
  pop, wind
- the targets of each chapter lie in the range the table above gives it

## Screen

The design space is 1152×768 landscape, as the other three, with the scenery
painted past it.

- The character stands bottom-left on the ground, weight tag on its chest; the
  harness and its hooks float just above.
- The ledge is a grassy cliff top, straight above in most chapters and off to the
  right in Windy Ridge, reached along the step marks.
- The tray is a strip along the bottom; in Windy Ridge a second, smaller strip
  holds the puffs.
- "Let go!" is a large button bottom-right, dimmed until a balloon is clipped.
- The chapter card top-centre, the stars for this rescue top-right.

## Controls

**Tap a balloon in the tray and it floats up and clips to the next free hook.**
Tap a clipped balloon and it floats back to the tray. Dragging works too, but
tapping is the main path, because six-year-olds drag imprecisely — the same
lesson Seesaw learned.

Puffs work the same way on their own strip. A full harness bumps a balloon
back with a wobble and a soft "no room" sound.

## Feel

- **Just right** — they float up, step onto the ledge, and do a little dance
  while the sum completes above them. A bell and a cheer.
- **Too little** — a strain and a creak, a hop, the balloons tugging, and the
  gauge's "2 more!".
- **Too much** — a whoosh and a comic "wheee", a bump on a cloud, the parachute
  pops open, a slow drift down. It should be funny, never a telling-off.
- **The count** — after "Let go!", each balloon lights in turn as the gauge
  counts on, so the total is watched being made.

The look follows the concept art: warm, rounded, pastel; soft clouds, grassy
cliffs, fox kits as the characters. Vector-drawn first, behind a theme seam, so
painted art can replace it later exactly as it did in Seesaw.

## Structure

```
games/balloon/                  package @bundle/balloon, id 'balloon', "Balloon Rescue"
  src/index.ts                  GameModule + __test hooks
  src/driver.ts                 rules <-> scene, sound, input
  src/logic/                    pure: no DOM, no timers, no audio
    balloons.ts                 value → size; the value range
    rescue.ts                   one rescue's state: clipped, tied, popped, puffs, hooks
    outcome.ts                  lift vs weight, sideways vs distance → short / exact / over
    stars.ts                    tries → stars
    levels.data.ts              the chapters and their rescues
    solver.ts                   brute-force: every answer to a rescue
  src/view/                     canvas: reads state, never writes it
    geometry.ts timing.ts art.ts hud.ts scene.ts input.ts
  src/audio/balloon-sounds.ts
```

Registration touches the same four places the other games did: `tsconfig.json`
paths, `vitest.config.ts` alias, `apps/shell/vite.config.ts` alias, and a tile in
`apps/shell/src/catalog.ts` replacing a placeholder, so the bundle stays ten
games.

The shell's `openGame(id, { startLevel })` contract is unchanged; Balloon Rescue
reads `startLevel` as a rescue id, so `?game=balloon&level=pop-1` opens straight
into the Pop! chapter.

Nothing from `@bundle/math` is needed: the values here are authored, not drawn
from bands. The viewport, spring, lettering and HUD furniture come from core.

## Testing

The logic is pure, so the rules become tests:

- the curriculum rules above, over every rescue in the data
- outcome is short / exact / over by exactly the sign of lift − weight, and the
  gauge's "N more" / "N too many" is that difference
- in wind, up is judged before across, and the wind's direction is counted
- a full harness refuses a clip; a popped balloon can be re-inflated; a failed
  try leaves the bunch exactly as it was
- stars: first try 3, second 2, later 1, and the stored best never goes down
- each chapter's rescues driven to completion through the real module in jsdom,
  and unmount leaves no listeners, timers or audio behind

And the ones that guard the design:

- **a bot that clips the biggest balloons until it has enough** is right on its
  first try in fewer than a quarter of the rescues after the first chapter;
- **a bot that clips at random and lets go** averages under two stars;
- **a bot that works the sum out** gets three stars on every rescue.

If a size-only bot does well, the arithmetic has stopped mattering. Fix the
levels, never the test.

## Deliberately not in the first build

- **A timed or endless mode.** Composing a number needs thinking time; a clock
  pushes towards grabbing the big one and hoping. A generated free-play mode can
  come later, reusing the solver to guarantee each rescue.
- **Live steering in the wind.** Fighting gusts with a finger is dexterity, not
  arithmetic.
- **Painted art and recorded sound.** Vector fox kits and a synthesised pack,
  behind the same seams Seesaw used for its later painted animals.
