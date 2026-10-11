import { DESIGN, drawSummaryCard, label, type Point } from '@bundle/core';
import type { Outcome } from '../logic/world.js';
import { LAYOUT, TIMER } from './geometry.js';

/**
 * The level's line, along the sand at the bottom: the one strip of the screen
 * the boat never sails across. The level's name has its moment in the banner
 * as the level opens.
 */
export function drawTopBar(ctx: CanvasRenderingContext2D, line: string): void {
  ctx.save();
  label(ctx, line, LAYOUT.titleX, LAYOUT.lineY, 24, 'left');
  ctx.restore();
}

/** Under the timer: how far through, and the stars so far. */
export function drawProgress(ctx: CanvasRenderingContext2D, number: number, count: number, stars: number): void {
  const x = LAYOUT.timer.x + (TIMER.width * LAYOUT.timer.scale) / 2;
  const y = LAYOUT.timer.y + TIMER.height * LAYOUT.timer.scale + 16;
  ctx.save();
  label(ctx, `${number} of ${count}   ★ ${stars}`, x - 10, y, 20, 'center');
  ctx.restore();
}

/** Over the bucket, on the first levels: how many more it needs. */
export function drawGap(ctx: CanvasRenderingContext2D, gap: number, at: Point): void {
  if (gap <= 0) return;
  ctx.save();
  label(ctx, `${gap} more!`, at.x, at.y, 28, 'center');
  ctx.restore();
}

/** Words that rise over the boat and fade: "+5", "Reel faster!". */
export function drawFloat(ctx: CanvasRenderingContext2D, text: string, at: Point, progress: number): void {
  if (progress >= 1) return;
  ctx.save();
  ctx.globalAlpha = progress > 0.7 ? (1 - progress) / 0.3 : 1;
  label(ctx, text, at.x, at.y - progress * 60, text.length > 4 ? 34 : 46, 'center');
  ctx.restore();
}

function card(ctx: CanvasRenderingContext2D, width: number, height: number, centreY: number): { top: number } {
  const left = (DESIGN.width - width) / 2;
  const top = centreY - height / 2;
  const radius = 28;
  ctx.fillStyle = 'rgba(247,251,255,0.94)';
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

/** The sum the bucket made, written so it can be read: `5 + 3 + 2 = 10`. */
export const sumLine = (bucket: readonly number[]): string =>
  `${bucket.join(' + ')} = ${bucket.reduce((sum, weight) => sum + weight, 0)}`;

const sumSize = (text: string): number => Math.max(30, Math.min(56, 900 / (text.length * 0.55)));

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
 * The bucket is full: the sum it made, then the stars arriving one at a time
 * as `starProgress` runs 0..3. The sum is the teaching beat.
 */
export function drawWon(
  ctx: CanvasRenderingContext2D,
  bucket: readonly number[],
  appear: number,
  earned: number,
  starProgress: number,
  ready: boolean,
): void {
  ctx.save();
  ctx.globalAlpha = Math.min(1, appear * 3);
  const { top } = card(ctx, 720, 300, 430);
  label(ctx, 'Full to the top!', DESIGN.width / 2, top + 50, 40, 'center');
  const sum = sumLine(bucket);
  label(ctx, sum, DESIGN.width / 2, top + 118, sumSize(sum), 'center');
  for (let index = 0; index < 3; index += 1) {
    const shown = index < earned && starProgress > index;
    const pop = shown ? Math.min(1, (starProgress - index) * 2) : 1;
    star(ctx, DESIGN.width / 2 + (index - 1) * 100, top + 192, 36 * (0.6 + 0.4 * pop), shown);
  }
  if (ready) label(ctx, 'Tap for the next level', DESIGN.width / 2, top + 260, 26, 'center');
  ctx.restore();
}

/** Why it ends, in words a six-year-old can use next time. */
export function lostLines(outcome: Outcome, bucket: readonly number[], capacity: number, gap: number): [string, string, string] {
  const total = bucket.reduce((sum, weight) => sum + weight, 0);
  switch (outcome) {
    case 'capsized':
      return ['Too heavy! Splash!', sumLine(bucket), `${total} is more than ${capacity}`];
    case 'timeout':
      return ['Out of time!', `${total} in the bucket`, `It needed ${capacity - total} more`];
    case 'stuck':
      return [`Nothing here weighs ${gap}!`, `${total} in the bucket`, `${capacity - total} more can't be made`];
    case 'full':
      return ['', '', ''];
  }
}

export function drawLost(
  ctx: CanvasRenderingContext2D,
  lines: readonly [string, string, string],
  appear: number,
  ready: boolean,
): void {
  ctx.save();
  ctx.globalAlpha = Math.min(1, appear * 3);
  const { top } = card(ctx, 660, 270, 440);
  label(ctx, lines[0], DESIGN.width / 2, top + 50, 40, 'center');
  label(ctx, lines[1], DESIGN.width / 2, top + 112, sumSize(lines[1]), 'center');
  label(ctx, lines[2], DESIGN.width / 2, top + 168, 30, 'center');
  if (ready) label(ctx, 'Tap to try again', DESIGN.width / 2, top + 230, 26, 'center');
  ctx.restore();
}

/** Every bucket filled. Stars, never a failure screen. */
export function drawFinished(ctx: CanvasRenderingContext2D, totalStars: number, maxStars: number): void {
  drawSummaryCard(ctx, {
    score: totalStars,
    bestStreak: 0,
    seconds: 0,
    best: totalStars,
    beatenBest: false,
    headline: 'Every bucket full!',
    lines: [`Stars   ${totalStars} of ${maxStars}`, 'What a fisher!'],
  });
}
