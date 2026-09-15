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
