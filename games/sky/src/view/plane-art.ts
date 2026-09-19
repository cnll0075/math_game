import { hand, type Point } from '@bundle/core';
import { PLANE_TYPES, type PlaneTypeId } from '../logic/planes.js';
import type { Plane } from '../logic/sky-state.js';
import { bulletPoint, fighterPoint, planePoint, planeSize, SKY } from './geometry.js';

/** One palette per type, so a scout is known by its colour before its number. */
const PALETTE: Record<PlaneTypeId, { body: string; wing: string; trim: string }> = {
  glider: { body: '#e8eef5', wing: '#b9c8d8', trim: '#41628a' },
  weaver: { body: '#f6dc8a', wing: '#d9b551', trim: '#8a6a1f' },
  blimp: { body: '#cfd8e0', wing: '#aab7c4', trim: '#4a5a6a' },
  scout: { body: '#f2a0a0', wing: '#d06a6a', trim: '#7d2f2f' },
  hider: { body: '#cbbce8', wing: '#a793d1', trim: '#54407f' },
};

/** A number on a plane has to read at a glance from across a room. */
const numberOn = (ctx: CanvasRenderingContext2D, text: string, at: Point, size: number): void => {
  ctx.font = hand(700, size);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // A pale rim under the letters keeps them legible against any fuselage.
  ctx.lineWidth = Math.max(3, size * 0.16);
  ctx.strokeStyle = 'rgba(255,255,255,0.92)';
  ctx.strokeText(text, at.x, at.y);
  ctx.fillStyle = '#1e2a38';
  ctx.fillText(text, at.x, at.y);
};

export function drawPlane(ctx: CanvasRenderingContext2D, plane: Plane): void {
  const type = PLANE_TYPES[plane.type];
  const { width, height } = planeSize(type);
  const at = planePoint(plane);
  const skin = PALETTE[plane.type];

  ctx.save();
  ctx.translate(at.x, at.y);

  if (plane.type === 'blimp') {
    // A fat envelope with a gondola: unmistakably the slow one.
    ctx.fillStyle = skin.body;
    ctx.beginPath();
    ctx.ellipse(0, 0, width / 2, height / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = skin.trim;
    ctx.fillRect(-width * 0.12, height * 0.38, width * 0.24, height * 0.22);
    // Damage: a dent per hit taken, so committing to an answer is visible.
    for (let i = 0; i < plane.hits; i += 1) {
      ctx.fillStyle = 'rgba(60,40,30,0.5)';
      ctx.beginPath();
      ctx.arc(-width * 0.22 + i * width * 0.22, -height * 0.12, height * 0.13, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    // Wings, then a fuselage, then a tail: a paper-aeroplane silhouette, nose down.
    ctx.fillStyle = skin.wing;
    ctx.beginPath();
    ctx.moveTo(-width / 2, 0);
    ctx.lineTo(width / 2, 0);
    ctx.lineTo(width * 0.22, height * 0.32);
    ctx.lineTo(-width * 0.22, height * 0.32);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = skin.body;
    ctx.beginPath();
    ctx.ellipse(0, 0, width * 0.27, height * 0.56, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = skin.trim;
    ctx.beginPath();
    ctx.moveTo(-width * 0.11, -height * 0.44);
    ctx.lineTo(width * 0.11, -height * 0.44);
    ctx.lineTo(0, -height * 0.82);
    ctx.closePath();
    ctx.fill();
  }

  // Cloud-hiders duck behind a puff; the plane stays visible, the number does not.
  if (plane.hidden) {
    ctx.fillStyle = 'rgba(248,250,252,0.94)';
    ctx.beginPath();
    ctx.arc(-width * 0.2, 0, height * 0.5, 0, Math.PI * 2);
    ctx.arc(width * 0.2, 0, height * 0.55, 0, Math.PI * 2);
    ctx.arc(0, -height * 0.15, height * 0.6, 0, Math.PI * 2);
    ctx.fill();
  } else {
    numberOn(ctx, String(plane.number), { x: 0, y: 0 }, height * 0.66);
  }

  ctx.restore();
}

export function drawFighter(
  ctx: CanvasRenderingContext2D,
  x: number,
  options: { jammed: boolean; sum: string },
): void {
  const at = fighterPoint(x);
  ctx.save();
  ctx.translate(at.x, at.y);

  ctx.fillStyle = '#2f6f9f';
  ctx.beginPath();
  ctx.moveTo(0, -SKY.fighterHeight * 0.5);
  ctx.lineTo(SKY.fighterWidth * 0.5, SKY.fighterHeight * 0.4);
  ctx.lineTo(-SKY.fighterWidth * 0.5, SKY.fighterHeight * 0.4);
  ctx.closePath();
  ctx.fill();

  // The gun. Red hot while the shell that hit the wrong plane is paid for.
  ctx.fillStyle = options.jammed ? '#e8543f' : '#cfd8e0';
  ctx.fillRect(-SKY.bulletWidth, -SKY.fighterHeight * 0.74, SKY.bulletWidth * 2, SKY.fighterHeight * 0.32);
  if (options.jammed) {
    ctx.fillStyle = 'rgba(232,84,63,0.35)';
    ctx.beginPath();
    ctx.arc(0, -SKY.fighterHeight * 0.68, SKY.fighterHeight * 0.42, 0, Math.PI * 2);
    ctx.fill();
  }

  // The question rides on the fuselage, where the player's eye already is.
  numberOn(ctx, options.sum, { x: 0, y: SKY.fighterHeight * 0.1 }, 36);
  ctx.restore();
}

export function drawBullet(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  const at = bulletPoint(x, y);
  ctx.save();
  ctx.fillStyle = '#ffd166';
  ctx.beginPath();
  ctx.ellipse(at.x, at.y, SKY.bulletWidth / 2, SKY.bulletLength / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** A puff of smoke and sparks, fading over its life. `progress` runs 0 to 1. */
export function drawBoom(ctx: CanvasRenderingContext2D, at: Point, progress: number): void {
  const fade = 1 - progress;
  const radius = 20 + progress * 58;
  ctx.save();
  ctx.globalAlpha = Math.max(0, fade);
  ctx.fillStyle = '#ffb703';
  ctx.beginPath();
  ctx.arc(at.x, at.y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(90,90,100,0.55)';
  ctx.beginPath();
  ctx.arc(at.x, at.y, radius * 0.65, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
