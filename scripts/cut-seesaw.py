"""Cut the park painting into the pieces the game moves.

The painting shows a level seesaw in a park. The game needs the plank to tilt,
so the plank and its two trays are lifted out as sprites and the hole they leave
is repaired. The fulcrum post stays in the backdrop: it is painted IN FRONT of
the plank, so nothing of it is missing, and a redrawn post covers the plank's
middle where the two meet.

Every sprite is cut onto the same canvas with the pivot at the same spot, so the
game draws them all with one transform and no per-sprite offsets.

Usage: python3 scripts/cut-seesaw.py
"""

import sys

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as ndi

SOURCE = 'games/seesaw/assets/source/park.png'
OUT = 'games/seesaw/assets'

# The bolt the plank turns on, in source pixels.
PIVOT = (996, 468)
# The shared sprite canvas, in source pixels. Wide enough for both trays, tall
# enough for the stretched post.
CANVAS = {'x': 296, 'y': 228, 'w': 1400, 'h': 640}

# Where the wood lives, so dirt and tree bark elsewhere are never mistaken for it.
PLANK_BOX = (296, 1696, 430, 508)
TRAY_BOXES = [(300, 640, 356, 534), (1340, 1690, 356, 534)]

# The repair works in three passes, because the hole is not one shape. Above and
# below the plank the gaps are tray-sized, with clean park either side of them;
# across the plank's own band the gap runs nearly the full width and there is
# nothing beside it to borrow from.
TRAY_TOP_ROWS = (356, 434)
BAND_ROWS = (434, 502)
TRAY_BOTTOM_ROWS = (502, 534)
# The fence repeats every this many pixels. Rebuilding the gaps in whole pickets
# rather than folding the neighbours back keeps the pickets upright and evenly
# spaced instead of ghosting them over each other.
FENCE_PERIOD = 126
# The tray is an open box. Everything above this line is its back rim, which the
# animals sit in front of; everything below is its front wall, which they sit
# behind. That is what makes them look like they are IN the tray.
TRAY_SPLIT = 402

# The post's silhouette, measured off the painting: two straight edges that
# flare downward, closed at the top by an arch.
POST_TOP = 417.0
POST_ARCH_CY, POST_ARCH_RX, POST_ARCH_RY = 447.0, 36.0, 30.0
POST_L, POST_R, POST_SLOPE_L, POST_SLOPE_R = 957.0, 1029.0, -0.425, 0.55
POST_BASE = 640

# The painted post is too short for a seesaw that has to tilt: the low tray
# would be in the dirt long before the plank looks steep. Its middle is stretched
# so the pivot rides higher, which its plain vertical grain hides completely.
# PARK.postStretch in src/view/geometry.ts must match STRETCH_BY.
STRETCH_FROM, STRETCH_TO, STRETCH_BY = 470, 600, 120
# How far below the base the cut reaches, to keep the grass tufts and the shadow.
BASE_SKIRT = 62

# The painting is far wider than it is tall, so on a screen there is always bare
# space above it. Stretching its top edge upward to fill that space smeared the
# tree and the clouds into vertical streaks, so real sky is painted in instead,
# carrying on the gradient the sky already has. PARK.skyHeadroom in
# src/view/geometry.ts must match SKY_HEADROOM.
SKY_HEADROOM = 300
# How far the sky keeps deepening before it levels off. Carried all the way up,
# the gradient turns an unnaturally strong blue.
SKY_RISE = 200
# The band where the new sky meets the painting. Sky columns match already, so
# this is what dissolves the tree at the top edge instead of cutting it flat.
SKY_BLEND = 26


def warm_mask(a):
    """Painted wood: orange-brown, warmer than the grass and the sky."""
    R, G, B = a[:, :, 0], a[:, :, 1], a[:, :, 2]
    return (R - B > 70) & (R - G > 38) & (G >= B - 5)


def in_box(shape, box):
    x0, x1, y0, y1 = box
    m = np.zeros(shape, bool)
    m[y0:y1, x0:x1] = True
    return m


def post_edges(y):
    """Left and right edge of the post at one row, or None above its top."""
    if y < POST_TOP:
        return None
    if y < POST_ARCH_CY:
        # The rounded top.
        t = (POST_ARCH_CY - y) / POST_ARCH_RY
        half = POST_ARCH_RX * np.sqrt(max(0.0, 1 - t * t))
        return (POST_ARCH_CY - POST_ARCH_CY + 993 - half, 993 + half)
    return (POST_L + POST_SLOPE_L * (y - 445), POST_R + POST_SLOPE_R * (y - 445))


def post_mask(shape, top=POST_TOP, bottom=POST_BASE + BASE_SKIRT):
    m = np.zeros(shape, bool)
    for y in range(int(top), min(int(bottom), shape[0])):
        edge = post_edges(y)
        if edge is None:
            continue
        m[y, max(0, int(edge[0])):int(edge[1]) + 1] = True
    return m


