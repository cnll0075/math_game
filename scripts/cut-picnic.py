"""Cut the Picnic Pals asset sheet into the pieces the game draws.

The sheet (1536x1024) holds a picnic table, a basket, chairs, four friends in
four moods each, Biscuit the dog, the treats, pizza and cake whole and in
pieces, the dial, the Share button, a fence and a patch of grass, each on
white. Every piece is cut by flooding the white in from the edge of its box,
so white painted inside an outline (the plates, the bunny) stays. Each friend's
eating face is rebuilt without the food painted in its paws (see `beaming`). The table's
own painted plates are painted out first, from the cloth beside them, because
each friend brings their own; the dial's painted "3" is wiped so the game can
write its own number.

Usage: python3 scripts/cut-picnic.py   (needs numpy and Pillow)
"""

from collections import deque

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SOURCE = 'games/picnic/assets/source/board.png'
OUT = 'games/picnic/assets'

# name: (left, top, right, bottom) on the sheet.
SPRITES = {
    'table': (4, 58, 632, 306),
    'basket': (600, 36, 774, 207),
    'chair': (618, 843, 762, 1002),
    'dog-sneak': (32, 352, 318, 538),
    'dog-caught': (362, 318, 568, 556),
    'cookie': (20, 588, 102, 657),
    'strawberry': (338, 583, 412, 667),
    'grapes': (528, 583, 647, 690),
    'sandwich': (676, 583, 772, 674),
    'pizza': (22, 692, 264, 822),
    'pizza-half': (283, 703, 422, 823),
    'cake': (590, 702, 750, 824),
    'cake-slice': (766, 716, 880, 824),
    'dial': (28, 838, 267, 1002),
    'share': (293, 873, 580, 962),
    'fence': (793, 848, 1122, 1002),
    'grass': (1138, 843, 1532, 1002),
    # The friends, in a grid: a row each, a column a mood.
    'teddy-eating': (882, 10, 1056, 196),
    'teddy-happy': (1064, 10, 1220, 196),
    'teddy-puzzled': (1230, 10, 1398, 196),
    'teddy-grumpy': (1398, 10, 1532, 196),
    'bunny-eating': (882, 203, 1056, 388),
    'bunny-happy': (1064, 203, 1220, 388),
    'bunny-puzzled': (1230, 203, 1398, 388),
    'bunny-grumpy': (1398, 203, 1532, 388),
    'fox-eating': (882, 390, 1056, 582),
    'fox-happy': (1064, 390, 1220, 582),
    'fox-puzzled': (1230, 390, 1398, 582),
    'fox-grumpy': (1398, 390, 1532, 582),
    'raccoon-eating': (882, 588, 1056, 772),
    'raccoon-happy': (1064, 588, 1220, 772),
    'raccoon-puzzled': (1230, 588, 1398, 772),
    'raccoon-grumpy': (1398, 588, 1532, 772),
}

# Pieces whose box catches a corner of a neighbour: only their largest part is kept.
LARGEST_ONLY = {'basket', 'dog-caught'}

# The chair's blue seat reaches into the corner of the basket's box: its blue
# is made white there before anything is cut.
CHAIR_CORNER = (728, 168, 780, 212)

# The table's painted plates, as ovals (left, top, right, bottom) taking in
# their shadows. Each is filled with cloth from beside it, at whichever offset
# makes the cloth around the oval line up best, so the checks run on through.
PLATES = [
    (143, 83, 254, 121),
    (372, 60, 474, 98),
    (437, 88, 539, 126),
]

# The dial's face, where its "3" is painted: centre and radius, and its colour.
DIAL_FACE = (147, 922, 52)
FACE = (246, 247, 252)

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


def oval(box, grow=0):
    """A mask of the oval in a box, over that box grown by `grow` on every side."""
    left, top, right, bottom = box
    w, h = right - left + 2 * grow, bottom - top + 2 * grow
    image = Image.new('L', (w, h), 0)
    ImageDraw.Draw(image).ellipse((grow, grow, w - grow - 1, h - grow - 1), fill=255)
    return np.asarray(image) > 0


