"""Cut the frog pond painting into the pieces Pond Pairs draws.

The painting shows the pond with a 4x4 grid of lily pads already in it and a
frog leaping out at the top left. The game deals its own pads, from 2x2 to 9x9,
and makes the frog jump about, so all three are taken apart:

- `pond.jpg`      the pond with the painted pads and the frog removed
- `lily-pad.png`  one painted pad, cut out, for every pad the game deals
- `frog.png`      the frog, cut out

The boxes, seeds and cut-offs below are measured on this one 1536x1024 painting.
A different painting needs them measured again; the script refuses any other
size rather than cut the wrong places.

Usage: python3 scripts/cut-pond.py   (needs numpy and Pillow)
"""

from collections import deque

import numpy as np
from PIL import Image, ImageFilter

SOURCE = 'games/pond/assets/source/pond.png'
OUT = 'games/pond/assets'

# One of the painted pads: second row, second column. Any of the sixteen would
# do; this one sits flattest.
PAD_BOX = (505, 458, 752, 592)
# The frog and the splash it leaves behind, in source pixels.
FROG_BOX = (190, 100, 372, 292)
SPLASH_BOX = (118, 268, 245, 390)
# A point on the frog's belly, inside FROG_BOX, to grow the frog from.
FROG_SEED = (110, 100)
# Edges sharper than this are the frog's outline; the scenery behind it is
# painted soft, so the outline is the one crisp line around it.
FROG_EDGE = 25
# The painted grid of pads, where the repair looks for them.
GRID_BOX = (170, 325, 1395, 915)
# Where the scenery that hides the frog's old spot is borrowed from: just right
# of it, rocks and grass on the same bank.
FROG_PATCH_SHIFT = 170


def flood(passable, seeds):
    h, w = passable.shape
    seen = np.zeros((h, w), bool)
    queue = deque()
    for y, x in seeds:
        if passable[y, x] and not seen[y, x]:
            seen[y, x] = True
            queue.append((y, x))
    while queue:
        y, x = queue.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and passable[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True
                queue.append((ny, nx))
    return seen


def dilate(mask, n=1):
    out = mask.copy()
    for _ in range(n):
        grown = out.copy()
        grown[1:] |= out[:-1]
        grown[:-1] |= out[1:]
        grown[:, 1:] |= out[:, :-1]
        grown[:, :-1] |= out[:, 1:]
        out = grown
    return out


def erode(mask, n=1):
    return ~dilate(~mask, n)


def border(h, w):
    return [(0, x) for x in range(w)] + [(h - 1, x) for x in range(w)] + [(y, 0) for y in range(h)] + [(y, w - 1) for y in range(h)]


def cutout(pixels, mask, path, feather):
    """Writes the masked pixels as a tightly cropped PNG with soft, crisp edges."""
    alpha = Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(feather))
    alpha = np.clip((np.asarray(alpha).astype(int) - 40) * 255 // 170, 0, 255)
    ys, xs = np.where(mask)
    image = Image.fromarray(np.dstack([pixels, alpha]).astype(np.uint8), 'RGBA')
    image.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)).save(path)


def cut_pad(art):
    x0, y0, x1, y1 = PAD_BOX
    crop = art[y0:y1, x0:x1]
    r, g, b = crop[..., 0], crop[..., 1], crop[..., 2]
    # Water is everything not clearly green; only water reached from the edge
    # is background, so the notch stays open and the veins stay on the pad.
    water = ~((g > b + 15) & (g > r))
    outside = flood(water, border(*water.shape))
    cutout(crop, ~outside, f'{OUT}/lily-pad.png', feather=1.2)


def cut_frog(art):
    x0, y0, x1, y1 = FROG_BOX
    crop = art[y0:y1, x0:x1]
    lum = 0.3 * crop[..., 0] + 0.59 * crop[..., 1] + 0.11 * crop[..., 2]
    gy = np.zeros_like(lum)
    gx = np.zeros_like(lum)
    gy[1:-1] = lum[2:] - lum[:-2]
    gx[:, 1:-1] = lum[:, 2:] - lum[:, :-2]
    outline = dilate(np.hypot(gx, gy) > FROG_EDGE, 1)
    outside = flood(~outline, border(*outline.shape))
    frog = flood(~outside, [FROG_SEED])
    frog = erode(dilate(frog, 2), 2)  # close pinholes
    frog = flood(dilate(erode(frog, 3), 3), [FROG_SEED])  # cut thin strands of scenery away
    frog &= ~(crop[..., 2] > crop[..., 1] + 10)  # and the splash, which is blue
    frog = flood(dilate(erode(frog, 1), 1), [FROG_SEED])
    cutout(crop, frog, f'{OUT}/frog.png', feather=0.8)
    whole = np.zeros(art.shape[:2], bool)
    whole[y0:y1, x0:x1] = frog
    return whole


