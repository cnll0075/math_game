# Where the animals come from

`character-sheet.png` is the original artwork. The four PNGs one directory up
are cut from its **top row** — the side views — because the seesaw is seen from
the side and because that row is the only one without the generator's watermark
across it.

To cut them again after editing the sheet, run `scripts/extract-animals.py`
against it. It finds each animal's own blob (ignoring the "Side View"
annotation and the captions underneath), turns the near-white background
transparent with a feathered edge, trims, and scales all four by one factor so
their relative sizes stay true to the drawing.

The game never loads this sheet: only the four cut PNGs ship.


## playground.png

The park behind the seesaw. It carries a watermark **straight across its
middle**, over the painted plank and the fulcrum, where nothing in the game can
cover it — a tilting plank moves, and the mark would show whenever it did.

Everything **above the seesaw's red handles** is clean, and that band is what
ships as `backdrop.png`: sky, clouds, the tree, the bench, the fence, the
bushes, the slide and the playhouse. The game draws its own seesaw standing in
front of it, coloured to match the painted one, and continues the sky upward and
the grass downward from the band's own edges.

Not used: the painted seesaw (the game needs one that tilts) and the sand pit
below it, both of which sit under or below the watermark.

A watermark-free export would let the whole painting be used, sand and all.