def runs(row):
    """Contiguous True spans of a boolean row, as (start, end) inclusive."""
    idx = np.nonzero(row)[0]
    if len(idx) == 0:
        return []
    breaks = np.nonzero(np.diff(idx) > 1)[0]
    out, start = [], idx[0]
    for b in breaks:
        out.append((int(start), int(idx[b])))
        start = idx[b + 1]
    out.append((int(start), int(idx[-1])))
    return out


def mirrored(strip, n, from_left):
    """n pixels of donor, folded back and forth so it never runs out."""
    if len(strip) == 0:
        return np.zeros((n, 3))
    src = strip[::-1] if from_left else strip
    out = np.empty((n, 3))
    for i in range(n):
        k = i % (2 * len(src))
        out[i] = src[k] if k < len(src) else src[2 * len(src) - 1 - k]
    return out


def periodic_clone(rgb, mask, y0, y1, dirty, period=FENCE_PERIOD):
    """Fill each gap from the same park one fence-length over.

    The park repeats horizontally - pickets, bushes, grass - so a donor a whole
    number of fence-lengths away lines up with what the gap interrupted.
    """
    width = rgb.shape[1]
    for y in range(y0, y1):
        clean = ~dirty[y]
        for a, b in runs(mask[y]):
            for x in range(a, b + 1):
                for step in range(1, 24):
                    for src in (x + step * period, x - step * period):
                        if 0 <= src < width and clean[src]:
                            rgb[y, x] = rgb[y, src]
                            break
                    else:
                        continue
                    break


def mirror_fill(rgb, mask, y0, y1):
    """Close each gap with its own neighbours, folded inward from both sides.

    The park is painted in horizontal bands - bushes, fence, grass - so a donor
    at the same height carries the right content, and folding it keeps the fence
    pickets upright instead of smearing them.
    """
    for y in range(y0, y1):
        for a, b in runs(mask[y]):
            n = b - a + 1
            left = mirrored(rgb[y, max(0, a - n):a], n, True)
            right = mirrored(rgb[y, b + 1:b + 1 + n], n, False)[::-1]
            t = np.linspace(0, 1, n)[:, None]
            rgb[y, a:b + 1] = left * (1 - t) + right * t


