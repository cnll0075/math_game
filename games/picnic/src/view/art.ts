import { hand, type Bounds, type Point } from '@bundle/core';
import type { FoodId, FriendId, Mood, TreatId } from '../logic/friends.js';
import { BASKET, BODY_Y, BOWL, DIAL, DOG, FENCE, FENCE_FRIEND, FOOD, FRIEND, fromFood, PLATE, POOL, SHARE, SKY, TABLE } from './geometry.js';
import type { SpriteName, Sprites } from './sprites.js';

const INK = '#1e2a38';
const TAU = Math.PI * 2;

/** A sprite drawn with its bottom middle at a point, or a stand-in shape while it loads. */
export function drawStanding(
  ctx: CanvasRenderingContext2D,
  sprites: Sprites,
  name: SpriteName,
  bottom: Point,
  scale: number,
  options: { alpha?: number; flip?: boolean; fallback?: string } = {},
): void {
  const image = sprites[name];
  ctx.save();
  ctx.globalAlpha = options.alpha ?? 1;
  ctx.translate(bottom.x, bottom.y);
  if (options.flip) ctx.scale(-1, 1);
  if (image) {
    ctx.drawImage(image, (-image.width * scale) / 2, -image.height * scale, image.width * scale, image.height * scale);
  } else {
    ctx.fillStyle = options.fallback ?? '#c98a4b';
    ctx.fillRect(-40 * scale, -80 * scale, 80 * scale, 80 * scale);
  }
  ctx.restore();
}

