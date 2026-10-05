"""Cut the fishing asset board into the pieces Bucket Bay draws.

The board (1536x1024) is one painting holding a game scene, a fisherman, a boat,
a bucket, a timer, ten fish, five items and some props, each on white. Every
sprite is cut by flooding the white in from the edge of its box, so white
painted *inside* an outline (the clownfish's stripes, the swordfish's belly)
stays. Out of the scene comes:

- `backdrop.jpg`  the scene above the water, with its own boy and boat painted
                  out (the game sails its own), to stand behind the bay
- `bucket.png`    with its "8/10" painted out, so the game can write its own
- `timer.png`     with its face wiped, so the game can draw its own time

The boxes below are measured on this board. A different board needs them
measured again; the script refuses any other size rather than cut the wrong
places.

Usage: python3 scripts/cut-fishing.py   (needs numpy and Pillow)
"""

from collections import deque

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SOURCE = 'games/fishing/assets/source/board.png'
OUT = 'games/fishing/assets'

# name: (left, top, right, bottom) on the board.
SPRITES = {
    'fisherman': (872, 58, 1048, 290),
    'boat': (1003, 122, 1228, 292),
    'bucket': (1244, 96, 1398, 262),
    'timer': (1404, 68, 1528, 214),
    # Fish, by the weight the board gives each.
    'clownfish': (18, 535, 162, 640),
    'bluefish': (185, 545, 308, 635),
    'yellowfish': (336, 535, 468, 640),
    'tuna': (488, 520, 658, 640),
    'angler': (664, 498, 812, 642),
    'crab': (18, 780, 172, 900),
    'ray': (180, 778, 346, 908),
    'swordfish': (350, 775, 552, 915),
    'puffer': (552, 785, 678, 902),
    'jellyfish': (712, 765, 832, 912),
    # Items.
    'speed-potion': (896, 418, 992, 552),
    'health-potion': (1016, 418, 1118, 552),
    'net': (1128, 422, 1262, 556),
    'bonus-time': (1276, 440, 1370, 534),
    'treasure': (1396, 432, 1510, 540),
    # Props.
    'buoy': (1450, 786, 1516, 874),
    'barrel': (1240, 866, 1336, 940),
    'rocks': (880, 892, 1026, 990),
    'seaweed': (1414, 892, 1530, 1004),
    'seagull': (1360, 874, 1440, 946),
}

# The scene: everything above the waterline, which on the board is y = 355.
SCENE_BOX = (20, 40, 850, 355)
# The boy, his boat and his float in the scene (in the scene's own pixels), and how far right the water and
# hills that replace them are borrowed from.
SCENE_BOY = (146, 136, 412, 315)
SCENE_PATCH_SHIFT = 270

# The fishing line hangs from the rod tip on the board. The game draws its own,
# so the painted one comes out of both the fisherman and the boat.
LINE_COLUMNS = (1024, 1048)
LINE_ROWS = (80, 290)

# The bucket's opening, where "8/10" is painted, and the timer's face.
BUCKET_OPENING = (1325, 123, 50, 18)  # centre x, centre y, radius x, radius y
TIMER_FACE = (1466, 160, 49)  # centre x, centre y, radius
# Cream rather than white, so the face is not taken for background.
FACE = (252, 240, 212)

# Where each sprite's box overlaps a neighbour, the neighbour's part is
# blanked first: the boat's bow under the fisherman, his rod over the boat.
BLANK = {
    'fisherman': [(1000, 192, 1048, 290), (1005, 58, 1048, 192, 'white')],
    'boat': [(1003, 122, 1100, 186)],
}

# Background: bright and nearly grey. Shadows on the board are a pale grey too.
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


def erase_line(board):
    """Paint the fishing line out of the board, where it runs over white."""
    pixels = np.asarray(board).astype(int).copy()
    left, right = LINE_COLUMNS
    top, bottom = LINE_ROWS
    region = pixels[top:bottom, left:right]
    lo = region.min(axis=2)
    hi = region.max(axis=2)
    line = (lo >= 120) & ((hi - lo) <= 40)
    region[line] = 255
    pixels[top:bottom, left:right] = region
    return Image.fromarray(pixels.astype(np.uint8), 'RGB')


def paint_bucket(board):
    draw = ImageDraw.Draw(board)
    cx, cy, rx, ry = BUCKET_OPENING
    navy = board.getpixel((cx - rx + 6, cy))
    draw.ellipse((cx - rx, cy - ry, cx + rx, cy + ry), fill=navy)


def paint_timer(board):
    draw = ImageDraw.Draw(board)
    cx, cy, r = TIMER_FACE
    draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=FACE)
    # The painted red wedge reaches under the rim; whatever is left of it goes too.
    pixels = np.asarray(board).astype(int)
    box = pixels[cy - r - 6:cy + r + 6, cx - r - 6:cx + r + 6]
    red = (box[..., 0] > 170) & (box[..., 1] < 140) & (box[..., 2] < 150)
    for y, x in zip(*np.nonzero(red)):
        board.putpixel((cx - r - 6 + int(x), cy - r - 6 + int(y)), FACE)


def backdrop(board):
    scene = board.crop(SCENE_BOX).convert('RGB')
    left, top, right, bottom = SCENE_BOY
    patch = scene.crop((left + SCENE_PATCH_SHIFT, top, right + SCENE_PATCH_SHIFT, bottom))
    # Blend the borrowed patch in over a soft-edged mask so no seam shows.
    # Feathered across the top and right only: the left edge meets the jetty's
    # post and the bottom is the waterline, both of which want a clean edge.
    mask = Image.new('L', (patch.size[0] + 40, patch.size[1] + 40), 0)
    ImageDraw.Draw(mask).rectangle((20, 34, patch.size[0] + 4, patch.size[1] + 40), fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(7)).crop((20, 20, patch.size[0] + 20, patch.size[1] + 20))
    scene.paste(patch, (left, top), mask)
    return scene


def main():
    board = Image.open(SOURCE).convert('RGB')
    if board.size != (1536, 1024):
        raise SystemExit(f'expected the 1536x1024 board, got {board.size}')
    scene = backdrop(board)
    scene.save(f'{OUT}/backdrop.jpg', quality=86)

    clean = erase_line(board)
    paint_bucket(clean)
    paint_timer(clean)
    for name, box in SPRITES.items():
        cut(clean, box, BLANK.get(name, ())).save(f'{OUT}/{name}.png', optimize=True)
        print(name, 'cut')


if __name__ == '__main__':
    main()
