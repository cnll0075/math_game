# Picnic Pals — design

The bundle's eighth game. Teddy is hosting a picnic. A basket of treats comes
out and the friends around the table must each get **exactly the same**. Share
one at a time, or turn the dial to share in groups — the fewer shares, the
more stars. What cannot be shared fairly goes to Biscuit, the dog, who is
always hoping.

The other games are about making totals. This one is about **sharing**: equal
groups, odd and even, remainders, and halves and quarters — division and early
fractions met as fairness, which children of 6 to 8 feel keenly. It is the
bundle's calm game: no clock, no way to lose a round.

For ages 6–8. Levels, like Bucket Bay, with stars.

## The table

- A painted picnic table in the middle of a park, with 2 to 4 friends sitting
  behind it, each with their own plate on the table: **Teddy** (the host,
  welcoming), **Bunny** (loves strawberries), **Fox** (excited whenever food
  arrives), **Raccoon** (notices when things are not fair). Each has four faces
  from the sheet: happy, eating, puzzled, grumpy.
- The basket, and in front of the table the treats it brought, laid out in
  rows of five so they can be counted, with the number on a tag (`12`).
- Bottom right: the **dial** (how many each friend gets in one share, 1 to 10)
  and the **Share** button.
- **Biscuit** the dog lives just off the right edge.

## Sharing

**Tapping a plate** (rounds 1–4, before the dial is introduced) gives that
friend one treat. A friend who already has more than someone else shakes their
head — "everyone gets one before anyone gets two" — so a tap can never make it
unfair.

**The dial** (from round 5) is how many each friend gets per share. Ghost
treats hover over every plate showing what the next share would do. Press
**Share** and every plate gets that many at once, the treats flying in groups
and bouncing onto the plates. The dial can be changed between shares.

| 12 cookies, 3 friends | What happens | Shares |
| --- | --- | --- |
| Dial 1 | 1 each, again and again | 4 |
| Dial 2 | 2 each, then 2 more each | 2 |
| Dial 3 | 3 each, then the dial turned to 1 for the rest | 2 |
| Dial 4 | 4 each, all in one go | 1 |
| Dial 5 | The ghosts show the last plates going short; the friends look puzzled and Share will not press | — |

A share that would run out is never made: the preview shows why, and the
child turns the dial down.

**A course ends** when the basket cannot give everyone one more. If it is
empty, that is it; if some are left — only ever fewer than there are friends —
Biscuit trots in and takes them, which is how remainders are met. Biscuit only
appears when there really are leftovers.

Plates with the same number glow together, so fair is visible without words.
When the last course is done the friends eat together — the signature moment —
and a card says what happened: `12 cookies, 3 friends: 4 each!`, and
`1 for Biscuit!` when there was one.

## Other courses

- **Chairs** (round 9): a fixed number of treats, and the dial chooses how many
  chairs to set, 2 to 4. The preview shows how the treats would go; only a
  number of chairs that leaves nothing over will seat the friends (Biscuit
  peeks in hopefully at any other). Then it is shared like any course.
- **Cutting** (rounds 10–11): a whole pizza or cake on the table. Swipe across
  it to cut. A cut must pass through the middle, or it is uneven — Raccoon
  frowns and the cut fades. Pizza needs one cut for two halves; cake needs two
  cuts, crossing, for four quarters. Then each friend gets a piece.

## Stars

Stars count **shares**, never dial turns or taps. In a dial course the fewest
possible shares is one (dial set to the answer). Over a round's courses: the
fewest possible shares is three stars, one more is two, anything else is one.
Tapping and cutting rounds give three stars for finishing. Every finished round
earns at least one star. Best stars per round are kept in `host.storage`.

## Rounds

| # | Title | Friends | Course | Learning |
| --- | --- | --- | --- | --- |
| 1 | Two Friends | Teddy, Bunny | 6 cookies, tapping | Equal sharing |
| 2 | Strawberry Share | Teddy, Bunny | 10 strawberries, tapping | Halves |
| 3 | One for Biscuit | Teddy, Fox | 7 cookies, tapping | Remainders |
| 4 | Odd Grapes | Bunny, Fox | 9 grapes, tapping | Odd and even |
| 5 | The Dial | Teddy, Bunny, Fox | 9 cookies, dial | Sharing into 3 |
| 6 | Three Plates | Teddy, Bunny, Fox | 12 strawberries, dial | Groups of 4 |
| 7 | Four Friends | all four | 16 grapes, dial | Sharing into 4 |
| 8 | Sandwich Stack | all four | 14 sandwiches, dial | Groups and a remainder |
| 9 | Surprise Guests | up to four | 9 cookies, chairs | Reverse: how many can share |
| 10 | Pizza Halves | Teddy, Bunny | a pizza, one cut | Halves |
| 11 | Cake Quarters | all four | a cake, two cuts | Quarters |
| 12 | Picnic Party | Teddy, Fox, Raccoon | 6 cookies, then 9 strawberries, dial | Mixed review |

The dial arrives in round 5, after four rounds of sharing one at a time. No
round introduces two new ideas.

The sheet has four friends, so a table seats at most four.

## Feel

- Treats fly in groups and bounce onto plates with a little pop each;
  matching stacks glow.
- Faces: happy waiting; puzzled when the preview shows a share running out;
  grumpy (Raccoon first) at an uneven cut or a plate that would get too many;
  eating at the end, all together.
- Biscuit runs in with a cookie in his mouth for leftovers, and sits up
  surprised when he peeks at chairs that would leave him some.
- Sound, synthesised: pops as treats land, a whoosh as a share flies, a soft
  "uh-uh" for a refused tap, munching and a cheer at the end, a woof.

## Art

All from `games/picnic/assets/source/board.png` (the Picnic Pals asset sheet),
cut by `scripts/cut-picnic.py`: the table (its own painted plates painted out),
basket, chair, the four friends in four moods, Biscuit sneaking and caught, the
treats and their halves, pizza and cake whole and in pieces, the dial (its
painted number wiped), the Share button, the fence and the grass. The sky is
drawn.

## Structure

Laid out like Bucket Bay: `games/picnic/`, package `@bundle/picnic`, module id
`'picnic'`, "Picnic Pals". `src/logic/` holds the rounds, the table (pure state:
plates, basket, dial, courses, cuts) and stars, with no DOM; `src/view/` draws
it; a driver runs intro → sharing → done. Registered in the same four places as
every game, replacing the "Sharing Table" placeholder tile ("Share it fairly").
`?game=picnic&level=cake-quarters` opens a round by id.

## Testing

- every round's courses can be finished, and the fewest shares in a dial course
  is one
- a tap never makes plates unequal; leftovers are always fewer than the friends
- the dial never makes a share that would run out
- chairs only seat a number that leaves nothing over
- a cut through the middle counts, an off-centre one does not; two crossing cuts
  make quarters
- stars count shares only
- a bot finishes every round