def widest_clean(dirty, y0, y1, period):
    """The widest run of columns with nothing of the seesaw or the trees in it.

    Returned as a whole number of fence-lengths, so tiling it keeps the pickets
    evenly spaced rather than jumping at every repeat.
    """
    bad = dirty[y0:y1].any(axis=0)
    best, start, run = (0, 0), 0, 0
    for x, blocked in enumerate(bad):
        if blocked:
            run, start = 0, x + 1
        else:
            run += 1
            if run > best[0]:
                best = (run, start)
    width = (best[0] // period) * period
    return best[1], width


def tile_fill(rgb, mask, y0, y1, dirty, period=FENCE_PERIOD):
    """Lay real park across the gap, repeating whole fence-lengths of it.

    The plank's own band is the one gap with no clean park beside it at any
    height, so this reaches for the nearest unbroken stretch and repeats it.
    Blending the rows above and below into each other instead left a washed-out
    stripe right where the fence meets the grass.
    """
    start, width = widest_clean(dirty, y0, y1, period)
    if width == 0:
        return
    for y in range(y0, y1):
        for a, b in runs(mask[y]):
            for x in range(a, b + 1):
                rgb[y, x] = rgb[y, start + (x - start) % width]


def feather(mask, radius=1.1):
    a = Image.fromarray((mask * 255).astype('uint8'))
    return np.asarray(a.filter(ImageFilter.GaussianBlur(radius))).astype(float) / 255


def to_canvas(rgb, alpha):
    """Lift a source-sized layer onto the shared sprite canvas."""
    x, y, w, h = CANVAS['x'], CANVAS['y'], CANVAS['w'], CANVAS['h']
    out = np.zeros((h, w, 4))
    sub_rgb = rgb[y:y + h, x:x + w]
    sub_a = alpha[y:y + h, x:x + w]
    out[:sub_rgb.shape[0], :sub_rgb.shape[1], :3] = sub_rgb
    out[:sub_a.shape[0], :sub_a.shape[1], 3] = sub_a * 255
    return out


def save(canvas, name):
    # Transparent pixels keep whatever colour happened to be under them, which
    # is noise that costs hundreds of kilobytes to store. Nobody sees it.
    canvas[canvas[:, :, 3] == 0] = 0
    Image.fromarray(np.clip(canvas, 0, 255).astype('uint8'), 'RGBA').save(f'{OUT}/{name}.png')
    print(f'{name}: {canvas.shape[1]}x{canvas.shape[0]}')


def add_sky(park):
    """Paint sky above the painting, in the painting's own colours."""
    sky = park[:80, :, 2] > park[:80, :, 0] + 40
    columns = sky[0] & (park[0, :, 2] > 180)
    if not columns.any():
        return park

    # The sky's own gradient, row by row, taken across everything that is sky.
    rows = np.array([park[y][columns].mean(axis=0) for y in range(80)])
    ys = np.arange(80)
    slope = np.polyfit(ys, rows, 1)[0]
    top = rows[0]

    head = np.empty((SKY_HEADROOM, park.shape[1], 3))
    for j in range(SKY_HEADROOM):
        above = SKY_HEADROOM - j
        head[j] = top - slope * min(above, SKY_RISE)
        if above <= SKY_BLEND:
            # Fade into the painting's own top row. Where that row is sky the
            # blend is invisible; where it is the tree, the canopy softens into
            # the sky rather than ending on a ruled line.
            t = 1 - above / SKY_BLEND
            head[j] = head[j] * (1 - t) + park[0] * t

    return np.concatenate([head, park])


def main():
    im = Image.open(SOURCE).convert('RGB')
    a = np.asarray(im).astype(float)
    shape = a.shape[:2]

    warm = warm_mask(a.astype(int))
    boxes = in_box(shape, PLANK_BOX)
    for box in TRAY_BOXES:
        boxes |= in_box(shape, box)
    seesaw = warm & boxes
    seesaw = ndi.binary_closing(seesaw, np.ones((9, 9)))
    seesaw = ndi.binary_fill_holes(seesaw)
    seesaw = ndi.binary_dilation(seesaw, np.ones((3, 3)))
    # The tray's underside is nearly black where it shades itself, and the paint
    # fades out rather than stopping. The repair reaches further than the cut so
    # no rim of it survives to be smeared across the park.
    reach = ndi.binary_dilation(seesaw, np.ones((9, 9)))

    # --- the plank sprite, with the stretch of it the post hides filled back in
    plank_rgb = a.copy()
    hidden = post_mask(shape, POST_TOP, POST_BASE) & in_box(shape, PLANK_BOX) & ~seesaw
    mirror_fill(plank_rgb, hidden, PLANK_BOX[2], PLANK_BOX[3])
    plank = seesaw | hidden

    front = np.zeros(shape, bool)
    for box in TRAY_BOXES:
        front |= in_box(shape, (box[0], box[1], TRAY_SPLIT, box[3]))
    save(to_canvas(plank_rgb, feather(plank & ~front)), 'plank-back')
    save(to_canvas(plank_rgb, feather(plank & front)), 'plank-front')

    # --- the post, stretched taller through its middle
    post = post_mask(shape)
    post_alpha = feather(post)
    top = int(POST_TOP) - 4
    bottom = POST_BASE + BASE_SKIRT
    bands = [(top, STRETCH_FROM, 0), (STRETCH_FROM, STRETCH_TO, STRETCH_BY), (STRETCH_TO, bottom, 0)]
    pieces = []
    for y0, y1, grow in bands:
        rgb = Image.fromarray(a[y0:y1].astype('uint8'))
        alp = Image.fromarray((post_alpha[y0:y1] * 255).astype('uint8'))
        if grow:
            size = (shape[1], y1 - y0 + grow)
            rgb = rgb.resize(size, Image.LANCZOS)
            alp = alp.resize(size, Image.LANCZOS)
        pieces.append((np.asarray(rgb).astype(float), np.asarray(alp).astype(float) / 255))
    tall_rgb = np.concatenate([p[0] for p in pieces])
    tall_alpha = np.concatenate([p[1] for p in pieces])
    # Put it back where it stood, so the pivot still lands on the bolt.
    post_rgb = np.zeros_like(a)
    post_a = np.zeros(shape)
    room = min(shape[0] - top, tall_rgb.shape[0])
    post_rgb[top:top + room] = tall_rgb[:room]
    post_a[top:top + room] = tall_alpha[:room]
    save(to_canvas(post_rgb, post_a), 'fulcrum')

    # --- the park with the plank and trays taken out of it
    park = a.copy()
    gone = reach & ~post_mask(shape, POST_TOP, POST_BASE)
    # Tray rows first, so the band's repair has clean fence above it and clean
    # grass below it to pull from.
    # Wood is never a donor: the tree at one edge of the painting and the arch
    # at the other are the wrong thing to find in the middle of a fence.
    dirty = reach | post_mask(shape) | warm
    periodic_clone(park, gone, *TRAY_TOP_ROWS, dirty)
    periodic_clone(park, gone, *TRAY_BOTTOM_ROWS, dirty)
    tile_fill(park, gone, *BAND_ROWS, dirty)
    out = Image.fromarray(np.clip(add_sky(park), 0, 255).astype('uint8'))
    out.save(f'{OUT}/park.jpg', quality=92, subsampling=0)
    print(f'park: {out.width}x{out.height}')


if __name__ == '__main__':
    sys.exit(main())
