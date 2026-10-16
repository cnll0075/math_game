"""Cut the train asset sheet into the pieces Cargo Yard draws.

The sheet (1536x1024) holds an example scene, three trains, their broken and
leaving states, ten cargo pieces, four workers, a broken track, props, UI
pieces and effect icons, each on white. Every sprite is cut by flooding the
white in from the edge of its box. Out of the scene comes `backdrop.jpg`, with
its trains, signs and HUD painted out so the game can draw its own, and
`sign.png`, the red train's sign with its number wiped.

Usage: python3 scripts/cut-train.py   (needs numpy and Pillow)
"""

from collections import deque

import numpy as np
from PIL import Image, ImageDraw, ImageFilter


SOURCE = 'games/train/assets/source/board.png'
OUT = 'games/train/assets'

# name: (left, top, right, bottom) on the sheet. Trains are flipped to face right.
SPRITES = {
    'train-red': (902, 56, 1198, 154),
    'train-blue': (902, 222, 1198, 318),
    'train-green': (902, 382, 1202, 478),
    'train-broken': (1258, 156, 1502, 304),
    'train-leaving': (1268, 330, 1504, 452),
    'cargo-1': (28, 562, 102, 642),
    'cargo-2': (126, 558, 210, 642),
    'cargo-3': (233, 558, 320, 642),
    'cargo-4': (343, 558, 430, 642),
    'cargo-5': (458, 553, 532, 642),
    'cargo-6': (20, 707, 112, 792),
    'cargo-7': (128, 707, 220, 788),
    'cargo-8': (238, 703, 327, 792),
    'cargo-9': (348, 703, 437, 792),
    'cargo-10': (453, 703, 542, 792),
    'worker-wrench': (578, 572, 662, 692),
    'worker-carry': (683, 577, 782, 672),
    'worker-wheel': (598, 697, 732, 812),
    'worker-clipboard': (752, 687, 817, 812),
    'broken-track': (858, 618, 1052, 752),
    'station': (1083, 578, 1272, 722),
    'crane': (1298, 578, 1387, 666),
    'crate-stack': (1438, 602, 1517, 662),
    'barrier': (1368, 668, 1442, 712),
    'signal': (1472, 678, 1508, 752),
    'lighthouse': (1188, 708, 1292, 832),
    'seagull': (1403, 762, 1452, 806),
    'pill': (13, 878, 137, 942),
    'stopwatch': (148, 878, 197, 937),
    'pause': (283, 948, 327, 987),
    'progress': (303, 878, 487, 927),
    'repair': (521, 876, 582, 934),
    'hazard': (578, 883, 702, 922),
    'tick': (748, 893, 797, 942),
    'cross': (823, 893, 872, 942),
    'warning': (893, 888, 942, 937),
    'star': (960, 888, 1008, 937),
    'bolt': (1023, 883, 1082, 937),
}
FLIP = {'train-red', 'train-blue', 'train-green', 'train-broken', 'train-leaving'}

# The scene, and what is painted out of it, each by copying a patch of the
# same scene from `dx` pixels to the side: the track rows are regular, so a
# train is replaced by the empty track beside it.
SCENE_BOX = (16, 36, 868, 503)
PAINT_OUT = [
    # (left, top, right, bottom, dx): fill this box from the box shifted by dx.
    (356, 182, 462, 262, -112),   # red train, back half: from the empty track to its left
    (462, 182, 562, 262, 140),    # red train, front half: from between it and the sign
    (356, 268, 462, 346, -112),   # blue train
    (462, 268, 562, 346, 140),
    (356, 352, 462, 430, -112),   # green train
    (462, 352, 562, 430, 140),
    (700, 222, 780, 272, -90),    # the three signs
    (700, 293, 780, 346, -90),
    (700, 360, 780, 412, -90),
    (426, 462, 552, 486, 140),    # "Overflow Line"
    # The HUD pills sit on open sky: each row is blended across from the sky
    # either side of them (dx None), which copying would fill with clouds.
    (368, 44, 542, 101, None),
    (562, 44, 680, 101, None),
    (804, 42, 860, 99, None),
]
SIGN_BOX = (703, 224, 778, 270)
SIGN_NUMBER = (735, 230, 774, 262)   # wiped with the sign's own dark fill
SIGN_FILL = (58, 58, 66)

# Background: bright and nearly grey. Shadows on the sheet are a pale grey too.
WHITE_MIN = 208
WHITE_SPREAD = 24


