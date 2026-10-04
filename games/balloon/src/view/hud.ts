import { DESIGN, drawSummaryCard, hand, label, type Point } from '@bundle/core';
import { feedbackLine, gaugeText, type Outcome } from '../logic/outcome.js';
import { HOME, LAYOUT } from './geometry.js';

export function drawTopBar(
  ctx: CanvasRenderingContext2D,
  model: { title: string; number: number; count: number; line: string; totalStars: number },
): void {
  ctx.save();
  label(ctx, `${model.number} of ${model.count}`, 40, LAYOUT.hudY, 26, 'left');
  label(ctx, model.title, DESIGN.width / 2, LAYOUT.hudY, 34, 'center');
  label(ctx, `★ ${model.totalStars}`, DESIGN.width - 40, LAYOUT.hudY, 30, 'right');
  label(ctx, model.line, DESIGN.width / 2, LAYOUT.lineY, 32, 'center');
  ctx.restore();
}

/**
 * After a wrong try: what a kit had over what it needed, and the gap in words.
 * Beside a lone kit, where the child is already looking; above each kit, smaller,
 * when there are two.
 */
export function drawGauge(
  ctx: CanvasRenderingContext2D,
  outcome: Outcome,
  centre: Point = { x: HOME.x + 340, y: HOME.y - 250 },
  small = false,
): void {
  const width = small ? 210 : 300;
  const height = small ? 100 : 140;
  ctx.save();
  ctx.fillStyle =
    outcome.verdict === 'exact' ? 'rgba(92,184,92,0.95)' : outcome.verdict === 'short' ? 'rgba(90,150,220,0.95)' : 'rgba(240,123,95,0.95)';
  ctx.beginPath();
  ctx.roundRect?.(centre.x - width / 2, centre.y - height / 2, width, height, 24);
  ctx.fill();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = hand(700, small ? 22 : 30);
  ctx.fillText(gaugeText(outcome), centre.x, centre.y - (small ? 20 : 28));
  ctx.fillStyle = '#ffffff';
  ctx.font = hand(700, small ? 34 : 46);
  ctx.fillText(feedbackLine(outcome), centre.x, centre.y + (small ? 16 : 22));
  ctx.restore();
}

/** The running total as the balloons light, counted on: "5…", then "8!". */
export function drawCount(ctx: CanvasRenderingContext2D, text: string, at: Point): void {
  ctx.save();
  label(ctx, text, at.x, at.y, 64, 'center');
  ctx.restore();
}

/** The sum the bunch made, above the ledge. The teaching beat. */
export function drawSolved(ctx: CanvasRenderingContext2D, lines: readonly string[], progress: number): void {
  ctx.save();
  ctx.globalAlpha = Math.min(1, progress * 4);
  lines.forEach((line, index) => label(ctx, line, DESIGN.width / 2, 200 + index * 64, 56, 'center'));
  ctx.restore();
}

function star(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, filled: boolean): void {
  ctx.beginPath();
  for (let point = 0; point < 10; point += 1) {
    const angle = -Math.PI / 2 + (point * Math.PI) / 5;
    const reach = point % 2 === 0 ? radius : radius * 0.45;
    ctx.lineTo(x + Math.cos(angle) * reach, y + Math.sin(angle) * reach);
  }
  ctx.closePath();
  ctx.fillStyle = filled ? '#ffcc3a' : 'rgba(255,255,255,0.7)';
  ctx.strokeStyle = 'rgba(30,42,56,0.35)';
  ctx.lineWidth = 3;
  ctx.fill();
  ctx.stroke();
}

/** The stars this rescue earned, arriving one at a time as `progress` runs 0..3. */
export function drawStars(ctx: CanvasRenderingContext2D, earned: number, progress: number): void {
  ctx.save();
  for (let index = 0; index < 3; index += 1) {
    const shown = index < earned && progress > index;
    const pop = shown ? Math.min(1, (progress - index) * 2) : 1;
    star(ctx, DESIGN.width / 2 + (index - 1) * 110, 400, 44 * (0.6 + 0.4 * pop), shown);
  }
  label(ctx, 'Tap for the next rescue', DESIGN.width / 2, 490, 32, 'center');
  ctx.restore();
}

/** Every kit is home. How many stars, never a failure screen. */
export function drawFinished(ctx: CanvasRenderingContext2D, totalStars: number, maxStars: number): void {
  drawSummaryCard(ctx, {
    score: totalStars,
    bestStreak: 0,
    seconds: 0,
    best: totalStars,
    beatenBest: false,
    headline: 'Everyone is home!',
    lines: [`Stars   ${totalStars} of ${maxStars}`, 'Every kit rescued'],
  });
}