def fill_plate(pixels, box):
    """Fill a plate's oval with the cloth whose surroundings match its own best."""
    ring_grow = 8
    left, top, right, bottom = box
    outer = oval(box, ring_grow)
    inner = np.pad(oval(box), ring_grow)
    ring = outer & ~inner
    here = pixels[top - ring_grow:bottom + ring_grow, left - ring_grow:right + ring_grow]
    best = None
    for dx in range(-200, 201):
        if abs(dx) < right - left:
            continue
        for dy in range(-4, 5):
            y0, x0 = top - ring_grow + dy, left - ring_grow + dx
            there = pixels[y0:y0 + here.shape[0], x0:x0 + here.shape[1]]
            if there.shape != here.shape:
                continue
            # Cloth only: pink checks (green and blue alike, red above them) and
            # their pale squares, never wood (orange: green above blue), the
            # white of the sheet, or another plate.
            r, g, b = there[..., 0], there[..., 1], there[..., 2]
            pink = (r - b > 25) & (np.abs(g - b) < 30)
            blank = (there.min(axis=2) > 238) & (there.max(axis=2) - there.min(axis=2) < 10)
            if pink[outer].mean() < 0.35 or blank[outer].mean() > 0.02:
                continue
            score = ((there[ring] - here[ring]) ** 2).mean()
            if best is None or score < best[0]:
                best = (score, dx, dy)
    _, dx, dy = best
    # Blended in over a soft edge, a few pixels wide, so no seam shows.
    grow = 3
    patch = pixels[top + dy - grow:bottom + dy + grow, left + dx - grow:right + dx + grow].astype(float)
    target = pixels[top - grow:bottom + grow, left - grow:right + grow]
    mask = Image.fromarray((oval(box, grow) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(2))
    weight = (np.asarray(mask).astype(float) / 255)[..., None]
    target[...] = (patch * weight + target * (1 - weight)).astype(int)


def largest_part(sprite):
    """The sprite with everything but its biggest connected piece cleared."""
    alpha = np.asarray(sprite)[..., 3]
    solid = alpha > 0
    label = np.zeros(solid.shape, int)
    sizes = [0]
    for y, x in zip(*np.nonzero(solid)):
        if label[y, x]:
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
                if 0 <= ny < solid.shape[0] and 0 <= nx < solid.shape[1] and solid[ny, nx] and not label[ny, nx]:
                    label[ny, nx] = index
                    queue.append((ny, nx))
        sizes.append(size)
    keep = label == int(np.argmax(sizes))
    rgba = np.asarray(sprite).copy()
    rgba[..., 3] = np.where(keep, rgba[..., 3], 0)
    out = Image.fromarray(rgba, 'RGBA')
    return out.crop(out.getbbox())


MOODS = ('eating', 'happy', 'puzzled', 'grumpy')

# The sheet's eating faces hold food of their own (cookies, a strawberry, a
# sandwich), which would be the wrong food whatever was shared. So each
# friend's eating picture is made from their happy picture, whose paws are
# empty, wearing the eating face's big smile: the head, down to its neck (a
# share of its height), placed where it lines up best.
NECK = {'teddy': 0.64, 'bunny': 0.68, 'fox': 0.56, 'raccoon': 0.5}
NECK_FEATHER = 14


def beaming(board, friend):
    """The happy picture with the eating face's big smile, and nothing in its paws."""
    eat = np.asarray(cut(board, SPRITES[f'{friend}-eating'])).astype(float)
    body = np.asarray(cut(board, SPRITES[f'{friend}-happy'])).astype(float)
    rows = int(eat.shape[0] * NECK[friend])
    head = eat[:rows]
    solid = head[..., 3] > 128
    ys, xs = np.nonzero(solid)
    # Where the head sits best on the body: most of its outline over the body,
    # least of the body's old head left outside it.
    best = None
    for dy in range(-30, 31):
        for dx in range(-40, 41):
            ty, tx = ys + dy, xs + dx
            inside = (ty >= 0) & (ty < body.shape[0]) & (tx >= 0) & (tx < body.shape[1])
            if inside.mean() < 0.9:
                continue
            hit = (body[ty[inside], tx[inside], 3] > 128).mean()
            covered = np.zeros(body.shape[:2], bool)
            covered[ty[inside], tx[inside]] = True
            top = max(0, rows + dy)
            spill = ((body[:top, :, 3] > 128) & ~covered[:top]).sum() / max(1, solid.sum())
            if best is None or hit - spill > best[0]:
                best = (hit - spill, dx, dy)
    _, dx, dy = best
    result = body.copy()
    # The old head is cleared wherever the new one does not cover it, above
    # where the new one fades into the body, so no old ear or cheek peeks out.
    placed = np.zeros(body.shape[:2], np.uint8)
    ty, tx = ys + dy, xs + dx
    inside = (ty >= 0) & (ty < body.shape[0]) & (tx >= 0) & (tx < body.shape[1])
    placed[ty[inside], tx[inside]] = 255
    placed = np.asarray(Image.fromarray(placed).filter(ImageFilter.MaxFilter(3))) > 0
    clear = np.zeros(body.shape[:2], bool)
    clear[:max(0, rows + dy - NECK_FEATHER - 2)] = True
    result[clear & ~placed, 3] = 0
    fade = np.ones(rows)
    fade[-NECK_FEATHER:] = np.linspace(1, 0, NECK_FEATHER)
    for y in range(rows):
        to_y = y + dy
        if not 0 <= to_y < body.shape[0]:
            continue
        for x in range(head.shape[1]):
            to_x = x + dx
            if not 0 <= to_x < body.shape[1]:
                continue
            a = head[y, x, 3] / 255 * fade[y]
            # Where the head fades into the body, only over the body: never a
            # faint fringe left hanging beside it.
            if a <= 0 or (fade[y] < 1 and body[to_y, to_x, 3] < 128):
                continue
            result[to_y, to_x, :3] = head[y, x, :3] * a + result[to_y, to_x, :3] * (1 - a)
            result[to_y, to_x, 3] = max(result[to_y, to_x, 3], head[y, x, 3] * fade[y])
    out = Image.fromarray(result.astype(np.uint8), 'RGBA')
    return out.crop(out.getbbox())


def centre_on_plate(sprite):
    """
    Widened so the friend's plate sits in the middle of the bottom edge. Each
    mood is cut to its own outline (a cookie held out, a tail), so without this
    the plate would jump about as the faces change.
    """
    rgba = np.asarray(sprite)
    bottom = rgba[-14:]
    light = (bottom[..., 3] > 200) & (bottom[..., :3].min(axis=2) > 200)
    xs = np.nonzero(light)[1]
    centre = (xs.min() + xs.max()) / 2
    half = int(np.ceil(max(centre, sprite.width - centre)))
    out = Image.new('RGBA', (half * 2, sprite.height), (0, 0, 0, 0))
    out.paste(sprite, (int(round(half - centre)), 0))
    return out


def prepare(sheet):
    """The sheet with the table's plates and the dial's number painted out."""
    pixels = np.asarray(sheet).astype(int).copy()
    for box in PLATES:
        fill_plate(pixels, box)
    left, top, right, bottom = CHAIR_CORNER
    corner = pixels[top:bottom, left:right]
    corner[corner[..., 2] > corner[..., 0] + 30] = 255
    board = Image.fromarray(pixels.astype(np.uint8), 'RGB')
    cx, cy, r = DIAL_FACE
    ImageDraw.Draw(board).ellipse((cx - r, cy - r, cx + r, cy + r), fill=FACE)
    return board


def main():
    sheet = Image.open(SOURCE).convert('RGB')
    if sheet.size != (1536, 1024):
        raise SystemExit(f'expected a 1536x1024 sheet, got {sheet.size}: measure the boxes again')
    board = prepare(sheet)
    for name, box in SPRITES.items():
        friend, _, mood = name.partition('-')
        sprite = beaming(board, friend) if mood == 'eating' and friend in NECK else cut(board, box)
        if name in LARGEST_ONLY:
            sprite = largest_part(sprite)
        if '-' in name and name.split('-')[1] in MOODS:
            sprite = centre_on_plate(sprite)
        sprite.save(f'{OUT}/{name}.png')
    print(f'cut {len(SPRITES)} pieces into {OUT}')


if __name__ == '__main__':
    main()
