import { hand, type Point } from '@bundle/core';
import { BACKDROP, FLOOR, QUEUE, TRAIN, type TrackPlace } from './geometry.js';
import type { SpriteName, Sprites } from './sprites.js';

const INK = '#1e2a38';
const TAU = Math.PI * 2;
export const TRAIN_SPRITES: readonly SpriteName[] = ['train-red', 'train-blue', 'train-green'];
const TRAIN_COLOURS = ['#d8443a', '#2f6fd6', '#3e9a3e'];

/** The painted yard across the top, and the drawn floor below it, edge to edge. */
export function drawYard(ctx: CanvasRenderingContext2D, sprites: Sprites, left: number, right: number, bottom: number, top = 0): void {
  ctx.fillStyle = FLOOR.colour;
  ctx.fillRect(left, FLOOR.top, right - left, bottom - FLOOR.top);
  ctx.fillStyle = FLOOR.kerb;
  ctx.fillRect(left, FLOOR.top, right - left, 6);
  const image = sprites.backdrop;
  const height = BACKDROP.height * BACKDROP.scale;
  if (image) {
    ctx.drawImage(image, 0, 0, 1152, height);
    // On a screen wider than the design, the outermost pixels are stretched out
    // to the edges: a soft continuation, never a bar, and no landmark repeated.
    if (left < 0) ctx.drawImage(image, 0, 0, 2, image.height, left, 0, -left, height);
    if (right > 1152) ctx.drawImage(image, image.width - 2, 0, 2, image.height, 1152, 0, right - 1152, height);
    ctx.fillStyle = '#7cc3ea';
    if (top < 0) ctx.fillRect(left, top, right - left, -top);
  } else {
    ctx.fillStyle = '#7cc3ea';
    ctx.fillRect(left, 0, right - left, FLOOR.top);
  }
}

/** The belt the queue rides on, from the port to the marker. */
export function drawBelt(ctx: CanvasRenderingContext2D, clock: number): void {
  const top = QUEUE.y - QUEUE.crate / 2 + 6;
  ctx.save();
  ctx.fillStyle = '#3b3f48';
  ctx.fillRect(40, top + QUEUE.crate - 12, QUEUE.markerX - 40, 22);
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 2;
  const shift = (clock * 30) % 24;
  for (let x = 40 + shift; x < QUEUE.markerX; x += 24) {
    ctx.beginPath();
    ctx.moveTo(x, top + QUEUE.crate - 10);
    ctx.lineTo(x, top + QUEUE.crate + 8);
    ctx.stroke();
  }
  ctx.restore();
}

/** One crate: its picture for its weight, and its number on a white disc so it can always be read. */
export function drawCrate(ctx: CanvasRenderingContext2D, sprites: Sprites, weight: number, at: Point, size: number, tint: string | null = null): void {
  const image = sprites[`cargo-${Math.min(10, Math.max(1, weight)) as 1}`];
  ctx.save();
  ctx.translate(at.x, at.y);
  if (image) ctx.drawImage(image, -size / 2, -size / 2, size, size);
  else {
    ctx.fillStyle = '#c98a4b';
    ctx.fillRect(-size / 2, -size / 2, size, size);
  }
  if (tint) {
    ctx.fillStyle = tint;
    ctx.fillRect(-size / 2, -size / 2, size, size);
  }
  const radius = size * 0.26;
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, size * 0.08, radius, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.font = hand(700, radius * 1.45);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = INK;
  ctx.fillText(String(weight), 0, size * 0.08 + 1);
  ctx.restore();
}

export interface TrainPose {
  track: number;
  place: TrackPlace;
  /** Its middle. */
  x: number;
  /** Radians: a broken train sits askew. */
  tilt: number;
  /** Crates in the wagon, by weight. */
  load: readonly number[];
  alpha?: number;
}

/** A train on its track, facing right, its crates riding on top of the wagon. */
export function drawTrain(ctx: CanvasRenderingContext2D, sprites: Sprites, pose: TrainPose): void {
  const image = sprites[TRAIN_SPRITES[pose.track]!];
  ctx.save();
  ctx.globalAlpha = pose.alpha ?? 1;
  ctx.translate(pose.x, pose.place.railY);
  ctx.rotate(pose.tilt);
  if (image) ctx.drawImage(image, -TRAIN.width / 2, -TRAIN.height, TRAIN.width, TRAIN.height);
  else {
    ctx.fillStyle = TRAIN_COLOURS[pose.track]!;
    ctx.fillRect(-TRAIN.width / 2, -TRAIN.height, TRAIN.width, TRAIN.height - 12);
  }
  // The wagon is the back (left) half; its crates ride on its roof, three to a row.
  pose.load.forEach((weight, index) => {
    const column = index % 3;
    const row = Math.floor(index / 3);
    drawCrate(ctx, sprites, weight, { x: -TRAIN.width * 0.38 + column * 38, y: -TRAIN.height * 0.84 - 17 - row * 32 }, 36);
  });
  ctx.restore();
}

/** Puffs from the chimney, drifting up: pale steam leaving, dark smoke broken. */
export function drawSmoke(ctx: CanvasRenderingContext2D, at: Point, clock: number, colour = '#9aa0a8'): void {
  ctx.save();
  for (let puff = 0; puff < 5; puff += 1) {
    const t = (clock * 0.6 + puff / 5) % 1;
    ctx.globalAlpha = 0.8 * (1 - t * t);
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.arc(at.x + Math.sin(puff * 1.7 + clock) * 16 - t * 30, at.y - t * 110, 16 + t * 30, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

/** A sprite centred on a point at a height, or nothing if it has not loaded. */
export function drawSprite(ctx: CanvasRenderingContext2D, sprites: Sprites, name: SpriteName, at: Point, height: number, alpha = 1): void {
  const image = sprites[name];
  if (!image) return;
  const width = height * (image.width / Math.max(1, image.height));
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(image, at.x - width / 2, at.y - height / 2, width, height);
  ctx.restore();
}

/** A bar that fills: the sheet's progress bar for a train's load, the repair bar for a mend. */
export function drawBar(ctx: CanvasRenderingContext2D, at: Point, width: number, share: number, colour: string): void {
  ctx.save();
  ctx.fillStyle = 'rgba(30,42,56,0.55)';
  ctx.fillRect(at.x - width / 2, at.y - 7, width, 14);
  ctx.fillStyle = colour;
  ctx.fillRect(at.x - width / 2 + 2, at.y - 5, (width - 4) * Math.max(0, Math.min(1, share)), 10);
  ctx.restore();
}
