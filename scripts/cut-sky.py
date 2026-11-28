"""Cut the Sky Patrol asset sheets into the pieces the game draws.

Two sheets, each 1536x1024 on white:

- `planes.png` — the falling planes, all nose-down, each with a plain round
  spot where the game writes its number; the two small planes a blimp bursts
  into; and four loose clouds.
- `board.png` — the sky backdrop, the player's fighter (and its overheated
  look), the shell, the burst, the fuel gauge and score badge, the hearts, the
  banner ribbon, the sum plaque and the end-of-run card.

Every piece is cut by flooding the white in from the edge of its box. For each
plane the script also finds its number spot (the largest cream disc on it) and
writes where it is, as a share of the picture, into
`games/sky/src/view/art.data.ts`, so the game writes the number exactly in it.

Usage: python3 scripts/cut-sky.py   (needs numpy and Pillow)
"""

from collections import deque

import numpy as np
from PIL import Image, ImageFilter

PLANES_SOURCE = 'games/sky/assets/source/planes.png'
BOARD_SOURCE = 'games/sky/assets/source/board.png'
OUT = 'games/sky/assets'
DATA = 'games/sky/src/view/art.data.ts'

# name: (left, top, right, bottom) on planes.png.
PLANES = {
    'glider': (15, 50, 415, 360),
    'weaver': (425, 45, 812, 352),
    'blimp': (860, 15, 1195, 440),
    'piece-1': (1275, 35, 1528, 248),
    'piece-2': (1268, 268, 1530, 492),
    'scout': (25, 400, 402, 718),
    'hider': (430, 415, 812, 728),
    'treasure': (860, 455, 1225, 738),
}
CLOUDS = {
    'cloud-1': (25, 760, 452, 988),
    'cloud-2': (505, 795, 812, 982),
    'cloud-3': (880, 822, 1118, 972),
    'cloud-4': (1168, 772, 1518, 978),
}

# name: (left, top, right, bottom) on board.png.
BOARD = {
    'fighter': (32, 478, 302, 702),
    'fighter-hot': (352, 468, 568, 692),
    'shell': (618, 542, 670, 642),
    'pop': (692, 518, 862, 668),
    'fuel': (846, 20, 1244, 102),
    'score': (1280, 20, 1522, 102),
    'heart': (1212, 545, 1310, 632),
    'heart-empty': (1317, 545, 1415, 632),
    'heart-cracked': (1422, 545, 1521, 632),
    'ribbon': (14, 700, 588, 815),
    'plaque': (474, 812, 990, 998),
    'card': (1088, 676, 1522, 998),
}
# The backdrop: inside the painting's rounded frame.
BACKDROP = (24, 24, 800, 444)

# Background: bright and nearly grey. Shadows on the sheets are a pale grey too.
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


def number_spot(sprite):
    """The plane's number spot: the largest cream disc, as a share of the picture (x, y, radius)."""
    rgba = np.asarray(sprite).astype(int)
    r, g, b, a = rgba[..., 0], rgba[..., 1], rgba[..., 2], rgba[..., 3]
    cream = (a > 250) & (r > 236) & (g > 230) & (b > 205) & (r - b > 4)
    cream = np.asarray(Image.fromarray((cream * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(3))) > 0
    h, w = cream.shape
    label = np.zeros((h, w), int)
    best = None
    index = 0
    for y, x in zip(*np.nonzero(cream)):
        if label[y, x]:
            continue
        index += 1
        label[y, x] = index
        queue = deque([(y, x)])
        points = []
        while queue:
            cy, cx = queue.popleft()
            points.append((cy, cx))
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                ny, nx = cy + dy, cx + dx
                if 0 <= ny < h and 0 <= nx < w and cream[ny, nx] and not label[ny, nx]:
                    label[ny, nx] = index
                    queue.append((ny, nx))
        if best is None or len(points) > len(best):
            best = points
    ys = np.array([p[0] for p in best])
    xs = np.array([p[1] for p in best])
    radius = np.sqrt(len(best) / np.pi) + 1.5
    return xs.mean() / w, ys.mean() / h, radius / h


def main():
    planes = Image.open(PLANES_SOURCE).convert('RGB')
    board = Image.open(BOARD_SOURCE).convert('RGB')
    for sheet in (planes, board):
        if sheet.size != (1536, 1024):
            raise SystemExit(f'expected 1536x1024 sheets, got {sheet.size}: measure the boxes again')
    sizes = {}
    spots = {}
    for name, box in PLANES.items():
        sprite = cut(planes, box)
        sprite.save(f'{OUT}/{name}.png')
        sizes[name] = sprite.size
        spots[name] = number_spot(sprite)
    for name, box in {**CLOUDS}.items():
        sprite = cut(planes, box)
        sprite.save(f'{OUT}/{name}.png')
        sizes[name] = sprite.size
    for name, box in BOARD.items():
        sprite = cut(board, box)
        sprite.save(f'{OUT}/{name}.png')
        sizes[name] = sprite.size
    board.crop(BACKDROP).save(f'{OUT}/backdrop.jpg', quality=90)
    lines = [
        '// Written by scripts/cut-sky.py: do not edit by hand.',
        '',
        '/** Each cut picture\'s size in pixels. */',
        'export const ART_SIZES = {',
    ]
    for name, (w, h) in sizes.items():
        lines.append(f"  '{name}': {{ width: {w}, height: {h} }},")
    lines += [
        '} as const;',
        '',
        '/** Where each plane\'s number spot is: its middle and radius, as shares of the picture (radius of its height). */',
        'export const NUMBER_SPOTS = {',
    ]
    for name, (x, y, r) in spots.items():
        lines.append(f"  '{name}': {{ x: {x:.3f}, y: {y:.3f}, r: {r:.3f} }},")
    lines += ['} as const;', '']
    open(DATA, 'w').write('\n'.join(lines))
    print(f'cut {len(sizes) + 1} pieces into {OUT}; spots into {DATA}')


if __name__ == '__main__':
    main()
