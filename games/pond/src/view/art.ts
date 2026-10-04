import { label, type Bounds } from '@bundle/core';
import type { Rect } from './geometry.js';

const TAU = Math.PI * 2;

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
}

/** The water, with a few ripples moving on it. */
export function drawPond(ctx: CanvasRenderingContext2D, bounds: Bounds, time: number): void {
  ctx.save();
  const water = ctx.createLinearGradient(0, bounds.top, 0, bounds.bottom);
  water.addColorStop(0, '#a9dcef');
  water.addColorStop(1, '#6fb9d8');
  ctx.fillStyle = water;
  ctx.fillRect(bounds.left, bounds.top, bounds.right - bounds.left, bounds.bottom - bounds.top);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 3;
  for (let ring = 0; ring < 6; ring += 1) {
    const x = 120 + ring * 190;
    const y = 160 + ((ring * 97) % 520);
    const r = 20 + ((time * 14 + ring * 11) % 40);
    ctx.beginPath();
    ctx.ellipse(x, y, r * 1.6, r * 0.6, 0, 0, TAU);
    ctx.stroke();
  }
  // Reeds along the near edge.
  ctx.fillStyle = '#7cb35a';
  for (let x = bounds.left; x < bounds.right; x += 46) {
    ctx.beginPath();
    ctx.moveTo(x, bounds.bottom);
    ctx.quadraticCurveTo(x + 6, bounds.bottom - 40, x + 12, bounds.bottom - 64);
    ctx.lineTo(x + 18, bounds.bottom);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawFlower(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, open: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(open, open);
  ctx.fillStyle = '#f7a8c4';
  for (let petal = 0; petal < 6; petal += 1) {
    ctx.beginPath();
    ctx.ellipse(Math.cos((petal / 6) * TAU) * size * 0.5, Math.sin((petal / 6) * TAU) * size * 0.5, size * 0.42, size * 0.24, (petal / 6) * TAU, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = '#ffd36e';
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.3, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/**
 * One lily pad. Face down it is a plain green pad and says nothing — the sum
 * stays hidden. Face up it is pale with the sum in large lettering; matched,
 * a flower opens on it.
 */
export function drawPad(ctx: CanvasRenderingContext2D, rect: Rect, look: PadLook): void {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(Math.max(0.04, look.turn), 1);

  if (look.cursor) {
    ctx.strokeStyle = 'rgba(255,214,90,0.95)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.ellipse(0, 0, rect.w / 2 + 6, rect.h / 2 + 6, 0, 0, TAU);
    ctx.stroke();
  }

  if (look.face === 'down') {
    ctx.fillStyle = '#5fae55';
    ctx.strokeStyle = 'rgba(40,90,40,0.45)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, 0, rect.w / 2, rect.h / 2, 0, 0.18, TAU - 0.18);
    ctx.lineTo(0, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    for (const angle of [0.9, 1.9, 2.9, 3.9, 4.9]) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(angle) * rect.w * 0.42, Math.sin(angle) * rect.h * 0.42);
      ctx.stroke();
    }
  } else {
    ctx.fillStyle = look.face === 'star' ? '#ffe9a8' : '#eef8e4';
    ctx.strokeStyle = 'rgba(40,90,40,0.4)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, 0, rect.w / 2, rect.h / 2, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    label(ctx, look.face === 'star' ? '★' : look.text, 0, 2, look.font, 'center');
    if (look.bloom > 0) drawFlower(ctx, rect.w / 2 - rect.h * 0.22, -rect.h / 2 + rect.h * 0.18, rect.h * 0.32, look.bloom);
  }
  ctx.restore();
}
