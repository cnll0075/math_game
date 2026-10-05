import { DESIGN, hand, type Bounds, type Point } from '@bundle/core';
import { FROG, type FrogPose } from './frog.js';
import type { Rect } from './geometry.js';

const TAU = Math.PI * 2;
/** The painting's outline colour: the dark green around its pads and its frog. */
const OUTLINE = '#2f6b1f';

/** The lettering size that fits a sum measured `measured` wide at `font` into `room`. */
export const fitFont = (font: number, measured: number, room: number): number =>
  measured > room ? font * (room / measured) : font;

export interface PadLook {
  face: 'down' | 'up' | 'star';
  text: string;
  font: number;
  /** Horizontal squash while turning over: 1 flat on the water, near 0 edge-on. */
  turn: number;
  /** 0..1 of a matched pad's flower opening; 0 for none. */
  bloom: number;
  /** The keyboard highlight, for testing on a desktop. */
  cursor: boolean;
  /** The painted lily pad, once loaded. */
  image: CanvasImageSource | null;
  /** The painted frog, which sits on the free pad. */
  frog: CanvasImageSource | null;
  /** The colour of a matched pair's water lily. */
  flower: string;
}

/** Water lily colours, one per pair in the order they are found, in the painting's soft palette. */
export const LILY_COLOURS: readonly string[] = ['#ffffff', '#ffb3cf', '#ffe27a', '#d7b8ff', '#ffc49a', '#a9dcff'];

export const lilyColour = (order: number): string => LILY_COLOURS[order % LILY_COLOURS.length] ?? '#ffffff';

/**
 * Lettering in the painting's style: chunky white with a thick dark green
 * outline and a soft shadow, so a sum reads on any part of a pad.
 */
export function pondLabel(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number): void {
  ctx.save();
  ctx.font = hand(800, size);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(3, size * 0.22);
  ctx.strokeStyle = OUTLINE;
  ctx.shadowColor = 'rgba(0,40,20,0.35)';
  ctx.shadowBlur = size * 0.12;
  ctx.shadowOffsetY = size * 0.06;
  ctx.strokeText(text, x, y);
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, x, y);
  ctx.restore();
}

/** The painted pond, covering the whole screen; the drawn water until it has loaded. */
export function drawPond(ctx: CanvasRenderingContext2D, bounds: Bounds, time: number, image: CanvasImageSource | null = null): void {
  ctx.save();
  const width = bounds.right - bounds.left;
  const height = bounds.bottom - bounds.top;
  if (image) {
    // Cover the visible area, keeping the painting centred on the design.
    const scale = Math.max(width / DESIGN.width, height / DESIGN.height);
    const w = DESIGN.width * scale;
    const h = DESIGN.height * scale;
    ctx.drawImage(image, DESIGN.width / 2 - w / 2, DESIGN.height / 2 - h / 2, w, h);
  } else {
    const water = ctx.createLinearGradient(0, bounds.top, 0, bounds.bottom);
    water.addColorStop(0, '#a9dcef');
    water.addColorStop(1, '#6fb9d8');
    ctx.fillStyle = water;
    ctx.fillRect(bounds.left, bounds.top, width, height);
  }
  // A few ripples moving on the water, so the pond is never quite still.
  ctx.strokeStyle = 'rgba(255,255,255,0.28)';
  ctx.lineWidth = 3;
  for (let ring = 0; ring < 6; ring += 1) {
    const x = 120 + ring * 190;
    const y = 230 + ((ring * 97) % 480);
    const r = 20 + ((time * 14 + ring * 11) % 40);
    ctx.beginPath();
    ctx.ellipse(x, y, r * 1.6, r * 0.6, 0, 0, TAU);
    ctx.stroke();
  }
  ctx.restore();
}

