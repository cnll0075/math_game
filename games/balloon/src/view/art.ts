import { hand, label, type Bounds, type Point } from '@bundle/core';
import type { Mood } from './flight.js';
import { LAYERS } from '../logic/rescue-def.js';
import { balloonRadius, LAYOUT, layerY, pegPoint } from './geometry.js';

const INK = '#1e2a38';
const TAU = Math.PI * 2;

/** One colour per value, so a 6 is the same 6 wherever it appears. */
const BALLOON_COLOURS = [
  '#f7a8b8', '#ffcf6e', '#9fd8a8', '#8ecdf0', '#c9a8f0',
  '#f6b27a', '#7fd0c8', '#f08a8a', '#a8b8f7', '#f2d25c',
] as const;

export const balloonColour = (value: number): string =>
  BALLOON_COLOURS[(Math.max(1, Math.round(value)) - 1) % BALLOON_COLOURS.length] ?? BALLOON_COLOURS[0];

const CLOUDS = [
  { x: 170, y: 150, size: 1 },
  { x: 610, y: 84, size: 1.3 },
  { x: 990, y: 160, size: 0.9 },
  { x: 430, y: 214, size: 0.7 },
] as const;

function drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size, size);
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.beginPath();
  ctx.arc(-42, 10, 28, 0, TAU);
  ctx.arc(-6, -8, 38, 0, TAU);
  ctx.arc(36, 6, 30, 0, TAU);
  ctx.arc(0, 18, 30, 0, TAU);
  ctx.fill();
  ctx.restore();
}

export function drawSky(ctx: CanvasRenderingContext2D, bounds: Bounds): void {
  ctx.save();
  const sky = ctx.createLinearGradient(0, bounds.top, 0, LAYOUT.groundY);
  sky.addColorStop(0, '#86ccf4');
  sky.addColorStop(1, '#e3f5ff');
  ctx.fillStyle = sky;
  ctx.fillRect(bounds.left, bounds.top, bounds.right - bounds.left, bounds.bottom - bounds.top);
  for (const cloud of CLOUDS) drawCloud(ctx, cloud.x, cloud.y, cloud.size);
  ctx.restore();
}