def whiteish(rgb):
    lo = rgb.min(axis=2)
    hi = rgb.max(axis=2)
    return (lo >= WHITE_MIN) & ((hi - lo) <= WHITE_SPREAD)


def flood_from_edges(passable):
    h, w = passable.shape
    seen = np.zeros((h, w), bool)
    queue = deque()
    for x in range(w):
        for y in (0, h - 1):
            if passable[y, x] and not seen[y, x]:
                seen[y, x] = True
                queue.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
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


def keep_largest(alpha):
    """Drop stray specks: anything opaque not joined to the biggest piece, unless big itself."""
    solid = alpha > 0
    h, w = solid.shape
    label = np.zeros((h, w), int)
    sizes = [0]
    for y in range(h):
        for x in range(w):
            if not solid[y, x] or label[y, x]:
                continue
            index = len(sizes)
            label[y, x] = index
            queue = deque([(y, x)])
            size = 0
            while queue:
                cy, cx = queue.popleft()
                size += 1
                for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    ny, nx = cy + dy, cx + dx
                    if 0 <= ny < h and 0 <= nx < w and solid[ny, nx] and not label[ny, nx]:
                        label[ny, nx] = index
                        queue.append((ny, nx))
            sizes.append(size)
    biggest = max(sizes)
    keep = np.array([size >= biggest * 0.04 for size in sizes])
    keep[0] = False
    return np.where(keep[label], alpha, 0)


def cut(board, box, blanks=()):
    board = board.copy()
    gaps = []
    for blank in blanks:
        if len(blank) == 5:
            gaps.append(blank[:4])
            continue
        ImageDraw.Draw(board).rectangle(blank, fill=(255, 255, 255))
    piece = board.crop(box).convert('RGB')
    rgb = np.asarray(piece).astype(int)
    white = whiteish(rgb)
    background = flood_from_edges(white)
    for left, top, right, bottom in gaps:
        # White closed off from the edge, here, is background too: the gap
        # between the rod and the line.
        rows = slice(top - box[1], bottom - box[1])
        cols = slice(left - box[0], right - box[0])
        background[rows, cols] |= white[rows, cols]
    alpha = np.where(background, 0, 255).astype(np.uint8)
    alpha = keep_largest(alpha).astype(np.uint8)
    # A one-pixel feather, so the edge is not a staircase over the water.
    soft = np.asarray(Image.fromarray(alpha).filter(ImageFilter.GaussianBlur(0.7)))
    alpha = np.minimum(alpha, soft)
    rgba = np.dstack([rgb.astype(np.uint8), alpha])
    sprite = Image.fromarray(rgba, 'RGBA')
    return sprite.crop(sprite.getbbox())


def blend_across(image, box):
    """Fill a box row by row, fading from the pixel just left of it to the one just right."""
    left, top, right, bottom = box
    pixels = np.asarray(image).astype(float)
    for y in range(top, bottom):
        a = pixels[y, left - 2]
        b = pixels[y, right + 2]
        for x in range(left, right):
            t = (x - left) / (right - left)
            image.putpixel((x, y), tuple(int(v) for v in a * (1 - t) + b * t))


def backdrop(sheet):
    """The example scene with its trains, signs, HUD and caption painted out."""
    scene = sheet.copy()
    for left, top, right, bottom, dx in PAINT_OUT:
        if dx is None:
            blend_across(scene, (left, top, right, bottom))
            continue
        patch = scene.crop((left + dx, top, right + dx, bottom))
        scene.paste(patch, (left, top))
    return scene.crop(SCENE_BOX).convert('RGB')


def sign(sheet):
    """The red train's sign, its number wiped so the game can write its own."""
    board = sheet.copy()
    ImageDraw.Draw(board).rectangle(SIGN_NUMBER, fill=SIGN_FILL)
    return cut(board, SIGN_BOX)


def main():
    sheet = Image.open(SOURCE).convert('RGB')
    if sheet.size != (1536, 1024):
        raise SystemExit(f'expected a 1536x1024 sheet, got {sheet.size}: measure the boxes again')
    for name, box in SPRITES.items():
        sprite = cut(sheet, box)
        if name in FLIP:
            sprite = sprite.transpose(Image.FLIP_LEFT_RIGHT)
        sprite.save(f'{OUT}/{name}.png')
    backdrop(sheet).save(f'{OUT}/backdrop.jpg', quality=90)
    sign(sheet).save(f'{OUT}/sign.png')
    print(f'cut {len(SPRITES) + 2} pieces into {OUT}')


if __name__ == '__main__':
    main()
