import { hand, type Bounds, type Point } from '@bundle/core';
import type { FoodId, FriendId, Mood, TreatId } from '../logic/friends.js';
import { BASKET, DIAL, FENCE, FOOD, FRIEND, fromFood, POOL, SHARE, SKY, TABLE } from './geometry.js';
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

/** Sky, the fence along the back, and grass to the edges of the screen. */
export function drawPark(ctx: CanvasRenderingContext2D, sprites: Sprites, bounds: Bounds): void {
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

/** A friend behind the table, their plate where it rests on it. */
export function drawFriend(ctx: CanvasRenderingContext2D, sprites: Sprites, friend: FriendId, mood: Mood, seat: Point, bob = 0): void {
  drawStanding(ctx, sprites, `${friend}-${mood}`, { x: seat.x, y: seat.y + 12 - bob }, FRIEND.scale, { fallback: '#b07a4a' });
}

export function drawChair(ctx: CanvasRenderingContext2D, sprites: Sprites, seat: Point, alpha = 1): void {
  drawStanding(ctx, sprites, 'chair', { x: seat.x, y: seat.y - 8 }, 0.92, { alpha, fallback: '#3f6fd6' });
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

/** Where the n-th of what is left to share lies on the grass: in rows of five, so it can be counted. */
export function poolSpot(index: number, count: number): Point {
  const perRow = 10;
  const rows = Math.ceil(count / perRow);
  const row = Math.floor(index / perRow);
  const inRow = index % perRow;
  const width = POOL.gap * (perRow - 1) + POOL.groupGap;
  const x = POOL.x - width / 2 + inRow * POOL.gap + (inRow >= 5 ? POOL.groupGap : 0);
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
export function drawDial(ctx: CanvasRenderingContext2D, sprites: Sprites, value: number, pulse: number): void {
  const image = sprites.dial;
  ctx.save();
  ctx.translate(DIAL.x, DIAL.y);
  const grow = 1 + pulse * 0.06;
  ctx.scale(grow, grow);
  if (image) {
    ctx.drawImage(image, (-image.width * DIAL.scale) / 2, (-image.height * DIAL.scale) / 2, image.width * DIAL.scale, image.height * DIAL.scale);
  } else {
    ctx.fillStyle = '#2f6fd6';
    ctx.beginPath();
    ctx.arc(0, 0, 60, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, 44, 0, TAU);
    ctx.fill();
  }
  ctx.font = hand(700, 54);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#1f3f7f';
  ctx.fillText(String(value), 0, 8);
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
