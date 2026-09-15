# Where the artwork comes from

Nothing in `assets/` is edited by hand. The two files here are the originals,
and the scripts cut everything else out of them, so a better original can be
dropped in and recut.

## character-sheet.png

The four animals. `scripts/extract-animals.py` cuts the top row - the side-on
views - keys out its background and writes `chicken/cat/dog/bear.png`. Only that
row is used: the rows below it carry a watermark.

## park.png

The park, with its own seesaw standing level and empty in the middle of it.
`scripts/cut-seesaw.py` takes it apart into the four things the game draws:

- `park.jpg` - the park with the plank and both trays lifted out, and the hole
  they left repaired. The fence is rebuilt by repeating whole fence-lengths of
  the real fence, which is why the pickets stay upright and evenly spaced. Sky
  is painted in above the painting as well: it is far wider than it is tall, so
  a screen always has bare space above it, and its top edge is tree and cloud
  rather than sky - stretching that edge up to fill the space smeared both into
  vertical streaks. The new sky carries on the gradient the painting's own sky
  has. The frame cuts the tree's crown off flat, so the crown is grown back
  into that new sky out of the tree's own leaves - the canopy just under the cut,
  repeated upward and trimmed to a lobed dome - which puts real foliage in the
  right light there rather than a shape pasted over the sky.
- `plank-back.png` - the plank, both trays, and each tray's back rim.
- `plank-front.png` - each tray's near wall, drawn after the animals so they
  ride inside the basket instead of standing on top of it.
- `fulcrum.png` - the post, stretched taller through its middle, drawn in front
  of the plank exactly as the painting has it.

The post keeps its place in `park.jpg` as well. It is painted in front of the
plank, so lifting the plank out left nothing missing from it, and the cut post
is bigger than the painted one at every height, so it covers it completely.

## park-with-animals.png

The same park with two rabbits and a cat riding in the trays. Nothing is cut
from it: it is the reference for how big the animals should be drawn and how
deep in the basket they should sit.


## The animal recordings

`sounds/source/` holds the supplied stock clips under the names they arrived
with, because those names carry who made them and which clip they are - worth
keeping for the licence check before this ships.

`scripts/cut-cries.py` turns them into the four the game plays. They arrive as
stock clips rather than game cues: the cat is nearly twelve seconds of a cat
repeating itself and the chicken is seven of clucking, while the dog and the
bear are single sounds already. Each one is cut to a single cry, trimmed to
where the sound really starts - silence at the head of a cue is a delay the
child feels - faded at both edges so the cut cannot click, levelled against the
other three, and written as mono AAC at about 10KB apiece.

The windows the script cuts are chosen and recorded in it. The cat's loudest
meow is clipped in the original, so a quieter, cleaner one is taken instead.

They play through `createSampleSoundPack` in `@bundle/core`, with the
synthesised pack underneath for every other sound - and for the animals too,
until the files have loaded or if they never do. Because the files are levelled
against each other, the game needs one gain for all four rather than four
numbers kept in step by hand.