def repair(art, frog):
    """The pond without its painted pads, splash or frog."""
    h, w, _ = art.shape
    a = art.astype(float)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    yy, xx = np.mgrid[0:h, 0:w]

    # The plant at the bottom left reaches into the grid; its darker leaves stay.
    leaves = flood((g > b) & (g <= 165) & (yy >= 640), [(1000, 40), (900, 60), (960, 150)])
    leaves &= ~((yy >= 860) & (yy <= 950) & (xx >= 225))  # the bottom pad's rim touches it

    # Each painted pad, masked as a whole ellipse with its shadow and ripple.
    green = (g > b + 5) & (g > r)
    gx0, gy0, gx1, gy1 = GRID_BOX
    pads = np.zeros((h, w), bool)
    seen = np.zeros((h, w), bool)
    for y in range(gy0 + 5, gy1, 12):
        for x in range(gx0 + 10, gx1, 12):
            if not green[y, x] or seen[y, x]:
                continue
            blob = flood(green, [(y, x)])
            seen |= blob
            if blob.sum() < 6000:
                continue
            ys, xs = np.where(blob & (xx >= 188))
            cx, cy = (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2 + 6
            rx, ry = (xs.max() - xs.min()) / 2 + 14, (ys.max() - ys.min()) / 2 + 16
            pads |= ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2 <= 1
    pads &= ~(xx < 188) & ~leaves

    splash = np.zeros((h, w), bool)
    sx0, sy0, sx1, sy1 = SPLASH_BOX
    splash[sy0:sy1, sx0:sx1] = True
    corner = (xx >= 188) & (xx < 470) & (yy >= 680) & (g > b) & ~leaves
    hole = pads | splash | corner

    # Fill each row of the hole by blending the water either side of it. Only
    # water is ever borrowed, so leaves never smear across the pond.
    out = a.copy()
    is_water = lambda colour: colour[2] > colour[1]
    for y in range(h):
        xs = np.where(hole[y])[0]
        if not len(xs):
            continue
        starts = [xs[0]] + [xs[i] for i in range(1, len(xs)) if xs[i] != xs[i - 1] + 1]
        ends = [xs[i] for i in range(len(xs) - 1) if xs[i + 1] != xs[i] + 1] + [xs[-1]]
        for s, e in zip(starts, ends):
            left = a[y, max(s - 8, 0):max(s - 1, 1)].mean(0)
            right = a[y, min(e + 2, w - 1):min(e + 9, w)].mean(0)
            if not is_water(left) and is_water(right):
                left = right
            if not is_water(right) and is_water(left):
                right = left
            t = np.linspace(0, 1, e - s + 1)[:, None]
            out[y, s:e + 1] = left * (1 - t) + right * t
    soft = dilate(hole, 2) & (xx >= 192)
    blurred = np.asarray(Image.fromarray(out.clip(0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(6))).astype(float)
    out[soft] = blurred[soft]
    out[soft] += np.random.default_rng(3).normal(0, 1.6, (h, w, 1))[soft]

    # The frog's own shape, filled with the bank just right of it.
    spot = dilate(frog, 5)
    out[spot] = np.roll(a, -FROG_PATCH_SHIFT, axis=1)[spot]
    blurred = np.asarray(Image.fromarray(out.clip(0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(4))).astype(float)
    seam = dilate(spot, 4) & ~erode(spot, 4)
    out[seam] = blurred[seam]

    Image.fromarray(out.clip(0, 255).astype(np.uint8)).save(f'{OUT}/pond.jpg', quality=88)


def main():
    art = np.asarray(Image.open(SOURCE).convert('RGB')).astype(int)
    if art.shape[:2] != (1024, 1536):
        raise SystemExit(f'{SOURCE} is {art.shape[1]}x{art.shape[0]}; the measurements here are for 1536x1024')
    cut_pad(art)
    frog = cut_frog(art)
    repair(art, frog)
    print('wrote pond.jpg, lily-pad.png, frog.png')


if __name__ == '__main__':
    main()
