import { hand, type Bounds, type Point } from '@bundle/core';
import { ITEMS, SPECIES, weightColour, type ItemId } from '../logic/species.js';
import { BAY, sizeOf, type What } from '../logic/world.js';
import { BUCKET, LAYOUT, RIG, rigOrigin, TIMER } from './geometry.js';
import type { Sprites } from './sprites.js';

const INK = '#1e2a38';
const TAU = Math.PI * 2;

/** The painted backdrop's own size, and where its waterline is. */
const BACKDROP = { width: 830, height: 315 } as const;

/** Above the water: the painted lake and hills, its waterline on ours. */
export function drawBackdrop(ctx: CanvasRenderingContext2D, bounds: Bounds, sprites: Sprites): void {
  ctx.save();
  const sky = ctx.createLinearGradient(0, bounds.top, 0, BAY.surfaceY);
  sky.addColorStop(0, '#7fc8f2');
  sky.addColorStop(1, '#d6f0ff');
  ctx.fillStyle = sky;
  ctx.fillRect(bounds.left, bounds.top, bounds.right - bounds.left, BAY.surfaceY - bounds.top);
  const image = sprites.backdrop;
  if (image) {
    const width = bounds.right - bounds.left;
    const scale = Math.max(width / BACKDROP.width, (BAY.surfaceY - bounds.top) / BACKDROP.height);
    const drawnWidth = BACKDROP.width * scale;
    const left = (bounds.left + bounds.right) / 2 - drawnWidth / 2;
    ctx.drawImage(image, left, BAY.surfaceY - BACKDROP.height * scale, drawnWidth, BACKDROP.height * scale);
  } else {
    // The hills, in the painting's greens, until the painting arrives.
    ctx.fillStyle = '#6fb37a';
    ctx.beginPath();
    ctx.moveTo(bounds.left, BAY.surfaceY);
    for (let x = bounds.left; x <= bounds.right; x += 40) ctx.lineTo(x, BAY.surfaceY - 60 - Math.sin(x / 120) * 30);
    ctx.lineTo(bounds.right, BAY.surfaceY);
    ctx.fill();
  }
  ctx.restore();
}

/** Under the water: deepening blue, light from above, sand and weed below. */
export function drawWater(ctx: CanvasRenderingContext2D, bounds: Bounds, clock: number, sprites: Sprites): void {
  ctx.save();
  const water = ctx.createLinearGradient(0, BAY.surfaceY, 0, bounds.bottom);
  water.addColorStop(0, '#47b3dc');
  water.addColorStop(0.45, '#2786c0');
  water.addColorStop(1, '#155888');
  ctx.fillStyle = water;
  ctx.fillRect(bounds.left, BAY.surfaceY, bounds.right - bounds.left, bounds.bottom - BAY.surfaceY);

  // Shafts of light, swaying slowly.
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  for (let shaft = 0; shaft < 6; shaft += 1) {
    const x = 90 + shaft * 200 + Math.sin(clock * 0.3 + shaft) * 30;
    ctx.beginPath();
    ctx.moveTo(x, BAY.surfaceY);
    ctx.lineTo(x + 70, BAY.surfaceY);
    ctx.lineTo(x + 170, BAY.floorY);
    ctx.lineTo(x + 40, BAY.floorY);
    ctx.closePath();
    ctx.fill();
  }

  // The sand.
  const sand = ctx.createLinearGradient(0, BAY.sandY + 10, 0, bounds.bottom);
  sand.addColorStop(0, '#e9d39a');
  sand.addColorStop(1, '#c9a96a');
  ctx.fillStyle = sand;
  ctx.beginPath();
  ctx.moveTo(bounds.left, bounds.bottom);
  for (let x = bounds.left; x <= bounds.right + 40; x += 40) ctx.lineTo(x, BAY.sandY + 26 + Math.sin(x / 140) * 8);
  ctx.lineTo(bounds.right, bounds.bottom);
  ctx.closePath();
  ctx.fill();

  const props: { name: 'rocks' | 'seaweed' | 'barrel'; x: number; scale: number }[] = [
    { name: 'rocks', x: 40, scale: 1.1 },
    { name: 'seaweed', x: 250, scale: 1.0 },
    { name: 'barrel', x: 560, scale: 0.8 },
    { name: 'seaweed', x: 820, scale: 0.8 },
    { name: 'rocks', x: 1010, scale: 0.9 },
  ];
  for (const prop of props) {
    const image = sprites[prop.name];
    if (!image) continue;
    const width = image.width * prop.scale;
    const height = image.height * prop.scale;
    ctx.drawImage(image, prop.x, BAY.floorY - height + 6, width, height);
  }

  // Bubbles, rising and wrapping.
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = 2;
  for (let bubble = 0; bubble < 14; bubble += 1) {
    const span = BAY.floorY - BAY.surfaceY;
    const y = BAY.floorY - ((clock * (22 + (bubble % 4) * 9) + bubble * 97) % span);
    const x = ((bubble * 173) % 1100) + 30 + Math.sin(clock * 1.3 + bubble) * 8;
    ctx.beginPath();
    ctx.arc(x, y, 3 + (bubble % 3) * 2, 0, TAU);
    ctx.stroke();
  }
  ctx.restore();
}

