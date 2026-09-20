import { DESIGN, hand, type Point } from '@bundle/core';
import { HEARTS } from '../logic/run.js';
import { SKY } from './geometry.js';
import { TIMING } from './timing.js';

export interface HudModel {
  hearts: number;
  score: number;
  streak: number;
  /** 0..1 through the crack animation, just after a heart is lost. */
  crack: number;
}

const heart = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number, filled: boolean): void => {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.moveTo(0, size * 0.3);
  ctx.bezierCurveTo(size * 0.6, -size * 0.35, size * 0.5, size * 0.55, 0, size);
  ctx.bezierCurveTo(-size * 0.5, size * 0.55, -size * 0.6, -size * 0.35, 0, size * 0.3);
  ctx.closePath();
  if (filled) {
    ctx.fillStyle = '#e8543f';
    ctx.fill();
  } else {
    // A spent heart stays on the bar as an outline, so a child can see what
    // they have left and what they have already used.
    ctx.strokeStyle = 'rgba(30,42,56,0.35)';
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  ctx.restore();
};

const label = (
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  align: CanvasTextAlign,
): void => {
  ctx.font = hand(700, size);
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.lineWidth = Math.max(3, size * 0.18);
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = '#1e2a38';
  ctx.fillText(text, x, y);
};

export function drawHud(ctx: CanvasRenderingContext2D, model: HudModel): void {
  ctx.save();
  const size = 24;
  for (let i = 0; i < HEARTS; i += 1) {
    const filled = i < model.hearts;
    // The heart just lost shakes as it empties, so the loss is felt as well as seen.
    const shake = !filled && i === model.hearts && model.crack > 0 ? Math.sin(model.crack * 40) * 3 : 0;
    heart(ctx, SKY.fieldLeft + i * (size * 1.9) + shake, SKY.hudY - size / 2, size, filled);
  }

  label(ctx, String(model.score), DESIGN.width - SKY.fieldLeft, SKY.hudY, 40, 'right');
  // A streak is worth naming only once it is a streak.
  if (model.streak >= 3) label(ctx, `${model.streak} in a row!`, DESIGN.width / 2, SKY.hudY, 26, 'center');
  ctx.restore();
}

/**
 * A band announcing itself: large in the middle, then away to the top bar, so a
 * change in the rules is seen arriving rather than discovered. The same grammar
 * Seesaw's chapters use, because a child who has played that one already knows
 * what a banner means.
 */
export function drawBanner(ctx: CanvasRenderingContext2D, title: string, progress: number): void {
  const settle = Math.max(0, (progress - (1 - TIMING.bandSettleFraction)) / TIMING.bandSettleFraction);
  const y = DESIGN.height * 0.38 + (SKY.hudY - DESIGN.height * 0.38) * settle;
  const scale = 1 - 0.55 * settle;
  ctx.save();
  ctx.translate(DESIGN.width / 2, y);
  ctx.scale(scale, scale);
  ctx.globalAlpha = progress > 0.92 ? (1 - progress) / 0.08 : 1;
  label(ctx, title, 0, 0, 76, 'center');
  ctx.restore();
}

/**
 * The solved sum, hanging where the plane was. This is the teaching beat: the
 * child sees the whole equation finished, which is their confirmation that they
 * were right — so it is written in full, answer included.
 */
export function drawSolved(ctx: CanvasRenderingContext2D, at: Point, text: string, progress: number): void {
  ctx.save();
  ctx.globalAlpha = Math.max(0, 1 - progress * progress);
  ctx.translate(at.x, at.y - progress * 46);
  label(ctx, text, 0, 0, 44, 'center');
  ctx.restore();
}

/**
 * What just cost a heart, said in the middle of the screen where the player is
 * already looking. The marker down at the escape line says *where* it happened;
 * this says *what*, and it is the one that actually gets read.
 */
export function drawLoss(ctx: CanvasRenderingContext2D, text: string, progress: number): void {
  const rise = Math.min(1, progress * 3);
  ctx.save();
  ctx.globalAlpha = progress > 0.8 ? (1 - progress) / 0.2 : 1;
  ctx.translate(DESIGN.width / 2, DESIGN.height * 0.3 - rise * 10);

  const width = Math.max(420, text.length * 34);
  const height = 150;
  ctx.fillStyle = 'rgba(232,84,63,0.95)';
  const left = -width / 2;
  const top = -height / 2;
  const radius = 24;
  ctx.beginPath();
  ctx.moveTo(left + radius, top);
  ctx.arcTo(left + width, top, left + width, top + height, radius);
  ctx.arcTo(left + width, top + height, left, top + height, radius);
  ctx.arcTo(left, top + height, left, top, radius);
  ctx.arcTo(left, top, left + width, top, radius);
  ctx.closePath();
  ctx.fill();

  ctx.font = hand(700, 32);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.fillText('It got away!', 0, -34);
  ctx.font = hand(700, 58);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, 0, 26);
  ctx.restore();
}

export interface Summary {
  score: number;
  bestStreak: number;
  seconds: number;
  best: number;
  beatenBest: boolean;
}

const minutes = (seconds: number): string => {
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
};

/** How far you flew, never a failure screen. */
export function drawSummary(ctx: CanvasRenderingContext2D, summary: Summary): void {
  const width = 640;
  const height = 380;
  const left = (DESIGN.width - width) / 2;
  const top = (DESIGN.height - height) / 2;

  ctx.save();
  ctx.fillStyle = 'rgba(12,24,38,0.55)';
  ctx.fillRect(0, 0, DESIGN.width, DESIGN.height);
  ctx.fillStyle = '#f7fbff';
  // Four corners by hand rather than roundRect, which an older iPad's Safari
  // does not have: there it would silently skip the card's background.
  const radius = 28;
  ctx.beginPath();
  ctx.moveTo(left + radius, top);
  ctx.arcTo(left + width, top, left + width, top + height, radius);
  ctx.arcTo(left + width, top + height, left, top + height, radius);
  ctx.arcTo(left, top + height, left, top, radius);
  ctx.arcTo(left, top, left + width, top, radius);
  ctx.closePath();
  ctx.fill();

  label(ctx, summary.beatenBest ? 'A new best!' : 'Good flying!', DESIGN.width / 2, top + 66, 52, 'center');
  label(ctx, `Planes down   ${summary.score}`, DESIGN.width / 2, top + 150, 34, 'center');
  label(ctx, `Longest streak   ${summary.bestStreak}`, DESIGN.width / 2, top + 198, 34, 'center');
  label(ctx, `Time flown   ${minutes(summary.seconds)}`, DESIGN.width / 2, top + 246, 34, 'center');
  label(ctx, `Best so far   ${summary.best}`, DESIGN.width / 2, top + 294, 28, 'center');
  label(ctx, 'Tap to fly again', DESIGN.width / 2, top + height - 34, 30, 'center');
  ctx.restore();
}
