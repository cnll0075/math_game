# Pond Pairs — design

The bundle's fifth game. A pond full of lily pads, face down. Tap one and it
flips to show a sum; tap another. If the two are **equal** — `3 + 4` and
`9 − 2` — they stay up and bloom. If not, they flip back. Clear the pond.

It is the memory game every child knows, with one change: pictures are
replaced by sums, and *matching* means *being the same amount*. That is the
idea this game adds to the bundle. Children of six to eight often read `=` as
"the answer comes next"; here two sums that look nothing alike belong
together because they are worth the same.

For ages 6–8. Addition and subtraction within 20.

## The ladder

Eight boards, square, from 2×2 to 9×9. Board size is the whole of the
difficulty; the maths stays the same kind throughout.

| Level | Board | Pads | Pairs | Sums within |
| --- | --- | --- | --- | --- |
| 1 | 2×2 | 4 | 2 | 10 |
| 2 | 3×3 ★ | 9 | 4 | 10 |
| 3 | 4×4 | 16 | 8 | 20 |
| 4 | 5×5 ★ | 25 | 12 | 20 |
| 5 | 6×6 | 36 | 18 | 20 |
| 6 | 7×7 ★ | 49 | 24 | 20 |
| 7 | 8×8 | 64 | 32 | 20 |
| 8 | 9×9 ★ | 81 | 40 | 20 |

**★ The free pad.** A board with an odd number of pads has a star pad in the
very middle. It starts face up, belongs to nobody, and needs no partner, so
every other pad still has one.

Finishing a board unlocks the next. A board picker shows all eight with the
best stars on each, and the game opens on the first board not yet finished.
The top boards are long — forty pairs is ten minutes or more — and are a
summit, not a default.

## The cards

- **Every card is a sum or a difference**: `a + b` or `a − b`, with every
  number at least 1 and every answer from 2 up to the board's limit. Never a
  bare number: every card has to be worked out.
- **Any two cards with the same value match.** On a board with `2 + 2`,
  `5 − 1`, `3 + 1` and `8 − 4`, any two of those four are a pair. "Equal" is
  the only rule; a big board does not need forty different answers.
- **No two cards on a board are written the same.** `3 + 4` never appears
  twice, so a match can never be made by spotting identical writing.
- **A pair is two different kinds of sum where it can be**: one addition, one
  subtraction. Spotting two additions with the same first number is not the
  skill.
- **Near misses.** Every board of 4×4 or more holds values next to each other
  (a 7 and an 8), so a quick guess at a similar-looking sum fails.
- **Every value appears an even number of times**, so the pond can always be
  cleared — whatever order the child finds things in.

### Generated, not authored

Boards are dealt fresh every time a board is played, from a seed. A memory
game that dealt the same layout twice would be memorised once and then
replayed. The rules above are checked by tests over many seeds for every
board, rather than by hand over a fixed set.

## A turn

| Child does | Game does |
| --- | --- |
| Taps a face-down pad | It flips over and shows its sum |
| Taps a second face-down pad | It flips over |
| — the two are equal | Both stay up and bloom into flowers. The match is written out — `3 + 4 = 7 = 9 − 2` — for a beat. That beat is the teaching |
| — the two are not equal | Both stay visible for about 1.3 seconds, then flip back. No numbers are shown: the working out stays the child's |
| Taps a pad during those 1.3 seconds | The two flip back at once and the new tap counts, so a quick child is never made to wait |
| Taps a pad already up, or the ★ | Nothing |

No clock, no lives, no way to fail. A board ends when every pad but the ★ is
up.

## Stars

A **miss** is a turn whose two pads were not equal. Stars come from misses
against the number of pairs on the board:

- **3 stars** — at most one miss per pair
- **2 stars** — at most two misses per pair
- **1 star** — anything more

The best stars per board are kept in `host.storage`. The thresholds are a
starting point; they are tuned by the guard tests below so that a careful
child earns three and flipping at random does not.

## Screen

The design space is 1152×768, as the other games, scenery past it.

- Top bar: the board's name ("4 × 4") centre, total stars right, a **Boards**
  button left that opens the picker.
- The pond fills the rest: a grid of pads sized to the board. On 9×9 a pad is
  about 106×61 design pixels — still larger than a fingertip and the sums
  still read at 27px; on 2×2 pads are capped so they do not become posters.
- Face down, a pad is a green lily pad. Face up, it is a pale pad with the sum
  in large hand lettering. Matched, it carries a small flower.
- The finished sum floats over the pond, centred, as each match is made.
- The end of a board: a card with the stars, misses and pairs, and "Next
  board" (or "Play again" on 9×9).

## Controls

Tap. Nothing else. A drag is a tap where the finger lifts. Arrow keys and
Space on a desktop move a highlight and flip, for testing on the Mac.

## Feel

- **Flip** — a quick turn of the pad and a soft plip.
- **Match** — both pads bloom, a bright two-note chime, the finished sum.
- **Miss** — a gentle bloop as the two flip back. Never a buzzer.
- **Board cleared** — the pond sparkles, the stars arrive one by one.

The look is the pond at the edge of the same meadow as the other games: soft
greens and blues, rounded shapes, vector-drawn.

## Structure

```
games/pond/                     package @bundle/pond, id 'pond', "Pond Pairs"
  src/index.ts                  GameModule + __test hooks
  src/driver.ts                 rules <-> scene, sound, input; the hold after a miss
  src/logic/                    pure: no DOM, no timers, no audio
    boards.data.ts              the eight boards: size, limit
    sums.ts                     every sum or difference with a given value
    deal.ts                     dealing a board from a seed, under the card rules
    game.ts                     one board in play: flips, matches, misses
    stars.ts progress.ts        stars per board; which boards are open
  src/view/                     canvas: reads state, never writes it
    geometry.ts timing.ts art.ts hud.ts scene.ts input.ts
  src/audio/pond-sounds.ts
```

Registration touches the same four places the other games did, and the tile
replaces the **Counting Meadow** placeholder, so the bundle stays ten games.
`?game=pond&level=board-5` opens straight onto the 5×5 board.

## Testing

The logic is pure and seeded, so the card rules become tests over many seeds
for every board:

- the right number of pads, pairs and ★ for each board
- every card is a sum or difference within the board's limit, every number at
  least 1, every value at least 2
- no two cards written the same
- every value appears an even number of times
- a pair is an addition and a subtraction wherever the value allows both
- near-miss values on every board of 4×4 or more
- the same seed deals the same board, and different seeds deal different ones
- a turn: two equal pads stay up and count no miss; two unequal pads count a
  miss and flip back; taps on up pads and the ★ do nothing; the board ends when
  every pad but the ★ is up
- stars from misses against pairs; the stored best never goes down
- each board played to the end through the real module in jsdom

And the ones that guard the design:

- **a bot with perfect memory that works every sum out** averages at least
  2.5 stars on every board;
- **a bot that flips at random** averages clearly fewer — at most 1.5 stars
  on every board from 4×4 up.

If random flipping does well, the board is too small to need memory, or the
stars are too generous; fix the thresholds, never the test.

## Deliberately not in the first build

- **Multiplication.** The cards stay addition and subtraction within 20; a
  times-table version could reuse everything here with a different `sums.ts`.
- **A timer, or a limit on misses.** Memory under pressure turns into
  guessing.
- **Painted art and recorded sound.** Vector pads and a synthesised pack, as
  the other games started.