/** The surface itself: a bright wavy edge drawn over the hull's foot, so the boat sits in the water. */
export function drawSurface(ctx: CanvasRenderingContext2D, bounds: Bounds, clock: number): void {
  ctx.save();
  ctx.fillStyle = 'rgba(71,179,220,0.55)';
  ctx.beginPath();
  ctx.moveTo(bounds.left, BAY.surfaceY + 14);
  for (let x = bounds.left; x <= bounds.right + 20; x += 20) ctx.lineTo(x, BAY.surfaceY + Math.sin(x / 38 + clock * 2) * 3);
  ctx.lineTo(bounds.right, BAY.surfaceY + 14);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let x = bounds.left; x <= bounds.right + 20; x += 20) {
    const y = BAY.surfaceY + Math.sin(x / 38 + clock * 2) * 3;
    if (x === bounds.left) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();
}

export function drawBuoy(ctx: CanvasRenderingContext2D, sprites: Sprites, x: number, clock: number): void {
  const image = sprites.buoy;
  if (!image) return;
  const bob = Math.sin(clock * 1.7) * 3;
  ctx.drawImage(image, x - image.width / 2, BAY.surfaceY - image.height + 14 + bob);
}

/** A gull crossing the sky now and then. */
export function drawSeagull(ctx: CanvasRenderingContext2D, sprites: Sprites, bounds: Bounds, clock: number): void {
  const image = sprites.seagull;
  if (!image) return;
  const period = 26;
  const t = (clock % period) / 10;
  if (t > 1) return;
  const x = bounds.right + 60 - t * (bounds.right - bounds.left + 160);
  const y = 120 + Math.sin(t * 6) * 16;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(-0.8, 0.8);
  ctx.drawImage(image, -image.width / 2, -image.height / 2);
  ctx.restore();
}

export interface RigPose {
  hookX: number;
  /** Lean, radians, clockwise: towards the line. */
  angle: number;
  /** How far the hull sits down in the water: a fuller bucket, a heavier boat. */
  sink: number;
  /** Drawn without the fisherman: he has gone over the side. */
  overboard: boolean;
  /** A happy hop when the bucket is full. */
  hop: number;
}

