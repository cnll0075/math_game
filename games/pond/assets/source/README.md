# Where the artwork comes from

Nothing in `assets/` is edited by hand. `pond.png` here is the original
painting, and `scripts/cut-pond.py` cuts everything else out of it, so a better
painting can be dropped in and recut with one command.

## pond.png

The frog pond, with a 4×4 grid of lily pads painted into the water and a frog
leaping out of it at the top left. The game deals its own pads and makes the
frog jump about, so the script takes all three apart:

- `pond.jpg` - the pond with the painted pads, the frog and its splash removed.
  Each pad is masked as a whole ellipse with its shadow and filled row by row
  with the water either side of it, only ever borrowing water so the plants at
  the edge never smear. The frog's spot is filled with the bank just right of
  it.
- `lily-pad.png` - one painted pad, keyed off the water. Only water reached
  from the edge is cleared, so the notch stays open and the veins stay put.
- `frog.png` - the frog, cut along its outline. The scenery behind it is
  painted soft, so the outline is the one crisp edge around it.
