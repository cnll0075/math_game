import { DESIGN, drawFuelBar, drawSummaryCard, hand, label, type Point } from '@bundle/core';
import { BERRY_GIVES } from '../logic/run.js';
import { PATH } from './geometry.js';

export interface HudModel {
  health: number;
  score: number;
  streak: number;
  /** 0..1 through the flash that follows a drop. */
  flash: number;
}

export function drawHud(ctx: CanvasRenderingContext2D, model: HudModel): void {
  ctx.save();
  // One notch per berry's worth, so the bar prices both a mistake and a reward.
  drawFuelBar(ctx, PATH.left, PATH.hudY - 18, { health: model.health, flash: model.flash }, BERRY_GIVES);
  label(ctx, String(model.score), DESIGN.width - PATH.left, PATH.hudY, 40, 'right');
  if (model.streak >= 3) label(ctx, `${model.streak} in a row!`, DESIGN.width / 2, PATH.hudY, 26, 'center');
  ctx.restore();
}

/**
 * The solved sum, where the obstacle burst. This is the teaching beat: the
 * child sees the whole thing finished, which is their confirmation.
 */
export function drawSolved(ctx: CanvasRenderingContext2D, at: Point, text: string, progress: number): void {
  ctx.save();
  ctx.globalAlpha = Math.max(0, 1 - progress * progress);
  ctx.translate(at.x, at.y - progress * 44);
  label(ctx, text, 0, 0, 42, 'center');
  ctx.restore();
}

/**
 * What just cost a tenth of the tank, said in the middle of the screen where
 * the player is already looking. The rabbit's sign holds it too, but this is
 * the one that gets read.
 */
export function drawThump(ctx: CanvasRenderingContext2D, text: string, progress: number): void {
  ctx.save();
  ctx.globalAlpha = progress > 0.8 ? (1 - progress) / 0.2 : 1;
  ctx.translate(DESIGN.width / 2, DESIGN.height * 0.3);
  const width = Math.max(420, text.length * 34);
  const height = 150;
  ctx.fillStyle = 'rgba(232,84,63,0.95)';
  ctx.beginPath();
  ctx.roundRect?.(-width / 2, -height / 2, width, height, 24);
  ctx.fill();
  ctx.font = hand(700, 32);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.fillText('Bumped it!', 0, -34);
  ctx.font = hand(700, 58);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, 0, 26);
  ctx.restore();
}

export interface Summary {
  score: number;
  bestStreak: number;
  seconds: number;
  distance: number;
  best: number;
  beatenBest: boolean;
}

const minutes = (seconds: number): string => {
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
};

export function drawSummary(ctx: CanvasRenderingContext2D, summary: Summary): void {
  drawSummaryCard(ctx, {
    score: summary.score,
    bestStreak: summary.bestStreak,
    seconds: summary.seconds,
    best: summary.best,
    beatenBest: summary.beatenBest,
    headline: summary.beatenBest ? 'A new best!' : 'Good running!',
    lines: [
      `Obstacles burst   ${summary.score}`,
      `Longest streak   ${summary.bestStreak}`,
      `Paces run   ${Math.round(summary.distance)}`,
      `Time running   ${minutes(summary.seconds)}`,
      `Best so far   ${summary.best}`,
    ],
  });
}
