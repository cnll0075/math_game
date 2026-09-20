import { hand, type Point } from '@bundle/core';
import { PLANE_TYPES, type PlaneTypeId } from '../logic/planes.js';
import type { Plane } from '../logic/sky-state.js';
import { bulletPoint, fighterPoint, planePoint, planeSize, SKY } from './geometry.js';

/** One palette per type, so a scout is known by its colour before its number. */
const PALETTE: Record<PlaneTypeId, { body: string; wing: string; trim: string }> = {
  glider: { body: '#e8eef5', wing: '#b9c8d8', trim: '#41628a' },
  // Striped orange, not gold: it dodges, it is not treasure. Gold promising a
  // reward the game never paid was the thing that misled a player.
  weaver: { body: '#f7a35c', wing: '#d97a2b', trim: '#7d3f10' },
  blimp: { body: '#cfd8e0', wing: '#aab7c4', trim: '#4a5a6a' },
  scout: { body: '#f2a0a0', wing: '#d06a6a', trim: '#7d2f2f' },
  hider: { body: '#cbbce8', wing: '#a793d1', trim: '#54407f' },
  treasure: { body: '#ffd45e', wing: '#e0a81f', trim: '#7d5a06' },
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

/** The badge that tells a child, without a word, what a gold plane is worth. */
const heartBadge = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number, earned: boolean): void => {
  ctx.save();
  ctx.translate(x, y);
  // A soft halo, so the badge reads against both the sky and the plane.
  ctx.beginPath();
  ctx.arc(0, size * 0.5, size * 0.95, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(0, size * 0.3);
  ctx.bezierCurveTo(size * 0.6, -size * 0.35, size * 0.5, size * 0.55, 0, size);
  ctx.bezierCurveTo(-size * 0.5, size * 0.55, -size * 0.6, -size * 0.35, 0, size * 0.3);
  ctx.closePath();
  if (earned) {
    ctx.fillStyle = '#e8543f';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.stroke();
  } else {
    // An outline, exactly as a spent heart is drawn on the top bar, so the two
    // say the same thing: this one is not yours to win right now.
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(70,52,30,0.55)';
    ctx.stroke();
  }
  ctx.restore();
};

export function drawPlane(ctx: CanvasRenderingContext2D, plane: Plane, heartOnOffer = true): void {
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

  if (plane.type === 'treasure') {
    // A glint, so gold reads as gold even against a bright sky.
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath();
    ctx.arc(-width * 0.3, -height * 0.34, height * 0.11, 0, Math.PI * 2);
    ctx.fill();
    heartBadge(ctx, 0, -height * 1.5, height * 0.52, heartOnOffer);
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

/**
 * A plane that got away, ringed in red where it left, with the sum it was
 * carrying. Shown only after the fact: a marker on the target while it was
 * still flying would hand over the answer and there would be no arithmetic
 * left in the game.
 */
export function drawMissed(
  ctx: CanvasRenderingContext2D,
  at: Point,
  text: string,
  progress: number,
): void {
  ctx.save();
  ctx.globalAlpha = Math.max(0, 1 - progress);
  ctx.strokeStyle = '#e8543f';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(at.x, at.y, 44 + progress * 26, 0, Math.PI * 2);
  ctx.stroke();

  ctx.font = hand(700, 40);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 7;
  ctx.strokeStyle = 'rgba(255,255,255,0.92)';
  ctx.strokeText(text, at.x, at.y - 76);
  ctx.fillStyle = '#c8371f';
  ctx.fillText(text, at.x, at.y - 76);
  ctx.restore();
}

export function drawFighter(
  ctx: CanvasRenderingContext2D,
  x: number,
  options: { jammed: boolean; sum: string; urgency: number },
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

  ctx.restore();

  // The question rides on a plaque under the fighter, clear of its body: drawn
  // across the fuselage, the nose covered the operator, and telling a plus from
  // a minus is the whole of the take-aways band.
  const width = Math.max(150, options.sum.length * 26);
  ctx.save();
  // The plaque warms towards red as the plane being asked about runs out of
  // sky. It says hurry without saying which one, so the maths still has to be
  // done — a marker on the plane itself would give the answer away.
  const heat = Math.min(1, Math.max(0, options.urgency));
  const pulse = heat > 0 ? 0.75 + 0.25 * Math.sin(Date.now() / 90) : 1;
  ctx.fillStyle = heat > 0 ? `rgba(255, ${Math.round(255 - 86 * heat)}, ${Math.round(255 - 150 * heat)}, 0.95)` : 'rgba(255,255,255,0.92)';
  ctx.strokeStyle = heat > 0.02 ? `rgba(${Math.round(47 + 185 * heat)}, ${Math.round(111 - 27 * heat)}, ${Math.round(159 - 96 * heat)}, ${pulse})` : '#2f6f9f';
  ctx.lineWidth = 4 + 3 * heat;
  const left = at.x - width / 2;
  const top = SKY.plaqueY - SKY.plaqueHeight / 2;
  const radius = 16;
  ctx.beginPath();
  ctx.moveTo(left + radius, top);
  ctx.arcTo(left + width, top, left + width, top + SKY.plaqueHeight, radius);
  ctx.arcTo(left + width, top + SKY.plaqueHeight, left, top + SKY.plaqueHeight, radius);
  ctx.arcTo(left, top + SKY.plaqueHeight, left, top, radius);
  ctx.arcTo(left, top, left + width, top, radius);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.font = hand(700, 40);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#1e2a38';
  ctx.fillText(options.sum, at.x, SKY.plaqueY);
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