export function drawGround(ctx: CanvasRenderingContext2D, bounds: Bounds): void {
  ctx.save();
  ctx.fillStyle = '#a3d982';
  ctx.fillRect(bounds.left, LAYOUT.groundY - 6, bounds.right - bounds.left, bounds.bottom - LAYOUT.groundY + 6);
  // Rolling hills along the horizon, the concept art's soft green.
  ctx.fillStyle = '#b8e39a';
  ctx.beginPath();
  ctx.moveTo(bounds.left, LAYOUT.groundY);
  for (let x = bounds.left; x <= bounds.right; x += 60) ctx.lineTo(x, LAYOUT.groundY - 18 - Math.sin(x / 90) * 12);
  ctx.lineTo(bounds.right, LAYOUT.groundY);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** A grassy cliff whose top is the ledge. `edgeX` is where its lip is. */
export function drawCliff(
  ctx: CanvasRenderingContext2D,
  bounds: Bounds,
  side: 'left' | 'right',
  edgeX: number,
  topY: number = LAYOUT.ledgeY,
): void {
  const from = side === 'left' ? bounds.left : edgeX;
  const to = side === 'left' ? edgeX : bounds.right;
  const top = topY;
  ctx.save();
  ctx.fillStyle = '#d9a66c';
  ctx.strokeStyle = 'rgba(120,72,30,0.35)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(from, LAYOUT.groundY + 10);
  ctx.lineTo(from, top + 10);
  ctx.lineTo(to, top + 10);
  ctx.quadraticCurveTo(to + (side === 'left' ? 14 : -14), (top + LAYOUT.groundY) / 2, to, LAYOUT.groundY + 10);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Strata, so it reads as rock.
  ctx.strokeStyle = 'rgba(120,72,30,0.25)';
  for (let y = top + 70; y < LAYOUT.groundY; y += 70) {
    ctx.beginPath();
    ctx.moveTo(from, y);
    ctx.lineTo(to, y + 8);
    ctx.stroke();
  }
  // The grass cap is the ledge itself.
  ctx.fillStyle = '#7cc45e';
  ctx.beginPath();
  ctx.roundRect?.(from - 10, top - 8, to - from + 20, 26, 13);
  ctx.fill();
  ctx.restore();
}

/** The rope from the harness down to a peg: tied balloons cannot float off by themselves. */
export function drawRope(ctx: CanvasRenderingContext2D, feet: Point): void {
  const peg = pegPoint(feet);
  ctx.save();
  ctx.strokeStyle = '#9b7b52';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(feet.x + 18, feet.y - 60);
  ctx.quadraticCurveTo(feet.x + 46, feet.y - 30, peg.x, peg.y - 16);
  ctx.stroke();
  ctx.fillStyle = '#7a5a38';
  ctx.fillRect(peg.x - 6, peg.y - 22, 12, 30);
  ctx.restore();
}

export function drawString(ctx: CanvasRenderingContext2D, from: Point, to: Point): void {
  ctx.save();
  ctx.strokeStyle = 'rgba(30,42,56,0.45)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.quadraticCurveTo((from.x + to.x) / 2 + 10, (from.y + to.y) / 2, to.x, to.y);
  ctx.stroke();
  ctx.restore();
}

export function drawBalloon(
  ctx: CanvasRenderingContext2D,
  at: Point,
  value: number,
  options: { limp?: boolean; glow?: number } = {},
): void {
  const radius = balloonRadius(value);
  ctx.save();
  ctx.translate(at.x, at.y);

  if (options.limp) {
    // Popped: a crumpled scrap hanging from its string, with no number because
    // it lifts nothing. Big enough to find again, since a tap blows it back up.
    ctx.translate(0, LAYOUT.limpDrop);
    ctx.fillStyle = balloonColour(value);
    ctx.strokeStyle = 'rgba(30,42,56,0.45)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-4, -14);
    ctx.quadraticCurveTo(16, -10, 14, 4);
    ctx.quadraticCurveTo(20, 16, 4, 18);
    ctx.quadraticCurveTo(-6, 26, -14, 12);
    ctx.quadraticCurveTo(-24, 2, -12, -6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (options.glow && options.glow > 0) {
    ctx.fillStyle = `rgba(255,236,140,${0.7 * options.glow})`;
    ctx.beginPath();
    ctx.arc(0, 0, radius + 14, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = balloonColour(value);
  ctx.strokeStyle = 'rgba(30,42,56,0.25)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(0, 0, radius * 0.9, radius, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath();
  ctx.ellipse(-radius * 0.35, -radius * 0.42, radius * 0.18, radius * 0.28, -0.5, 0, TAU);
  ctx.fill();
  ctx.fillStyle = balloonColour(value);
  ctx.beginPath();
  ctx.moveTo(-6, radius + 8);
  ctx.lineTo(6, radius + 8);
  ctx.lineTo(0, radius - 2);
  ctx.closePath();
  ctx.fill();
  label(ctx, String(value), 0, 2, Math.max(22, radius * 0.85), 'center');
  ctx.restore();
}

/** A free hook on a limited harness: a dashed outline where a balloon could go. */
export function drawEmptyClip(ctx: CanvasRenderingContext2D, ring: Point, at: Point): void {
  ctx.save();
  ctx.setLineDash([6, 6]);
  ctx.strokeStyle = 'rgba(30,42,56,0.35)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(ring.x, ring.y);
  ctx.lineTo(at.x, at.y + 26);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(at.x, at.y, 23, 26, 0, 0, TAU);
  ctx.stroke();
  ctx.restore();
}

/**
 * The fox kit, feet at `at`. Its weight is on a tag on its chest: the number
 * the whole rescue is about, so it is the biggest thing on it.
 */
export function drawFox(ctx: CanvasRenderingContext2D, at: Point, options: { weight: number; mood: Mood; bob: number }): void {
  const bounce = Math.sin(options.bob * TAU) * 2;
  ctx.save();
  ctx.translate(at.x, at.y + bounce);

  // Tail.
  ctx.fillStyle = '#f29a4a';
  ctx.beginPath();
  ctx.ellipse(-44, -30, 16, 34, -0.9, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#fff6ec';
  ctx.beginPath();
  ctx.ellipse(-62, -48, 8, 12, -0.9, 0, TAU);
  ctx.fill();

  // Body and belly.
  ctx.fillStyle = '#f29a4a';
  ctx.beginPath();
  ctx.ellipse(0, -36, 34, 38, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#fff6ec';
  ctx.beginPath();
  ctx.ellipse(0, -30, 22, 26, 0, 0, TAU);
  ctx.fill();

  // Harness straps up to the ring.
  ctx.strokeStyle = '#5a7fc2';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(-24, -52);
  ctx.lineTo(0, -LAYOUT.harnessHeight);
  ctx.lineTo(24, -52);
  ctx.stroke();
  ctx.fillStyle = '#5a7fc2';
  ctx.beginPath();
  ctx.arc(0, -LAYOUT.harnessHeight, 7, 0, TAU);
  ctx.fill();

  // Head, ears, face.
  ctx.fillStyle = '#f29a4a';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * 12, -98);
    ctx.lineTo(side * 32, -126);
    ctx.lineTo(side * 34, -90);
    ctx.closePath();
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(0, -82, 30, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#fff6ec';
  ctx.beginPath();
  ctx.ellipse(0, -72, 18, 13, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(0, -78, 4, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    if (options.mood === 'happy') {
      ctx.arc(side * 12, -88, 6, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
    } else if (options.mood === 'strain') {
      ctx.moveTo(side * 6, -90);
      ctx.lineTo(side * 18, -86);
      ctx.stroke();
    } else {
      ctx.arc(side * 12, -88, options.mood === 'wheee' ? 6 : 4.5, 0, TAU);
      ctx.fill();
    }
  }
  if (options.mood === 'wheee') {
    ctx.beginPath();
    ctx.ellipse(0, -66, 5, 7, 0, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(240,120,130,0.45)';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(side * 20, -74, 5, 0, TAU);
    ctx.fill();
  }

  // The weight tag.
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = 'rgba(30,42,56,0.4)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect?.(-24, -48, 48, 36, 10);
  ctx.fill();
  ctx.stroke();
  ctx.font = hand(700, 30);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = INK;
  ctx.fillText(String(options.weight), 0, -29);
  ctx.restore();
}

export function drawParachute(ctx: CanvasRenderingContext2D, feet: Point): void {
  const top = feet.y - 230;
  ctx.save();
  ctx.fillStyle = '#ffd36e';
  ctx.strokeStyle = 'rgba(30,42,56,0.3)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(feet.x, top + 40, 80, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = 'rgba(30,42,56,0.4)';
  ctx.lineWidth = 2;
  for (const dx of [-78, -30, 30, 78]) {
    ctx.beginPath();
    ctx.moveTo(feet.x + dx, top + 40);
    ctx.lineTo(feet.x, feet.y - 110);
    ctx.stroke();
  }
  ctx.restore();
}

/** The one big button. Dimmed until there is something on the harness to lift. */
export function drawButton(ctx: CanvasRenderingContext2D, enabled: boolean): void {
  const { left, top, width, height } = LAYOUT.button;
  ctx.save();
  ctx.globalAlpha = enabled ? 1 : 0.45;
  ctx.fillStyle = enabled ? '#f07b5f' : '#b9c2cc';
  ctx.beginPath();
  ctx.roundRect?.(left, top, width, height, 28);
  ctx.fill();
  ctx.font = hand(700, 40);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('Let go!', left + width / 2, top + height / 2 + 2);
  ctx.restore();
}

/** A soft shelf behind the tray, so waiting balloons read as a set to choose from. */
export function drawTrayShelf(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.beginPath();
  ctx.roundRect?.(LAYOUT.trayLeft - 20, LAYOUT.trayY - 74, LAYOUT.trayRight - LAYOUT.trayLeft + 40, 140, 30);
  ctx.fill();
  ctx.restore();
}

/** Scraps flying out where a balloon popped. */
export function drawPopBurst(ctx: CanvasRenderingContext2D, at: Point, value: number, progress: number): void {
  ctx.save();
  ctx.globalAlpha = Math.max(0, 1 - progress);
  ctx.fillStyle = balloonColour(value);
  for (let piece = 0; piece < 8; piece += 1) {
    const angle = (piece / 8) * TAU;
    const reach = 16 + progress * 46;
    ctx.beginPath();
    ctx.arc(at.x + Math.cos(angle) * reach, at.y + Math.sin(angle) * reach, 5, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

/** Streaks of moving air across a band, drifting with `time`; `direction` 1 blows right. */
function drawStreaks(ctx: CanvasRenderingContext2D, bounds: Bounds, y: number, direction: number, time: number, alpha: number): void {
  const span = bounds.right - bounds.left;
  ctx.save();
  ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  for (let index = 0; index < 9; index += 1) {
    const x = bounds.left + ((((index * 137 + time * 160 * direction) % span) + span) % span);
    const dy = (index % 3) * 18 - 18;
    ctx.beginPath();
    ctx.moveTo(x, y + dy);
    ctx.lineTo(x + 70, y + dy);
    ctx.stroke();
  }
  ctx.restore();
}

/** The breeze at the ledge's height that carries a rescued kit across onto the cliff. */
export function drawBreeze(ctx: CanvasRenderingContext2D, bounds: Bounds, time: number): void {
  drawStreaks(ctx, bounds, LAYOUT.ledgeY - 60, -1, time, 0.75);
  const span = bounds.right - bounds.left;
  ctx.save();
  ctx.fillStyle = '#8cc56a';
  for (let index = 0; index < 3; index += 1) {
    const x = bounds.right - ((((index * 311 + time * 120) % span) + span) % span);
    ctx.beginPath();
    ctx.ellipse(x, LAYOUT.ledgeY - 70 + Math.sin(time * 3 + index) * 10, 9, 5, 0.6, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Windy Ridge's wind layers, numbered up the left edge. The one at the ledge's
 * height blows towards it; every other blows away.
 */
export function drawWindLayers(ctx: CanvasRenderingContext2D, bounds: Bounds, target: number, time: number): void {
  for (let layer = 1; layer <= LAYERS; layer += 1) {
    const y = layerY(layer) - 60;
    const towards = layer === target;
    ctx.save();
    ctx.fillStyle = towards ? 'rgba(255,240,170,0.35)' : 'rgba(255,255,255,0.18)';
    ctx.fillRect(bounds.left, y - 34, bounds.right - bounds.left, 68);
    ctx.restore();
    drawStreaks(ctx, bounds, y, towards ? 1 : -1, time, towards ? 0.9 : 0.6);
    label(ctx, String(layer), 40, y, 36, 'center');
    label(ctx, towards ? '→' : '←', 84, y, 34, 'center');
  }
}
