import {
  DESIGN,
  drawArrivingBanner,
  drawFuelBar,
  drawSummaryCard,
  hand,
  label,
  type Point,
} from '@bundle/core';
import { HEAL_AMOUNT } from '../logic/run.js';
import { SKY } from './geometry.js';
import { TIMING } from './timing.js';

export interface HudModel {
  /** 0 to 100. */
  health: number;
  score: number;
  streak: number;
  /** 0..1 through the crack animation, just after a heart is lost. */
  crack: number;
}

export function drawHud(ctx: CanvasRenderingContext2D, model: HudModel): void {
  ctx.save();
  // One notch per gold plane's worth, which is also four misses: the segments
  // price both what a mistake costs and what a gold one gives back.
  drawFuelBar(ctx, SKY.fieldLeft, SKY.hudY - 18, { health: model.health, flash: model.crack }, HEAL_AMOUNT);

  label(ctx, String(model.score), DESIGN.width - SKY.fieldLeft, SKY.hudY, 40, 'right');
  // A streak is worth naming only once it is a streak.
  if (model.streak >= 3) label(ctx, `${model.streak} in a row!`, DESIGN.width / 2, SKY.hudY, 26, 'center');
  ctx.restore();
}

/** A band announcing itself, in the bundle's shared grammar. */
export function drawBanner(ctx: CanvasRenderingContext2D, title: string, progress: number): void {
  drawArrivingBanner(ctx, title, progress, TIMING.bandSettleFraction, SKY.hudY);
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
  drawSummaryCard(ctx, {
    score: summary.score,
    bestStreak: summary.bestStreak,
    seconds: summary.seconds,
    best: summary.best,
    beatenBest: summary.beatenBest,
    headline: summary.beatenBest ? 'A new best!' : 'Good flying!',
    lines: [
      `Planes down   ${summary.score}`,
      `Longest streak   ${summary.bestStreak}`,
      `Time flown   ${minutes(summary.seconds)}`,
      `Best so far   ${summary.best}`,
    ],
  });
}
