import { DESIGN, drawSummaryCard, hand, label, type RunSummary } from '@bundle/core';
import type { Summary } from '../driver.js';
import { HUD } from './geometry.js';
import type { Sprites } from './sprites.js';
import { drawSprite } from './art.js';

export const clockText = (seconds: number): string => {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
};

function pill(ctx: CanvasRenderingContext2D, x: number, y: number, width: number): void {
  ctx.save();
  ctx.fillStyle = '#1f4f8f';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x - width / 2 + 26, y - 26);
  ctx.arcTo(x + width / 2, y - 26, x + width / 2, y + 26, 26);
  ctx.arcTo(x + width / 2, y + 26, x - width / 2, y + 26, 26);
  ctx.arcTo(x - width / 2, y + 26, x - width / 2, y - 26, 26);
  ctx.arcTo(x - width / 2, y - 26, x + width / 2, y - 26, 26);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function whiteText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number): void {
  ctx.font = hand(700, size);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, x, y + 1);
}

/** The top bar: trains sent, the time this run has lasted, and the pause button. */
export function drawTopBar(ctx: CanvasRenderingContext2D, sprites: Sprites, sent: number, seconds: number): void {
  pill(ctx, HUD.sent.x, HUD.sent.y, 150);
  drawSprite(ctx, sprites, 'crate-stack', { x: HUD.sent.x - 46, y: HUD.sent.y }, 40);
  whiteText(ctx, String(sent), HUD.sent.x + 22, HUD.sent.y, 34);
  pill(ctx, HUD.clock.x, HUD.clock.y, 150);
  drawSprite(ctx, sprites, 'stopwatch', { x: HUD.clock.x - 48, y: HUD.clock.y }, 44);
  whiteText(ctx, clockText(seconds), HUD.clock.x + 20, HUD.clock.y, 32);
  ctx.save();
  ctx.fillStyle = '#1f4f8f';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(HUD.pause.x, HUD.pause.y, HUD.pause.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(HUD.pause.x - 11, HUD.pause.y - 13, 8, 26);
  ctx.fillRect(HUD.pause.x + 3, HUD.pause.y - 13, 8, 26);
  ctx.restore();
}

/** The card at the end of a run, worded for the yard. */
export const summaryLines = (summary: Summary): RunSummary => ({
  score: summary.sent,
  bestStreak: 0,
  seconds: summary.seconds,
  best: summary.best,
  beatenBest: summary.beatenBest,
  headline: summary.beatenBest ? 'A new best!' : 'Good loading!',
  lines: [`Trains sent: ${summary.sent}`, `Time in the yard: ${clockText(summary.seconds)}`, `Best: ${summary.best} trains`],
});

export const drawSummary = (ctx: CanvasRenderingContext2D, summary: Summary): void => drawSummaryCard(ctx, summaryLines(summary));

/** While paused: the yard dimmed, and how to carry on. */
export function drawPaused(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.fillStyle = 'rgba(12,24,38,0.45)';
  ctx.fillRect(0, 0, DESIGN.width, DESIGN.height);
  label(ctx, 'Paused', DESIGN.width / 2, DESIGN.height / 2 - 30, 72, 'center');
  label(ctx, 'Tap to carry on', DESIGN.width / 2, DESIGN.height / 2 + 40, 34, 'center');
  ctx.restore();
}