/** A water lily like the ones in the painting, in a pair's own colour. */
function drawFlower(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, open: number, colour: string): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(open, open);
  ctx.strokeStyle = 'rgba(120,140,110,0.6)';
  ctx.lineWidth = 1.5;
  for (const [count, reach, light] of [
    [6, 0.55, 0],
    [5, 0.35, 0.45],
  ] as const) {
    ctx.fillStyle = colour;
    for (let petal = 0; petal < count; petal += 1) {
      const angle = (petal / count) * TAU + reach;
      ctx.beginPath();
      ctx.ellipse(Math.cos(angle) * size * reach, Math.sin(angle) * size * reach * 0.8 - size * 0.1, size * 0.4, size * 0.2, angle, 0, TAU);
      ctx.fill();
      if (light > 0) {
        // The inner petals catch the light.
        ctx.fillStyle = `rgba(255,255,255,${light})`;
        ctx.fill();
        ctx.fillStyle = colour;
      }
      ctx.stroke();
    }
  }
  ctx.fillStyle = '#ffc93a';
  ctx.beginPath();
  ctx.arc(0, -size * 0.12, size * 0.2, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/** The drawn pad, until the painted one has loaded. */
function drawnPad(ctx: CanvasRenderingContext2D, w: number, h: number, face: PadLook['face']): void {
  ctx.fillStyle = face === 'down' ? '#5fae55' : face === 'star' ? '#ffe9a8' : '#a6d98a';
  ctx.strokeStyle = 'rgba(40,90,40,0.45)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(0, 0, w / 2, h / 2, 0, 0.18, TAU - 0.18);
  ctx.lineTo(0, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

/**
 * One lily pad. Face down it is the plain painted pad and says nothing — the
 * sum stays hidden. Face up it is the same pad turned to its paler side, with
 * the sum lettered on it; matched, a water lily opens on it.
 */
export function drawPad(ctx: CanvasRenderingContext2D, rect: Rect, look: PadLook): void {
  ctx.save();
  ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
  ctx.scale(Math.max(0.04, look.turn), 1);

  // The painted pad keeps its own shape; it is fitted inside the pad's box.
  const image = look.image as (CanvasImageSource & { width: number; height: number }) | null;
  const fit = image ? Math.min(rect.w / image.width, rect.h / image.height) : 1;
  const w = image ? image.width * fit : rect.w;
  const h = image ? image.height * fit : rect.h;

  if (look.cursor) {
    ctx.strokeStyle = 'rgba(255,214,90,0.95)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.ellipse(0, 0, w / 2 + 6, h / 2 + 6, 0, 0, TAU);
    ctx.stroke();
  }

  if (image) ctx.drawImage(image, -w / 2, -h / 2, w, h);
  else drawnPad(ctx, w, h, look.face);

  if (look.face === 'star' && look.frog) {
    // The free pad: the frog sits on it, so it reads as already taken.
    const frog = look.frog as CanvasImageSource & { width: number; height: number };
    const fh = h * 1.3;
    const fw = (frog.width / frog.height) * fh;
    ctx.drawImage(frog, -fw / 2, -fh * 0.82, fw, fh);
  } else if (look.face !== 'down') {
    if (image) {
      // The pale side: the same pad, lightened (or golden for the ★).
      ctx.fillStyle = look.face === 'star' ? 'rgba(255,214,110,0.55)' : 'rgba(255,255,240,0.42)';
      ctx.beginPath();
      ctx.ellipse(0, -h * 0.05, w * 0.46, h * 0.4, 0, 0, TAU);
      ctx.fill();
    }
    const text = look.face === 'star' ? '★' : look.text;
    // Sized to the pad, then shrunk if this particular sum is too wide for it:
    // `20 − 11` needs more room than `2 + 3`.
    ctx.font = hand(800, look.font);
    const font = fitFont(look.font, ctx.measureText(text).width, w * 0.78);
    pondLabel(ctx, text, 0, -h * 0.04, font);
    // On the pad's top edge, clear of the lettering.
    if (look.bloom > 0) drawFlower(ctx, w * 0.3, -h / 2, h * 0.34, look.bloom, look.flower);
  }
  ctx.restore();
}

/** Rings and droplets where the frog leaves or meets the water. `progress` runs 0..1. */
export function drawSplash(ctx: CanvasRenderingContext2D, at: Point, progress: number): void {
  ctx.save();
  ctx.globalAlpha = Math.max(0, 1 - progress);
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 3;
  for (const ring of [0, 0.35]) {
    const grow = Math.max(0, progress - ring);
    ctx.beginPath();
    ctx.ellipse(at.x, at.y, 14 + grow * 60, 5 + grow * 20, 0, 0, TAU);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(220,245,255,0.95)';
  for (let drop = 0; drop < 6; drop += 1) {
    const angle = Math.PI + (drop / 5) * Math.PI;
    const reach = 10 + progress * 40;
    ctx.beginPath();
    ctx.arc(at.x + Math.cos(angle) * reach, at.y + Math.sin(angle) * reach * 1.3 + progress * progress * 30, 3.5, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

/** Which side of the frog its "Ribbit!" goes: whichever has the room, so it never runs off the screen. */
export const bubbleSide = (x: number): 1 | -1 => (x > DESIGN.width / 2 ? -1 : 1);

function heart(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  ctx.beginPath();
  ctx.moveTo(x, y + size * 0.35);
  ctx.bezierCurveTo(x - size, y - size * 0.4, x - size * 0.4, y - size * 1.1, x, y - size * 0.45);
  ctx.bezierCurveTo(x + size * 0.4, y - size * 1.1, x + size, y - size * 0.4, x, y + size * 0.35);
  ctx.fill();
}

/** The frog, feet at `pose.at`; the painted one once loaded, a drawn one until then. */
export function drawFrog(ctx: CanvasRenderingContext2D, pose: FrogPose, image: CanvasImageSource | null): void {
  ctx.save();
  ctx.translate(pose.at.x, pose.at.y);
  ctx.save();
  ctx.translate(0, -FROG.height / 2);
  ctx.rotate(pose.spin - pose.tilt * pose.facing);
  ctx.scale(pose.facing * pose.scale, pose.scale);
  const picture = image as (CanvasImageSource & { width: number; height: number }) | null;
  if (picture) {
    const w = (picture.width / picture.height) * FROG.height;
    ctx.drawImage(picture, -w / 2, -FROG.height / 2, w, FROG.height);
  } else {
    ctx.fillStyle = '#7cc84e';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, 8, 30, 26, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    for (const side of [-1, 1]) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(side * 14, -18, 11, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#1e2a38';
      ctx.beginPath();
      ctx.arc(side * 14 + 2, -17, 5, 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();

  if (pose.cheer > 0) {
    // "Ribbit!" in a bubble, and a few hearts floating up.
    ctx.save();
    ctx.globalAlpha = pose.cheer > 0.8 ? (1 - pose.cheer) / 0.2 : 1;
    const side = bubbleSide(pose.at.x);
    const bx = 70 * side;
    const by = -FROG.height - 28;
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath();
    ctx.ellipse(bx, by, 62, 26, 0, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(bx - 34 * side, by + 16);
    ctx.lineTo(bx - 50 * side, by + 36);
    ctx.lineTo(bx - 20 * side, by + 20);
    ctx.fill();
    ctx.font = hand(800, 26);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = OUTLINE;
    ctx.fillText('Ribbit!', bx, by + 1);
    ctx.fillStyle = '#ff7aa8';
    for (let index = 0; index < 3; index += 1) {
      const rise = pose.cheer * 70 + index * 18;
      heart(ctx, -30 + index * 26, -FROG.height - rise + 30, 9);
    }
    ctx.restore();
  }
  ctx.restore();
}

/** Wraps `text` into lines no wider than `width` in the current font. */
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const tried = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(tried).width > width) {
      lines.push(line);
      line = word;
    } else {
      line = tried;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Where the first board's coach sits: on the water, clear of the pads and the plants. */
export const COACH_AT: Point = { x: 1000, y: 470 };
/** The coach's bubble: its right edge, and the widest its wrapped lines can make it. */
export const COACH_BUBBLE = { right: DESIGN.width - 16, wrap: 270, maxWidth: 270 + 48 } as const;

/** The frog coaching on the first board: sitting by the pads, saying what to do next. */
export function drawCoach(ctx: CanvasRenderingContext2D, text: string, frog: CanvasImageSource | null, time: number): void {
  const bob = Math.sin(time * 3) * 3;
  drawFrog(ctx, { at: { x: COACH_AT.x, y: COACH_AT.y + bob }, facing: -1, scale: 1.1, tilt: 0, spin: 0, cheer: 0 }, frog);
  ctx.save();
  ctx.font = hand(800, 30);
  const lines = wrap(ctx, text, COACH_BUBBLE.wrap);
  const width = Math.min(COACH_BUBBLE.maxWidth, Math.max(...lines.map((line) => ctx.measureText(line).width)) + 48);
  const height = lines.length * 38 + 30;
  const right = COACH_BUBBLE.right;
  const bottom = COACH_AT.y - FROG.height * 1.1 - 18;
  ctx.fillStyle = 'rgba(255,255,255,0.96)';
  ctx.strokeStyle = 'rgba(47,107,31,0.5)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect?.(right - width, bottom - height, width, height, 22);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(COACH_AT.x - 10, bottom - 2);
  ctx.lineTo(COACH_AT.x + 4, bottom + 22);
  ctx.lineTo(COACH_AT.x + 18, bottom - 2);
  ctx.fill();
  ctx.fillStyle = OUTLINE;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  lines.forEach((line, index) => ctx.fillText(line, right - width / 2, bottom - height + 34 + index * 38));
  ctx.restore();
}

/** A hand pointing down at something to tap from just above it, bobbing so the eye finds it. */
export function drawHand(ctx: CanvasRenderingContext2D, at: Point, time: number): void {
  ctx.save();
  ctx.font = hand(400, 56);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('👇', at.x, at.y - 4 - Math.abs(Math.sin(time * 4)) * 14);
  ctx.restore();
}