/** A sprite drawn centred on a point at a size (its larger side). */
export function drawCentred(ctx: CanvasRenderingContext2D, sprites: Sprites, name: SpriteName, at: Point, size: number, alpha = 1): void {
  const image = sprites[name];
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(at.x, at.y);
  if (image) {
    const scale = size / Math.max(image.width, image.height);
    ctx.drawImage(image, (-image.width * scale) / 2, (-image.height * scale) / 2, image.width * scale, image.height * scale);
  } else {
    ctx.fillStyle = '#e0533f';
    ctx.beginPath();
    ctx.arc(0, 0, size / 2, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

/** Sky and grass to the edges of the screen; the fence is drawn on its own, so friends can wait behind it. */
export function drawPark(ctx: CanvasRenderingContext2D, bounds: Bounds): void {
  const sky = ctx.createLinearGradient(0, bounds.top, 0, SKY.horizon);
  sky.addColorStop(0, '#7cc8f0');
  sky.addColorStop(1, '#d6f0fb');
  ctx.fillStyle = sky;
  ctx.fillRect(bounds.left, bounds.top, bounds.right - bounds.left, SKY.horizon - bounds.top);
  const grass = ctx.createLinearGradient(0, SKY.horizon, 0, bounds.bottom);
  grass.addColorStop(0, '#a9da62');
  grass.addColorStop(1, '#78bf45');
  ctx.fillStyle = grass;
  ctx.fillRect(bounds.left, SKY.horizon - 8, bounds.right - bounds.left, bounds.bottom - SKY.horizon + 8);
  // Soft clouds.
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  for (const [x, y, r] of [[180, 70, 34], [230, 60, 44], [282, 74, 30], [820, 96, 30], [866, 84, 40], [912, 98, 28]] as const) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }
}

/** The fence along the back of the park. */
export function drawFence(ctx: CanvasRenderingContext2D, sprites: Sprites, bounds: Bounds): void {
  const fence = sprites.fence;
  if (fence) {
    const width = fence.width * FENCE.scale * 0.86;
    for (let x = bounds.left - width / 2; x < bounds.right + width; x += width) {
      drawStanding(ctx, sprites, 'fence', { x, y: FENCE.y + fence.height * FENCE.scale }, FENCE.scale);
    }
  }
}

export function drawTable(ctx: CanvasRenderingContext2D, sprites: Sprites): void {
  const image = sprites.table;
  if (image) {
    const width = image.width * TABLE.scale;
    ctx.drawImage(image, TABLE.x - width / 2, TABLE.top, width, image.height * TABLE.scale);
    return;
  }
  ctx.fillStyle = '#e8645a';
  ctx.fillRect(TABLE.x - 400, TABLE.top + 40, 800, 140);
}

/**
 * A friend sitting behind the table: drawn before it, so it hides them below
 * the shoulders. The sheet's eating faces hold food of their own — a cookie,
 * a strawberry, a sandwich — so a friend eating wears their happy face
 * instead, their own share on the plate in front of them.
 */
export function drawFriend(ctx: CanvasRenderingContext2D, sprites: Sprites, friend: FriendId, mood: Mood, seat: Point, bob = 0): void {
  const face: Mood = mood === 'eating' ? 'happy' : mood;
  drawStanding(ctx, sprites, `${friend}-${face}`, { x: seat.x, y: BODY_Y - bob }, FRIEND.scale, { fallback: '#b07a4a' });
}


/** A friend waiting to be asked, peeking over the fence. */
export function drawWaiting(ctx: CanvasRenderingContext2D, sprites: Sprites, friend: FriendId, at: Point, bob: number): void {
  drawStanding(ctx, sprites, `${friend}-happy`, { x: at.x, y: at.y - bob }, FENCE_FRIEND.scale, { fallback: '#b07a4a' });
}

/** A white plate with a blue rim, on the cloth. */
export function drawPlate(ctx: CanvasRenderingContext2D, seat: Point): void {
  ctx.save();
  ctx.fillStyle = 'rgba(30,42,56,0.18)';
  ctx.beginPath();
  ctx.ellipse?.(seat.x + 3, seat.y + 4, PLATE.rx, PLATE.ry, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#3f6fd6';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse?.(seat.x, seat.y, PLATE.rx, PLATE.ry, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = 'rgba(63,111,214,0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse?.(seat.x, seat.y, PLATE.rx * 0.68, PLATE.ry * 0.62, 0, 0, TAU);
  ctx.stroke();
  ctx.restore();
}

/** Biscuit's bowl, red, on the grass beside him. */
export function drawBowl(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.fillStyle = 'rgba(30,42,56,0.2)';
  ctx.beginPath();
  ctx.ellipse?.(BOWL.x + 3, BOWL.y + 16, BOWL.rx + 4, BOWL.ry, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#c93a32';
  ctx.beginPath();
  ctx.moveTo(BOWL.x - BOWL.rx, BOWL.y);
  ctx.lineTo(BOWL.x - BOWL.rx + 8, BOWL.y + 18);
  ctx.lineTo(BOWL.x + BOWL.rx - 8, BOWL.y + 18);
  ctx.lineTo(BOWL.x + BOWL.rx, BOWL.y);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#e8574c';
  ctx.beginPath();
  ctx.ellipse?.(BOWL.x, BOWL.y, BOWL.rx, BOWL.ry, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#7a1f1a';
  ctx.beginPath();
  ctx.ellipse?.(BOWL.x, BOWL.y + 1, BOWL.rx - 7, BOWL.ry - 5, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/** Where the n-th leftover sits in Biscuit's bowl. */
export const bowlSpot = (index: number): Point => ({ x: BOWL.x + (index - 1) * 22, y: BOWL.y - 6 - (index % 2) * 4 });

/**
 * Biscuit, sitting by the table facing it, hoping. Eating, he hops in his
 * place with what was actually left over held in his mouth, shrinking as he
 * eats it: never a cookie he was not given.
 */
export function drawDog(ctx: CanvasRenderingContext2D, sprites: Sprites, eating: { treat: TreatId; progress: number } | null, clock: number): void {
  const hop = eating ? Math.abs(Math.sin(eating.progress * 14)) * 16 : Math.abs(Math.sin(clock * 1.4)) * 2;
  drawStanding(ctx, sprites, 'dog-caught', { x: DOG.x, y: DOG.y - hop }, DOG.scale, { flip: true, fallback: '#c98a4b' });
  if (eating && eating.progress < 0.85) {
    drawCentred(ctx, sprites, eating.treat, { x: DOG.x + DOG_MOUTH.x, y: DOG.y - hop + DOG_MOUTH.y }, 40 * (1 - eating.progress * 0.8));
  }
}

/** A word from Biscuit, in a speech bubble over him. */
export function drawBubble(ctx: CanvasRenderingContext2D, text: string, alpha: number): void {
  const width = Math.max(180, text.length * 13 + 40);
  const right = DOG.x + 60;
  const left = right - width;
  const top = DOG.y - 214;
  const height = 54;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(left + 22, top);
  ctx.arcTo(right, top, right, top + height, 22);
  ctx.arcTo(right, top + height, left, top + height, 22);
  ctx.lineTo(DOG.x - 4, top + height);
  ctx.lineTo(DOG.x - 18, top + height + 22);
  ctx.lineTo(DOG.x - 26, top + height);
  ctx.arcTo(left, top + height, left, top, 22);
  ctx.arcTo(left, top, right, top, 22);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.font = hand(700, 24);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = INK;
  ctx.fillText(text, (left + right) / 2, top + height / 2 + 1);
  ctx.restore();
}

/** Where Biscuit's mouth is, from where he sits, as he is drawn facing the table. */
const DOG_MOUTH = { x: -22, y: -84 } as const;

/**
 * A knife: silver blade, wooden handle, its tip at a point and pointing along
 * an angle. Its edge is always underneath, whichever way it points.
 */
export function drawKnife(ctx: CanvasRenderingContext2D, tip: Point, angle: number, alpha = 1): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(tip.x, tip.y);
  ctx.rotate(angle);
  // Drawn with the tip at the origin and the handle off to the right; turned
  // over when it points back on itself, so the spine stays on top.
  if (Math.cos(angle) < 0) ctx.scale(1, -1);
  ctx.fillStyle = 'rgba(30,42,56,0.25)';
  ctx.beginPath();
  ctx.ellipse?.(70, 14, 72, 8, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#dfe6ee';
  ctx.strokeStyle = '#8a97a6';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(80, -8);
  ctx.lineTo(80, 12);
  ctx.quadraticCurveTo(28, 14, 0, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#9a5b2e';
  ctx.strokeStyle = '#6b3d1c';
  ctx.beginPath();
  ctx.roundRect?.(78, -8, 62, 18, 8);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#e8d8b8';
  for (const x of [94, 110, 126]) {
    ctx.beginPath();
    ctx.arc(x, 1, 2.5, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

/** Where the n-th treat on a plate sits: a little heap, four to a row. */
export const heapSpot = (seat: Point, index: number): Point => {
  const row = Math.floor(index / 4);
  const inRow = index % 4;
  return { x: seat.x + (inRow - 1.5) * 30 + (row % 2) * 12, y: seat.y - 10 - row * 20 };
};

export function drawHeap(ctx: CanvasRenderingContext2D, sprites: Sprites, treat: TreatId, count: number, seat: Point, alpha = 1, from = 0, lift = 0): void {
  for (let index = from; index < from + count; index += 1) {
    const spot = heapSpot(seat, index);
    drawCentred(ctx, sprites, treat, { x: spot.x, y: spot.y - lift }, 42, alpha);
  }
}

/** A round tag with a number: how many each plate has, or what is left to share. */
export function drawTag(ctx: CanvasRenderingContext2D, text: string, at: Point, radius: number, glow = false): void {
  ctx.save();
  if (glow) {
    ctx.fillStyle = 'rgba(255,214,74,0.55)';
    ctx.beginPath();
    ctx.arc(at.x, at.y, radius + 9, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = glow ? '#e0a020' : INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(at.x, at.y, radius, 0, TAU);
  ctx.fill();
  ctx.stroke();
  // A fraction is three characters: smaller, so it stays inside the tag.
  ctx.font = hand(700, radius * (text.length > 2 ? 0.78 : 1.2));
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = INK;
  ctx.fillText(text, at.x, at.y + 1);
  ctx.restore();
}

/** Where the n-th of what is left to share lies on the grass: in even rows of up to ten. */
export function poolSpot(index: number, count: number): Point {
  const perRow = 10;
  const rows = Math.ceil(count / perRow);
  const row = Math.floor(index / perRow);
  const inRow = index % perRow;
  const x = POOL.x - (POOL.gap * (perRow - 1)) / 2 + inRow * POOL.gap;
  return { x, y: POOL.y + (row - (rows - 1) / 2) * (POOL.gap + 4) };
}

export function drawPool(ctx: CanvasRenderingContext2D, sprites: Sprites, treat: TreatId, count: number): void {
  for (let index = 0; index < count; index += 1) drawCentred(ctx, sprites, treat, poolSpot(index, count), POOL.size);
}

export function drawBasket(ctx: CanvasRenderingContext2D, sprites: Sprites, left: number): void {
  drawStanding(ctx, sprites, 'basket', { x: BASKET.x, y: BASKET.y + 70 }, BASKET.scale, { fallback: '#c9873e' });
  drawTag(ctx, String(left), { x: BASKET.x + 62, y: BASKET.y - 54 }, 26);
}

/** The dial, with its number written in its face. */
/**
 * How many each friend gets per share: the number, big, with the treat and
 * "each" under it, between a minus and a plus. Tapping its left half takes
 * one away, its right half adds one.
 */
export function drawDial(
  ctx: CanvasRenderingContext2D,
  sprites: Sprites,
  value: number,
  treat: TreatId,
  pulse: number,
  limits: { least: boolean; most: boolean },
): void {
  ctx.save();
  ctx.translate(DIAL.x, DIAL.y);
  const width = DIAL.halfWidth * 2;
  const height = DIAL.halfHeight * 2;
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#2f6fd6';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.roundRect?.(-width / 2, -height / 2, width, height, 28);
  ctx.fill();
  ctx.stroke();
  // Minus and plus, either side.
  for (const [side, sign, faded] of [[-1, '−', limits.least], [1, '+', limits.most]] as const) {
    ctx.save();
    ctx.globalAlpha = faded ? 0.35 : 1;
    ctx.fillStyle = '#3f8fe0';
    ctx.beginPath();
    ctx.arc(side * (DIAL.halfWidth - 32), 0, 26, 0, TAU);
    ctx.fill();
    ctx.font = hand(700, 44);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(sign, side * (DIAL.halfWidth - 32), 2);
    ctx.restore();
  }
  const grow = 1 + pulse * 0.15;
  ctx.save();
  ctx.translate(0, -14);
  ctx.scale(grow, grow);
  ctx.font = hand(700, 54);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#1f3f7f';
  ctx.fillText(String(value), 0, 2);
  ctx.restore();
  drawCentred(ctx, sprites, treat, { x: -22, y: 34 }, 26);
  ctx.font = hand(700, 20);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#1f3f7f';
  ctx.fillText('each', -6, 35);
  ctx.restore();
}

export function drawShare(ctx: CanvasRenderingContext2D, sprites: Sprites, enabled: boolean, label = 'Share'): void {
  const image = sprites.share;
  ctx.save();
  ctx.globalAlpha = enabled ? 1 : 0.55;
  ctx.translate(SHARE.x, SHARE.y);
  if (image && label === 'Share') {
    ctx.drawImage(image, (-image.width * SHARE.scale) / 2, (-image.height * SHARE.scale) / 2, image.width * SHARE.scale, image.height * SHARE.scale);
  } else {
    ctx.fillStyle = '#3f8fe0';
    ctx.beginPath();
    ctx.roundRect?.(-SHARE.halfWidth, -SHARE.halfHeight, SHARE.halfWidth * 2, SHARE.halfHeight * 2, SHARE.halfHeight);
    ctx.fill();
    ctx.font = hand(700, 36);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(label, 0, 2);
  }
  ctx.restore();
}

/** The whole pizza or cake on the table, and the cuts made in it so far. */
export function drawFood(ctx: CanvasRenderingContext2D, sprites: Sprites, food: FoodId, cuts: readonly number[], flash: { angle: number; miss: Point; life: number } | null): void {
  const image = sprites[food];
  const shape = FOOD[food];
  ctx.save();
  if (image) {
    // A pizza is all top, centred on its oval; a cake is drawn so that its
    // top, the face that is cut, is the oval.
    const width = shape.rx * (food === 'pizza' ? 2.05 : 2.12);
    const scale = width / image.width;
    const height = image.height * scale;
    const top = food === 'pizza' ? shape.y - height / 2 : shape.y - height * CAKE_TOP;
    ctx.drawImage(image, shape.x - width / 2, top, width, height);
  } else {
    ctx.fillStyle = food === 'pizza' ? '#f0a840' : '#f7b8c8';
    ctx.beginPath();
    ctx.ellipse?.(shape.x, shape.y, shape.rx, shape.ry, 0, 0, TAU);
    ctx.fill();
  }
  ctx.lineCap = 'round';
  for (const angle of cuts) {
    const a = fromFood(food, { x: Math.cos(angle) * 1.02, y: Math.sin(angle) * 1.02 });
    const b = fromFood(food, { x: -Math.cos(angle) * 1.02, y: -Math.sin(angle) * 1.02 });
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(30,42,56,0.45)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  if (flash && flash.life < 1) {
    // A cut that missed the middle: drawn where it went, red, and fading.
    const a = fromFood(food, { x: flash.miss.x - Math.cos(flash.angle) * 1.1, y: flash.miss.y - Math.sin(flash.angle) * 1.1 });
    const b = fromFood(food, { x: flash.miss.x + Math.cos(flash.angle) * 1.1, y: flash.miss.y + Math.sin(flash.angle) * 1.1 });
    ctx.globalAlpha = 1 - flash.life;
    ctx.strokeStyle = '#e8543f';
    ctx.lineWidth = 6;
    ctx.setLineDash?.([14, 10]);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.setLineDash?.([]);
  }
  ctx.restore();
}

/** How far down the cake picture the middle of its top is: the top is the face that is cut. */
const CAKE_TOP = 0.28;

/** A piece of pizza or cake on a friend's plate. */
export function drawPiece(ctx: CanvasRenderingContext2D, sprites: Sprites, food: FoodId, seat: Point): void {
  drawCentred(ctx, sprites, food === 'pizza' ? 'pizza-half' : 'cake-slice', { x: seat.x, y: seat.y - 22 }, food === 'pizza' ? 92 : 70);
}

/** A soft "?" over a friend who can see a share would not go round. */
export function drawQuestion(ctx: CanvasRenderingContext2D, at: Point): void {
  ctx.save();
  ctx.font = hand(700, 46);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#ffffff';
  ctx.strokeText('?', at.x, at.y);
  ctx.fillStyle = '#3f8fe0';
  ctx.fillText('?', at.x, at.y);
  ctx.restore();
}
