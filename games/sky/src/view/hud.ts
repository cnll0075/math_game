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
import { INNER } from './plane-art.js';
import { NO_SPRITES, type Sprites } from './sprites.js';
import { TIMING } from './timing.js';

export interface HudModel {
  /** 0 to 100. */
  health: number;
  score: number;
  streak: number;
  /** 0..1 through the crack animation, just after a heart is lost. */
  crack: number;
}

/** Green while there is plenty, amber when it matters, red when it is nearly out: as the bundle's fuel bars. */
const fuelColour = (health: number): string => (health > 60 ? '#5cb85c' : health > 30 ? '#f0a32e' : '#e8543f');

export function drawHud(ctx: CanvasRenderingContext2D, model: HudModel, sprites: Sprites = NO_SPRITES): void {
  const fuel = sprites.fuel;
  const badge = sprites.score;
  if (fuel && badge) {
    drawPaintedHud(ctx, model, fuel, badge);
    return;
  }
  ctx.save();
  // One notch per gold plane's worth, which is also four misses: the segments
  // price both what a mistake costs and what a gold one gives back.
  drawFuelBar(ctx, SKY.fieldLeft, SKY.hudY - 18, { health: model.health, flash: model.crack }, HEAL_AMOUNT);

  label(ctx, String(model.score), DESIGN.width - SKY.fieldLeft, SKY.hudY, 40, 'right');
  // A streak is worth naming only once it is a streak.
  if (model.streak >= 3) label(ctx, `${model.streak} in a row!`, DESIGN.width / 2, SKY.hudY, 26, 'center');
  ctx.restore();
}

/**
 * The painted fuel gauge, its blank bar filled to what is left and notched per
 * gold plane's worth; and the score in its star badge.
 */
function drawPaintedHud(ctx: CanvasRenderingContext2D, model: HudModel, fuel: HTMLImageElement, badge: HTMLImageElement): void {
  ctx.save();
  const height = 58;
  const width = (height * fuel.width) / fuel.height;
  const left = SKY.fieldLeft - 30;
  const top = SKY.hudY - height / 2;
  ctx.drawImage(fuel, left, top, width, height);
  const inner = INNER.fuel;
  const bar = { x: left + width * inner.left, y: top + height * inner.top, w: width * (inner.right - inner.left), h: height * (inner.bottom - inner.top) };
  const share = Math.max(0, Math.min(1, model.health / 100));
  if (share > 0) {
    ctx.fillStyle = fuelColour(model.health);
    ctx.beginPath();
    ctx.roundRect?.(bar.x, bar.y, Math.max(bar.h, bar.w * share), bar.h, bar.h / 2);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 2;
  for (let mark = HEAL_AMOUNT; mark < 100; mark += HEAL_AMOUNT) {
    const x = bar.x + bar.w * (mark / 100);
    ctx.beginPath();
    ctx.moveTo(x, bar.y + 3);
    ctx.lineTo(x, bar.y + bar.h - 3);
    ctx.stroke();
  }
  if (model.crack > 0) {
    ctx.fillStyle = `rgba(232,84,63,${0.5 * model.crack})`;
    ctx.beginPath();
    ctx.roundRect?.(bar.x, bar.y, bar.w, bar.h, bar.h / 2);
    ctx.fill();
  }
  ctx.font = hand(700, 17);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#1e2a38';
  ctx.fillText(`${Math.round(model.health)}%`, bar.x + bar.w / 2, bar.y + bar.h / 2 + 1);

  const badgeWidth = (height * badge.width) / badge.height;
  const badgeLeft = DESIGN.width - SKY.fieldLeft + 30 - badgeWidth;
  ctx.drawImage(badge, badgeLeft, top, badgeWidth, height);
  const space = INNER.score;
  ctx.font = hand(700, 32);
  ctx.fillText(String(model.score), badgeLeft + badgeWidth * (space.left + space.right) / 2, top + height * (space.top + space.bottom) / 2 + 1);
  if (model.streak >= 3) label(ctx, `${model.streak} in a row!`, DESIGN.width / 2, SKY.hudY, 26, 'center');
  ctx.restore();
}

/**
 * A band announcing itself, in the bundle's shared grammar: large in the
 * middle, then away to the top bar. Painted, it arrives on a ribbon.
 */
export function drawBanner(ctx: CanvasRenderingContext2D, title: string, progress: number, sprites: Sprites = NO_SPRITES): void {
  const ribbon = sprites.ribbon;
  if (ribbon) {
    // The same path the bundle's banners take, so the ribbon carries the words.
    const settle = Math.max(0, (progress - (1 - TIMING.bandSettleFraction)) / TIMING.bandSettleFraction);
    const y = DESIGN.height * 0.38 + (SKY.hudY - DESIGN.height * 0.38) * settle;
    const scale = 1 - 0.55 * settle;
    const width = Math.max(520, title.length * 44 + 160);
    const height = (width * ribbon.height) / ribbon.width;
    ctx.save();
    ctx.translate(DESIGN.width / 2, y);
    ctx.scale(scale, scale);
    ctx.globalAlpha = progress > 0.92 ? (1 - progress) / 0.08 : 1;
    ctx.drawImage(ribbon, -width / 2, -height * 0.42, width, height);
    ctx.restore();
  }
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
export function drawLoss(ctx: CanvasRenderingContext2D, text: string, progress: number, sprites: Sprites = NO_SPRITES): void {
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
  const heart = sprites['heart-cracked'];
  if (heart) ctx.drawImage(heart, -36, top - 52, 72, 62);
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

/** How far you flew, never a failure screen. Painted, on the end-of-run card. */
export function drawSummary(ctx: CanvasRenderingContext2D, summary: Summary, sprites: Sprites = NO_SPRITES): void {
  const card = sprites.card;
  if (card) {
    const lines = summaryLines(summary);
    const width = 660;
    const height = (width * card.height) / card.width;
    const left = (DESIGN.width - width) / 2;
    const top = (DESIGN.height - height) / 2 + 20;
    const inner = INNER.card;
    ctx.save();
    ctx.fillStyle = 'rgba(12,24,38,0.55)';
    ctx.fillRect(0, 0, DESIGN.width, DESIGN.height);
    ctx.drawImage(card, left, top, width, height);
    const innerTop = top + height * inner.top;
    const innerHeight = height * (inner.bottom - inner.top);
    label(ctx, summary.beatenBest ? 'A new best!' : 'Good flying!', DESIGN.width / 2, innerTop + 42, 46, 'center');
    lines.forEach((line, index) => label(ctx, line, DESIGN.width / 2, innerTop + 100 + index * 40, 30, 'center'));
    label(ctx, 'Tap to go again', DESIGN.width / 2, innerTop + innerHeight - 6, 28, 'center');
    ctx.restore();
    return;
  }
  drawSummaryCard(ctx, {
    score: summary.score,
    bestStreak: summary.bestStreak,
    seconds: summary.seconds,
    best: summary.best,
    beatenBest: summary.beatenBest,
    headline: summary.beatenBest ? 'A new best!' : 'Good flying!',
    lines: summaryLines(summary),
  });
}

const summaryLines = (summary: Summary): string[] => [
  `Planes down   ${summary.score}`,
  `Longest streak   ${summary.bestStreak}`,
  `Time flown   ${minutes(summary.seconds)}`,
  `Best so far   ${summary.best}`,
];
