#!/usr/bin/env python3
"""Cut the four animals out of the character sheet.

Needs Pillow. The sheet holds three rows — side views, front views, and a size
comparison — and we take the side views, which is the row the game draws and the
only one without a watermark across it.

    python3 scripts/extract-animals.py games/seesaw/assets/source/character-sheet.png
"""
import sys
from PIL import Image

BACKGROUND = (252, 250, 250)
# Each animal's own blob on the sheet, excluding the annotation above the
# chicken and the captions below the row.
SPANS = {
    'chicken': (34, 231, 163, 335),
    'cat': (313, 517, 116, 335),
    'dog': (593, 870, 53, 337),
    'bear': (943, 1289, 15, 339),
}
# One factor for all four, so the artwork's own proportions survive the cut.
SCALE = 0.62


def keyed(crop: Image.Image) -> Image.Image:
    """Background to transparency, with a feathered edge rather than a fringe."""
    out = crop.copy()
    pixels = out.load()
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, _ = pixels[x, y]
            distance = max(abs(r - BACKGROUND[0]), abs(g - BACKGROUND[1]), abs(b - BACKGROUND[2]))
            if distance <= 6:
                pixels[x, y] = (r, g, b, 0)
            elif distance <= 18:
                pixels[x, y] = (r, g, b, int(255 * (distance - 6) / 12))
    return out


def main(sheet_path: str) -> None:
    sheet = Image.open(sheet_path).convert('RGBA')
    for name, (x0, x1, y0, y1) in SPANS.items():
        crop = keyed(sheet.crop((x0 - 4, y0 - 4, x1 + 4, y1 + 4)))
        crop = crop.crop(crop.getbbox())
        crop = crop.resize((round(crop.width * SCALE), round(crop.height * SCALE)), Image.LANCZOS)
        crop.save(f'games/seesaw/assets/{name}.png')
        print(f'{name}: {crop.width}x{crop.height}')


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'games/seesaw/assets/source/character-sheet.png')
