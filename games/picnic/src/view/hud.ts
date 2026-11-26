import { DESIGN, drawSummaryCard, label } from '@bundle/core';
import { HUD } from './geometry.js';

/** The round's line, along the top: what this round is about. */
export function drawTopBar(ctx: CanvasRenderingContext2D, line: string): void {
  ctx.save();
  label(ctx, line, HUD.lineX, HUD.lineY, 26, 'center');
  ctx.restore();
}

/** Top right: how far through, and the stars so far. */
export function drawProgress(ctx: CanvasRenderingContext2D, number: number, count: number, stars: number): void {
  ctx.save();
  label(ctx, `${number} of ${count}`, HUD.progressX - 92, HUD.progressY, 22, 'right');
  label(ctx, `★ ${stars}`, HUD.progressX, HUD.progressY, 22, 'right');
  ctx.restore();
}

function card(ctx: CanvasRenderingContext2D, width: number, height: number, centreY: number): { top: number } {
  const left = (DESIGN.width - width) / 2;
  const top = centreY - height / 2;
  const radius = 28;
  ctx.fillStyle = 'rgba(255,252,244,0.95)';
  ctx.beginPath();
  ctx.moveTo(left + radius, top);
  ctx.arcTo(left + width, top, left + width, top + height, radius);
  ctx.arcTo(left + width, top + height, left, top + height, radius);
  ctx.arcTo(left, top + height, left, top, radius);
  ctx.arcTo(left, top, left + width, top, radius);
  ctx.closePath();
  ctx.fill();
  return { top };
}

function star(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, filled: boolean): void {
  ctx.beginPath();
  for (let point = 0; point < 10; point += 1) {
    const angle = -Math.PI / 2 + (point * Math.PI) / 5;
    const reach = point % 2 === 0 ? radius : radius * 0.45;
    ctx.lineTo(x + Math.cos(angle) * reach, y + Math.sin(angle) * reach);
  }
  ctx.closePath();
  ctx.fillStyle = filled ? '#ffcc3a' : 'rgba(30,42,56,0.12)';
  ctx.strokeStyle = 'rgba(30,42,56,0.35)';
  ctx.lineWidth = 3;
  ctx.fill();
  ctx.stroke();
}

/**
 * Everyone has the same: what each course came to, then the stars arriving one
 * at a time as `starProgress` runs 0..3. The sentences are the teaching beat.
 */
export function drawDone(
  ctx: CanvasRenderingContext2D,
  lines: readonly string[],
  appear: number,
  earned: number,
  starProgress: number,
  ready: boolean,
): void {
  ctx.save();
  ctx.globalAlpha = Math.min(1, appear * 3);
  const height = 236 + lines.length * 46;
  const { top } = card(ctx, 720, height, 400);
  label(ctx, 'Everyone has the same!', DESIGN.width / 2, top + 48, 40, 'center');
  lines.forEach((line, index) => label(ctx, line, DESIGN.width / 2, top + 106 + index * 46, 32, 'center'));
  const starsY = top + 106 + lines.length * 46 + 30;
  for (let index = 0; index < 3; index += 1) {
    const shown = index < earned && starProgress > index;
    const pop = shown ? Math.min(1, (starProgress - index) * 2) : 1;
    star(ctx, DESIGN.width / 2 + (index - 1) * 100, starsY, 34 * (0.6 + 0.4 * pop), shown);
  }
  if (ready) label(ctx, 'Tap for the next picnic', DESIGN.width / 2, top + height - 30, 26, 'center');
  ctx.restore();
}

/** Every picnic done. Stars, never a failure screen. */
export function drawFinished(ctx: CanvasRenderingContext2D, totalStars: number, maxStars: number): void {
  drawSummaryCard(ctx, {
    score: totalStars,
    bestStreak: 0,
    seconds: 0,
    best: totalStars,
    beatenBest: false,
    headline: 'Every picnic shared!',
    lines: [`Stars   ${totalStars} of ${maxStars}`, 'What a good friend!'],
  });
}