/** The boat and the fisherman standing in it, leaning together. */
export function drawRig(ctx: CanvasRenderingContext2D, sprites: Sprites, pose: RigPose): void {
  const origin = rigOrigin(pose.hookX, pose.sink);
  const s = RIG.scale;
  ctx.save();
  ctx.translate(origin.x + RIG.pivot.x * s, origin.y + RIG.pivot.y * s);
  ctx.rotate(pose.angle);
  ctx.translate(-RIG.pivot.x * s, -RIG.pivot.y * s);
  ctx.scale(s, s);
  if (!pose.overboard) {
    const fisherman = sprites.fisherman;
    if (fisherman) ctx.drawImage(fisherman, RIG.fisherman.x, RIG.fisherman.y - pose.hop);
    else drawFallbackFisherman(ctx, pose.hop);
  }
  const boat = sprites.boat;
  if (boat) {
    // Flipped, so the motor is at the stern behind him and the bow points where he fishes.
    ctx.save();
    ctx.translate(RIG.boat.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(boat, 0, 0);
    ctx.restore();
  } else {
    ctx.fillStyle = '#b7814a';
    ctx.beginPath();
    ctx.moveTo(0, 60);
    ctx.lineTo(RIG.boat.width, 60);
    ctx.lineTo(RIG.boat.width - 30, RIG.boat.height);
    ctx.lineTo(30, RIG.boat.height);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawFallbackFisherman(ctx: CanvasRenderingContext2D, hop: number): void {
  ctx.save();
  ctx.translate(0, -hop);
  ctx.fillStyle = '#e0533f';
  ctx.fillRect(100, -20, 60, 90);
  ctx.fillStyle = '#f6c9a0';
  ctx.beginPath();
  ctx.arc(130, -40, 26, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#7a5230';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(150, 40);
  ctx.lineTo(RIG.rodTip.x, RIG.rodTip.y);
  ctx.stroke();
  ctx.restore();
}

/** The fisherman in the water after the boat goes over: just his head and shoulders, bobbing. */
export function drawSwimmer(ctx: CanvasRenderingContext2D, sprites: Sprites, at: Point, clock: number): void {
  const image = sprites.fisherman;
  ctx.save();
  ctx.beginPath();
  ctx.rect(at.x - 200, at.y - 400, 400, 400 + 18);
  ctx.clip();
  const bob = Math.sin(clock * 3) * 4;
  if (image) {
    const s = RIG.scale;
    ctx.drawImage(image, at.x - (image.width * s) / 2, at.y - 95 * s + bob, image.width * s, image.height * s);
  } else {
    ctx.fillStyle = '#f6c9a0';
    ctx.beginPath();
    ctx.arc(at.x, at.y - 20 + bob, 22, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

/** The line from the rod tip to the hook: slack when light, taut when something heavy pulls. */
export function drawLine(ctx: CanvasRenderingContext2D, from: Point, to: Point, tension: number, clock: number): void {
  const slack = (1 - Math.min(1, tension)) * 22;
  const shiver = tension > 0.3 ? Math.sin(clock * 40) * tension * 1.5 : 0;
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.quadraticCurveTo((from.x + to.x) / 2 + slack + shiver, (from.y + to.y) / 2, to.x + shiver, to.y);
  ctx.stroke();
  ctx.restore();
}

/** The hook: a silver J under a red and white float weight. Wider when the net is on. */
export function drawHook(ctx: CanvasRenderingContext2D, at: Point, net: boolean): void {
  ctx.save();
  ctx.translate(at.x, at.y);
  if (net) {
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.setLineDash?.([6, 6]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 10, 44, 0, TAU);
    ctx.stroke();
    ctx.setLineDash?.([]);
  }
  ctx.fillStyle = '#e8543f';
  ctx.beginPath();
  ctx.arc(0, -8, 7, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(0, -8, 7, 0, Math.PI);
  ctx.fill();
  ctx.strokeStyle = '#d9e2ea';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, -1);
  ctx.lineTo(0, 16);
  ctx.arc(-8, 16, 8, 0, Math.PI * 0.9);
  ctx.stroke();
  ctx.restore();
}

/** The number a fish wears: a white disc ringed in its weight's colour. */
export function drawTag(ctx: CanvasRenderingContext2D, at: Point, weight: number, radius: number): void {
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = weightColour(weight);
  ctx.lineWidth = Math.max(3, radius * 0.22);
  ctx.beginPath();
  ctx.arc(at.x, at.y, radius, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.font = hand(700, radius * (weight >= 10 ? 1.15 : 1.45));
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(weight), at.x, at.y + 1);
  ctx.restore();
}

export interface CreaturePose {
  what: What;
  at: Point;
  dir: 1 | -1;
  /** On the hook: hanging head up and wriggling. */
  hooked: boolean;
  clock: number;
  phase: number;
  /** Shrinks a fish flying into the bucket. */
  scale?: number;
  /** Fades one leaving. */
  alpha?: number;
  /** Draw only the picture or only the number: numbers go on top of every body, so none is hidden. */
  part?: 'body' | 'tag';
}

/** Species drawn from the front never turn to hang; side-on fish hang head up. */
const FRONT_ON = new Set(['crab', 'puffer', 'jellyfish']);

/** A fish or an item, from its picture, wearing its number if it has one. */
export function drawCreature(ctx: CanvasRenderingContext2D, sprites: Sprites, pose: CreaturePose): void {
  const { what } = pose;
  const { length, height } = sizeOf(what);
  const scale = pose.scale ?? 1;
  const name = what.kind === 'fish' ? what.species : what.item;
  const image = sprites[name];
  const weight = what.kind === 'fish' ? SPECIES[what.species].weight : 0;

  if (pose.part !== 'tag') {
    ctx.save();
    ctx.globalAlpha = pose.alpha ?? 1;
    ctx.translate(pose.at.x, pose.at.y);
    ctx.scale(scale, scale);

    let turn = 0;
    if (pose.hooked) {
      // Heavier fish wriggle slower, and further.
      const speed = 16 - Math.min(10, weight);
      const wriggle = Math.sin(pose.clock * speed + pose.phase) * (0.18 + weight * 0.015);
      turn = (FRONT_ON.has(name) || what.kind === 'item' ? 0 : -pose.dir * Math.PI * 0.45) + wriggle;
    } else if (what.kind === 'fish') {
      turn = Math.sin(pose.clock * 3 + pose.phase) * 0.04;
    } else if (what.item !== 'treasure') {
      turn = Math.sin(pose.clock * 1.2 + pose.phase) * 0.15;
    }
    ctx.rotate(turn);
    if (pose.dir === -1 && what.kind === 'fish') ctx.scale(-1, 1);
    // Jellyfish pulse; everything else is drawn as painted.
    const pulse = what.kind === 'fish' && what.species === 'jellyfish' ? 1 + Math.sin(pose.clock * 2.4 + pose.phase) * 0.05 : 1;
    if (image) {
      ctx.drawImage(image, (-length / 2) * pulse, -height / 2 / pulse, length * pulse, height / pulse);
    } else {
      ctx.fillStyle = what.kind === 'fish' ? weightColour(weight) : '#f2c94c';
      ctx.beginPath();
      ctx.ellipse?.(0, 0, length / 2, height / 2, 0, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }
  if (pose.part === 'body') return;

  if (what.kind === 'fish') {
    // The tag stays level and readable, whichever way the fish is turned.
    const radius = Math.max(15, Math.min(23, height * 0.24)) * scale;
    const back = pose.hooked ? 0 : -pose.dir * length * 0.06 * scale;
    ctx.save();
    ctx.globalAlpha = pose.alpha ?? 1;
    drawTag(ctx, { x: pose.at.x + back, y: pose.at.y + (pose.hooked ? 0 : height * 0.04) }, weight, radius);
    ctx.restore();
  } else if (what.item !== 'treasure') {
    drawGlint(ctx, pose.at, length, pose.clock + pose.phase);
  }
}

/** A good thing glints, so it reads as a thing to get rather than scenery. */
function drawGlint(ctx: CanvasRenderingContext2D, at: Point, size: number, clock: number): void {
  const t = (clock * 0.8) % 1;
  if (t > 0.35) return;
  const glow = Math.sin((t / 0.35) * Math.PI);
  ctx.save();
  ctx.translate(at.x + size * 0.3, at.y - size * 0.45);
  ctx.fillStyle = `rgba(255,255,255,${0.9 * glow})`;
  ctx.beginPath();
  for (let point = 0; point < 8; point += 1) {
    const angle = (point * Math.PI) / 4;
    const reach = point % 2 === 0 ? 11 * glow : 3;
    ctx.lineTo(Math.cos(angle) * reach, Math.sin(angle) * reach);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** A small picture of an item, for the row of things held under the bucket. */
export function drawItemIcon(ctx: CanvasRenderingContext2D, sprites: Sprites, item: ItemId, at: Point, height: number): void {
  const image = sprites[item];
  const width = height / ITEMS[item].aspect;
  if (image) {
    ctx.drawImage(image, at.x - width / 2, at.y - height / 2, width, height);
    return;
  }
  ctx.save();
  ctx.fillStyle = '#b48ee0';
  ctx.beginPath();
  ctx.arc(at.x, at.y, height / 2, 0, TAU);
  ctx.fill();
  ctx.restore();
}

export interface BucketModel {
  total: number;
  capacity: number;
  /** A bump as a fish lands, 0..1. */
  bump: number;
  over: boolean;
}

/**
 * The bucket: big, top left, with the count written in its mouth and the
 * water inside rising as it fills. It is the goal, so it is the biggest thing
 * on the screen that is not the sea.
 */
export function drawBucket(ctx: CanvasRenderingContext2D, sprites: Sprites, model: BucketModel): void {
  const { x, y, scale } = LAYOUT.bucket;
  const grow = 1 + model.bump * 0.08;
  ctx.save();
  ctx.translate(x + (BUCKET.width * scale) / 2, y + (BUCKET.height * scale) / 2);
  ctx.scale(scale * grow, scale * grow);
  ctx.translate(-BUCKET.width / 2, -BUCKET.height / 2);

  const image = sprites.bucket;
  if (image) ctx.drawImage(image, 0, 0);
  else {
    ctx.fillStyle = '#2f7fd0';
    ctx.fillRect(BUCKET.body.topLeft, 10, BUCKET.body.topRight - BUCKET.body.topLeft, BUCKET.body.bottom - 10);
  }

  // The fill, rising in the body.
  const share = Math.max(0, Math.min(1, model.total / Math.max(1, model.capacity)));
  if (share > 0) {
    const body = BUCKET.body;
    const level = body.bottom - (body.bottom - body.top) * share;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(body.topLeft, body.top);
    ctx.lineTo(body.topRight, body.top);
    ctx.lineTo(body.bottomRight, body.bottom);
    ctx.lineTo(body.bottomLeft, body.bottom);
    ctx.closePath();
    ctx.clip();
    ctx.fillStyle = model.over ? 'rgba(232,84,63,0.6)' : 'rgba(140,220,255,0.55)';
    ctx.fillRect(0, level, BUCKET.width, body.bottom - level + 4);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, level);
    ctx.lineTo(BUCKET.width, level);
    ctx.stroke();
    ctx.restore();
  }

  const { opening } = BUCKET;
  const text = `${model.total}/${model.capacity}`;
  ctx.font = hand(700, text.length > 4 ? 28 : 32);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = model.over ? '#ff8a7a' : '#ffffff';
  ctx.fillText(text, opening.x, opening.y + 2);
  ctx.restore();
}

export interface TimerModel {
  timeLeft: number;
  seconds: number;
  /** Pulses on each of the last ticks, 0..1. */
  pulse: number;
}

export const clockText = (seconds: number): string => {
  const whole = Math.ceil(Math.max(0, seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
};

/** The stopwatch, top right: a wedge of time left that drains, and the time in its face. */
export function drawTimer(ctx: CanvasRenderingContext2D, sprites: Sprites, model: TimerModel): void {
  const { x, y, scale } = LAYOUT.timer;
  const grow = 1 + model.pulse * 0.1;
  ctx.save();
  ctx.translate(x + (TIMER.width * scale) / 2, y + (TIMER.height * scale) / 2);
  ctx.scale(scale * grow, scale * grow);
  ctx.translate(-TIMER.width / 2, -TIMER.height / 2);
  const image = sprites.timer;
  const { face } = TIMER;
  if (image) ctx.drawImage(image, 0, 0);
  else {
    ctx.fillStyle = '#f2b632';
    ctx.beginPath();
    ctx.arc(face.x, face.y, face.r + 8, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#fcf0d4';
    ctx.beginPath();
    ctx.arc(face.x, face.y, face.r, 0, TAU);
    ctx.fill();
  }
  const share = Math.max(0, Math.min(1, model.timeLeft / Math.max(1, model.seconds)));
  const low = model.timeLeft <= 10;
  ctx.fillStyle = low ? 'rgba(232,84,63,0.75)' : share < 0.35 ? 'rgba(240,163,46,0.6)' : 'rgba(92,184,92,0.5)';
  ctx.beginPath();
  ctx.moveTo(face.x, face.y);
  ctx.arc(face.x, face.y, face.r - 4, -Math.PI / 2, -Math.PI / 2 + TAU * share);
  ctx.closePath();
  ctx.fill();
  ctx.font = hand(700, 30);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 5;
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  const text = clockText(model.timeLeft);
  ctx.strokeText(text, face.x, face.y + 2);
  ctx.fillStyle = low ? '#c0392b' : INK;
  ctx.fillText(text, face.x, face.y + 2);
  ctx.restore();
}

/** The big round button that drops the hook. */
export function drawHookButton(ctx: CanvasRenderingContext2D, ready: boolean, beckon: number): void {
  const { x, y, r } = LAYOUT.hookButton;
  ctx.save();
  if (beckon > 0) {
    ctx.strokeStyle = `rgba(255,255,255,${0.8 * (1 - beckon)})`;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(x, y, r + 8 + beckon * 30, 0, TAU);
    ctx.stroke();
  }
  ctx.globalAlpha = ready ? 1 : 0.5;
  ctx.fillStyle = '#ffcc3a';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x + 8, y - 32);
  ctx.lineTo(x + 8, y + 10);
  ctx.arc(x - 6, y + 10, 14, 0, Math.PI * 0.95);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - 20, y + 12);
  ctx.lineTo(x - 26, y + 2);
  ctx.stroke();
  ctx.restore();
}

/** Drops of water flung up where something meets the surface. */
export function drawSplash(ctx: CanvasRenderingContext2D, at: Point, progress: number, size: number): void {
  if (progress >= 1) return;
  ctx.save();
  ctx.fillStyle = `rgba(255,255,255,${0.85 * (1 - progress)})`;
  for (let drop = 0; drop < 9; drop += 1) {
    const angle = Math.PI + (drop / 8) * Math.PI;
    const reach = size * (0.4 + progress);
    const x = at.x + Math.cos(angle) * reach;
    const y = at.y + Math.sin(angle) * reach * 1.3 + progress * progress * size * 1.4;
    ctx.beginPath();
    ctx.arc(x, y, 5 * (1 - progress) + 2, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}
