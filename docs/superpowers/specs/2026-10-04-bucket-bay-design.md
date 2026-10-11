# Bucket Bay — design

The bundle's sixth game. A fisherman in a little boat has a bucket that holds
exactly so much. Catch fish until the bucket is **exactly** full before the
clock runs out. One fish too heavy and the boat tips over.

Balloon Rescue asks a child to build a number with no clock. Bucket Bay asks the
same thing under a gentle hurry, and the hurry is what makes the arithmetic
interesting: ten little fish are slow, so it pays to land the big ones first and
then work out exactly what is still missing — *"7 in the bucket, it holds 10,
so I need a 3."* Missing addend, under a clock, with a reason to plan.

For ages 6–8. Totals up to 25.

## Playing

- **Tap the water** and the boat sails there. The hook hangs from the rod tip,
  and the rod tip goes exactly where the finger went, so "tap above the fish" is
  all there is to aiming. The boat always faces right, with the rod out over
  the bow. To reach towards the left edge, half the hull slides off the screen,
  and the bucket's count stays pinned on screen while it does.
- **Tap the hook button** (bottom right), or the boat itself, to drop the hook.
  A finger held on the water and slid steers the boat.
  It falls straight down and grabs the **first thing it touches**, the way the
  claw does in Gold Miner. A fish in the way is a fish you catch.
- The fish keep swimming the whole time, each at its own speed — a big fish is
  not always slow, a small one not always quick. A child aims where the fish
  *will be*.
- The hook comes up with whatever it caught. **Heavier is slower**: a 1 comes
  up quickly, a 10 crawls, and the boat leans towards the line while it does.
- A fish that lands goes into the bucket and the total goes up. Arrow keys and
  space do the same on a Mac.

| When a catch lands | Result |
| --- | --- |
| Total **below** the bucket | Keep fishing |
| Total **exactly** the bucket | Level done, the sum is written out — `5 + 3 + 2 = 10` |
| Total **over** the bucket | The boat tips over, with the sum shown — `8 + 5 = 13, more than 10!` — and the level starts again |
| The clock reaches zero | "Out of time!" and the level starts again |

Starting again is quick and gentle — a tap, or by itself after a few seconds —
and the pond is dealt fresh. There is no other way to fail.

**Stars come from time left**: a third of the clock or more is three stars, a
sixth or more is two, anything else is one. Catching fewer, bigger fish is how
three stars are earned.

## Fish

The fish, their weights and every picture come from the asset board in
`games/fishing/assets/source/board.png`, cut by `scripts/cut-fishing.py`. Each
species has one weight and wears it on its side, in a white disc ringed in that
weight's colour. Bigger weight, bigger fish: size is a hint, but the number
must be read.

| Weight | Fish | How it moves |
| --- | --- | --- |
| 1 | Clownfish | swims |
| 2 | Blue Fish | swims, quick |
| 3 | Yellow Fish | swims |
| 4 | Crab | walks the sand |
| 5 | Tuna | swims, quick |
| 6 | Ray | swims, deep |
| 7 | Swordfish | swims, fastest of all |
| 8 | Angler | swims, deepest |
| 9 | Pufferfish | swims, slow |
| 10 | Jellyfish | drifts and pulses, slowest |

Speed is the species' own and not tied to weight. A caught fish is replaced by
another of its kind from the edge a moment later, so a level's mix never runs
out. If a catch leaves a gap nothing in the bay can make — 1 left and no 1s —
the level says so at once ("Nothing here weighs 1!") and starts again, rather
than leaving a child to wait out the clock.

## Things in the water

Items weigh nothing in the bucket. They are reeled up like a catch.

| Item | What it does |
| --- | --- |
| **Speed Potion** | Every catch for the rest of the level reels twice as fast |
| **Health Potion** | Kept, and shown under the bucket. The next fish that would tip the boat jumps back into the sea instead |
| **Net** | The hook catches from further away for the rest of the level |
| **Bonus Time** | Ten more seconds |
| **Treasure** | Sits on the sand. Weighs nothing, and is heavy to wind up: shiny, and a waste of time, like the rocks in Gold Miner |

## The screen

The water takes most of the screen, so the fish have room. Above it is the
painted lake from the board, with its own boy and boat painted out. The boy
sits **in** the boat — the hull is cut in two, and he and the bucket are drawn
between it and its near wall — with the bucket at the stern beside him. The
count is written big on the bucket's side (`7/10`), a fill rises up it, and the
catch pokes heads-up out of its mouth. A caught fish flies from the line into
the bucket and is only counted when it lands. The stopwatch is top right, with
a wedge of time that drains, green to amber to red, and ticks out loud for the
last five seconds. The level's line runs along the sand at the bottom, the one
strip the boat never crosses. The hook button is bottom right, under the thumb.

**The physics a child can feel**: a 1 winds up in about a second; each step
heavier is the same share slower, so a 10 takes six times as long. Weight on
the line leans the boat towards it
and pulls the line taut, a heavy catch wriggles slower and wider, the reel
clicks lower and further apart, and a fuller bucket sits the boat lower in the
water and sails it more slowly. Going over, the boat rolls, the fisherman ends
up in the water, and every fish in the bucket leaps back into the sea.

## Levels

Thirteen, each bringing in at most one new fish and one new item. The first
three write "3 more!" under the bucket; after that the child works out the gap.
The first level coaches the two verbs in the line under the title, and rings
the hook button once the boat has moved.

| # | Title | Bucket | Fish | New |
| --- | --- | --- | --- | --- |
| 1 | First Catch | 3 | 1, 2 | tap to sail, tap to fish |
| 2 | Just Right | 6 | 1, 2, 3 | |
| 3 | Big Ones Are Quick | 10 | 1, 2, 5 | bigger fills faster |
| 4 | Speed Potion | 12 | 1, 3, 6 | speed potion |
| 5 | No Little Ones | 9 | 2, 3, 5 | no 1s to fix a mistake; bonus time |
| 6 | Crab Walk | 14 | 1, 4, 6 | crabs; treasure |
| 7 | Life Saver | 10 | 2, 4, 6, 8 | health potion |
| 8 | Puffer Party | 15 | 3, 4, 9 | |
| 9 | Swordfish! | 14 | 1, 2, 7 | net |
| 10 | Half Full | 16, 8 already in | 2, 3, 5, 6 | a bucket that starts part full |
| 11 | Jellyfish | 20 | 1, 2, 10 | |
| 12 | Busy Sea | 18 | 1, 3, 4, 6, 8 | everything at once |
| 13 | Big Haul | 25 | 1, 2, 5, 7, 9, 10 | the big one |

The clocks are 25 to 50 seconds. Each is about one and a half times what a
child who plans well would take — reckoned as the bot's time plus a few seconds
of thinking and aiming per catch — so the clock is felt without being cruel.

## Structure

Laid out like the other games. `src/logic/` holds the whole simulation — boat,
hook, fish, items, bucket, clock — as pure state stepped by `dt`, with no DOM,
so a bot can play every level in a test. `src/view/` draws it and never writes
to it. The boat's lean, the rod's bend and the bob of the water are springs in
the view only.

## The test that guards it

`logic/guards.test.ts` plays every level with a bot over twelve ponds. A bot
that lands the biggest fish that still fits (and never one that leaves a gap
nothing can fill) must fill at least ten of twelve, using on average under a
third of the clock: a child is far slower than a bot, and the rest of the clock
is theirs. A bot that only ever lands the smallest must need well over one and
a half times as many catches, so big fish really are the quick way.
`logic/levels.test.ts` checks that every bucket can be made from what swims,
and that new fish and items arrive one at a time.
