import { hand, type Bounds, type Point } from '@bundle/core';
import { ITEMS, SPECIES, weightColour, type ItemId, type SpeciesId } from '../logic/species.js';
import { BAY, sizeOf, type What } from '../logic/world.js';
import { across, BUCKET, DEPTH, LAYOUT, RIG, TIMER, type RigPlace } from './geometry.js';
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

export interface BucketModel {
  total: number;
  capacity: number;
  /** A bump as a fish lands, 0..1. */
  bump: number;
  over: boolean;
  /** What is in it, so it can be seen poking out of the top. */
  fish: readonly SpeciesId[];
}

export interface RigPose {
  place: RigPlace;
  /** Drawn without the boy: he has gone over the side. */
  overboard: boolean;
  /** A happy hop when the bucket is full. */
  hop: number;
  bucket: BucketModel;
}

/** One of the boat's two pictures, flipped so the motor is at the stern behind him. */
function drawHull(ctx: CanvasRenderingContext2D, image: HTMLImageElement | null, front: boolean): void {
  if (image) {
    ctx.save();
    ctx.translate(RIG.boat.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(image, 0, 0);
    ctx.restore();
    return;
  }
  ctx.fillStyle = front ? '#c99258' : '#9c6b3c';
  ctx.beginPath();
  ctx.moveTo(0, front ? 70 : 50);
  ctx.lineTo(RIG.boat.width, front ? 70 : 50);
  ctx.lineTo(RIG.boat.width - 30, RIG.boat.height);
  ctx.lineTo(30, RIG.boat.height);
  ctx.closePath();
  ctx.fill();
}

/** The bucket in the boat, in its own pixels: its fill rising up its side, and the catch poking out of the top. */
function drawBucketInBoat(ctx: CanvasRenderingContext2D, sprites: Sprites, model: BucketModel, clock: number): void {
  const grow = 1 + model.bump * 0.1;
  ctx.save();
  ctx.translate(RIG.bucket.x, RIG.bucket.y);
  ctx.scale(RIG.bucket.scale, RIG.bucket.scale);
  ctx.translate(BUCKET.width / 2, BUCKET.height);
  ctx.scale(grow, grow);
  ctx.translate(-BUCKET.width / 2, -BUCKET.height);

  const image = sprites.bucket;
  if (image) ctx.drawImage(image, 0, 0);
  else {
    ctx.fillStyle = '#2f7fd0';
    ctx.fillRect(BUCKET.body.topLeft, 10, BUCKET.body.topRight - BUCKET.body.topLeft, BUCKET.body.bottom - 10);
  }

  // The catch, heads up out of the mouth: cut off by the front of the rim, so
  // it is in the bucket rather than stuck on its face.
  const shown = model.fish.slice(-8);
  const { opening } = BUCKET;
  ctx.save();
  ctx.beginPath();
  ctx.rect(-40, -200, BUCKET.width + 80, 200 + opening.y);
  ctx.ellipse?.(opening.x, opening.y, opening.rx - 4, opening.ry - 3, 0, 0, Math.PI);
  ctx.clip();
  shown.forEach((species, index) => {
    const fish = sprites[species];
    const across = opening.x + ((index % 4) - 1.5) * 22;
    const up = opening.y - 2 - Math.floor(index / 4) * 10;
    const length = 54;
    const height = length * SPECIES[species].aspect;
    ctx.save();
    ctx.translate(across, up);
    ctx.rotate(-Math.PI / 2 + Math.sin(clock * 3 + index * 1.7) * 0.18);
    if (fish) ctx.drawImage(fish, -length / 2, -height / 2, length, height);
    else {
      ctx.fillStyle = weightColour(SPECIES[species].weight);
      ctx.fillRect(-length / 2, -height / 2, length, height);
    }
    ctx.restore();
  });
  ctx.restore();

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
    ctx.fillStyle = model.over ? 'rgba(232,84,63,0.55)' : 'rgba(150,225,255,0.4)';
    ctx.fillRect(0, level, BUCKET.width, body.bottom - level + 4);
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, level);
    ctx.lineTo(BUCKET.width, level);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

/**
 * The boat with the boy sitting in it and the bucket at the stern. The boy and
 * the bucket go between the hull and its near wall, so they are in the boat
 * rather than in front of it. The whole rig leans together, and turning round
 * it swings through depth: narrower across, the far end higher, as a boat on
 * water seen from a little above would.
 */
export function drawRig(ctx: CanvasRenderingContext2D, sprites: Sprites, pose: RigPose, clock: number): void {
  const { place } = pose;
  const s = RIG.scale;
  ctx.save();
  ctx.translate(place.x, BAY.surfaceY + place.sink);
  ctx.rotate(place.angle * Math.cos(place.swing));
  ctx.transform(across(place.swing), -Math.sin(place.swing) * DEPTH, 0, 1, 0, 0);
  ctx.scale(s, s);
  ctx.translate(-RIG.pivot.x, -RIG.pivot.y);
  drawHull(ctx, sprites.boat, false);
  drawBucketInBoat(ctx, sprites, pose.bucket, clock);
  if (!pose.overboard) {
    const fisherman = sprites.fisherman;
    if (fisherman) ctx.drawImage(fisherman, RIG.fisherman.x, RIG.fisherman.y - pose.hop);
    else drawFallbackFisherman(ctx, pose.hop);
  }
  drawHull(ctx, sprites['boat-front'], true);
  ctx.restore();
}

/**
 * The water the boat disturbs: rings spreading round the hull while it turns,
 * and a V of wake trailing from the stern while it sails.
 */
export function drawWake(ctx: CanvasRenderingContext2D, x: number, swing: number, sailing: number, clock: number): void {
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 3;
  const turning = Math.sin(swing);
  if (turning > 0.02) {
    for (let ring = 0; ring < 3; ring += 1) {
      const grow = (clock * 1.4 + ring / 3) % 1;
      ctx.globalAlpha = turning * (1 - grow);
      ctx.beginPath();
      ctx.ellipse?.(x, BAY.surfaceY + 6, 120 + grow * 90, 12 + grow * 10, 0, 0, TAU);
      ctx.stroke();
    }
  }
  if (sailing !== 0) {
    // Behind the stern, opening out the way the boat has come from.
    const behind = -Math.sign(sailing);
    const stern = x + behind * 120;
    for (let streak = 0; streak < 4; streak += 1) {
      const age = (clock * 2 + streak / 4) % 1;
      ctx.globalAlpha = 0.8 * (1 - age);
      const along = stern + behind * age * 120;
      ctx.beginPath();
      ctx.moveTo(along - behind * 18, BAY.surfaceY + 4 - age * 3);
      ctx.lineTo(along + behind * 18, BAY.surfaceY + 4 - age * 10);
      ctx.moveTo(along - behind * 18, BAY.surfaceY + 10 + age * 3);
      ctx.lineTo(along + behind * 18, BAY.surfaceY + 12 + age * 10);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** The count, written on the bucket's side the right way round whichever way the boat faces. */
export function drawBucketCount(ctx: CanvasRenderingContext2D, model: BucketModel, at: Point): void {
  const text = `${model.total}/${model.capacity}`;
  const size = (text.length > 4 ? 30 : 36) * (1 + model.bump * 0.15);
  ctx.save();
  ctx.font = hand(700, size);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#123a6b';
  ctx.strokeText(text, at.x, at.y);
  ctx.fillStyle = model.over ? '#ffb3a6' : '#ffffff';
  ctx.fillText(text, at.x, at.y);
  ctx.restore();
}

function drawFallbackFisherman(ctx: CanvasRenderingContext2D, hop: number): void {
  ctx.save();
  ctx.translate(0, -hop);
  ctx.fillStyle = '#e0533f';
  ctx.fillRect(110, 0, 60, 90);
  ctx.fillStyle = '#f6c9a0';
  ctx.beginPath();
  ctx.arc(140, -20, 26, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#7a5230';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(160, 50);
  ctx.lineTo(RIG.rodTip.x, RIG.rodTip.y);
  ctx.stroke();
  ctx.restore();
}

/** How the boy goes under: a struggle at the surface, then down, then only bubbles. */
export const DROWN = {
  /** Seconds splashing with the water at his chin. */
  struggle: 1.5,
  /** Seconds going under. */
  sink: 1.3,
  /** Where his chin is, in his picture's own pixels: the water starts there. */
  chin: 100,
} as const;

/**
 * The boy in the water after the boat goes over, unhappy. He splashes with the
 * water at his chin, then sinks out of sight and leaves a trail of bubbles.
 * Everything below the surface is cut away, so he is in the water rather than
 * hanging in front of it.
 */
export function drawDrowning(ctx: CanvasRenderingContext2D, sprites: Sprites, x: number, t: number, clock: number): void {
  const image = sprites['fisherman-sad'] ?? sprites.fisherman;
  const s = RIG.scale;
  const struggling = t < DROWN.struggle;
  const under = Math.max(0, Math.min(1, (t - DROWN.struggle) / DROWN.sink));
  // While he struggles he bobs hard; as he sinks the water climbs over his hat.
  const bob = struggling ? Math.abs(Math.sin(t * 9)) * -10 : 0;
  const waterAt = DROWN.chin - under * (DROWN.chin + 20);
  const top = BAY.surfaceY - waterAt * s + bob;
  const tilt = struggling ? Math.sin(t * 7) * 0.12 : 0;

  if (under < 1) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x - 300, BAY.surfaceY - 400, 600, 400 + 2);
    ctx.clip();
    ctx.translate(x, BAY.surfaceY);
    ctx.rotate(tilt);
    ctx.translate(-x, -BAY.surfaceY);
    if (image) ctx.drawImage(image, x - (image.width * s) / 2, top, image.width * s, image.height * s);
    else {
      ctx.fillStyle = '#f6c9a0';
      ctx.beginPath();
      ctx.arc(x, top + 60, 28, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  // Rings on the water where he is, and his arms thrashing up spray.
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 3;
  for (let ring = 0; ring < 2; ring += 1) {
    const grow = (clock * 0.9 + ring * 0.5) % 1;
    ctx.globalAlpha = 1 - grow;
    ctx.beginPath();
    ctx.ellipse?.(x, BAY.surfaceY + 2, 50 + grow * 60, 8 + grow * 6, 0, 0, TAU);
    ctx.stroke();
  }
  ctx.restore();
  if (struggling) {
    const side = Math.sin(t * 9) > 0 ? 1 : -1;
    drawSplash(ctx, { x: x + side * 55, y: BAY.surfaceY }, (t * 3) % 1, 26);
  }

  // Bubbles from where he went down.
  if (t > DROWN.struggle) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 2.5;
    for (let bubble = 0; bubble < 7; bubble += 1) {
      const rise = ((t - DROWN.struggle) * 1.4 + bubble / 7) % 1;
      const y = BAY.surfaceY + 120 - rise * 120;
      ctx.globalAlpha = 1 - rise * 0.6;
      ctx.beginPath();
      ctx.arc(x + Math.sin(bubble * 2.3 + t * 4) * 16, y, 4 + (bubble % 3) * 3, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }
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
