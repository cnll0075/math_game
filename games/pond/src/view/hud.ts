import { DESIGN, hand, label } from '@bundle/core';
import type { BoardDef } from '../logic/boards.data.js';
import type { StarBook } from '../logic/stars.js';
import { LAYOUT, pickerRect } from './geometry.js';

/** Darkens everything behind an overlay — past the design rect too, so a wide screen has no bright edges. */
function dim(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = 'rgba(12,24,38,0.45)';
  ctx.fillRect(-DESIGN.width, -DESIGN.height, DESIGN.width * 3, DESIGN.height * 3);
}

function panel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string): void {
  const radius = 24;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
  ctx.fill();
}

export function drawTopBar(ctx: CanvasRenderingContext2D, model: { title: string; totalStars: number }): void {
  ctx.save();
  const { left, top, width, height } = LAYOUT.boardsButton;
  panel(ctx, left, top, width, height, 'rgba(255,255,255,0.8)');
  label(ctx, 'Boards', left + width / 2, top + height / 2, 28, 'center');
  label(ctx, model.title, DESIGN.width / 2, LAYOUT.hudY, 38, 'center');
  label(ctx, `★ ${model.totalStars}`, DESIGN.width - 40, LAYOUT.hudY, 30, 'right');
  ctx.restore();
}

/** The match, written out over the pond — `3 + 4 = 7 = 9 − 2`. The teaching beat. */
export function drawMatchLine(ctx: CanvasRenderingContext2D, text: string, progress: number): void {
  ctx.save();
  ctx.globalAlpha = progress > 0.8 ? Math.max(0, (1 - progress) / 0.2) : 1;
  // In the top bar, over the board's name, so it never covers a pad the child
  // may want next.
  panel(ctx, DESIGN.width / 2 - 300, LAYOUT.hudY - 40, 600, 80, 'rgba(255,255,255,0.96)');
  label(ctx, text, DESIGN.width / 2, LAYOUT.hudY, 44, 'center');
  ctx.restore();
}

function stars(ctx: CanvasRenderingContext2D, x: number, y: number, earned: number, progress: number): void {
  for (let index = 0; index < 3; index += 1) {
    const shown = index < earned && progress > index;
    ctx.font = hand(700, shown ? 64 : 56);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = shown ? '#ffc93a' : 'rgba(255,255,255,0.75)';
    ctx.fillText('★', x + (index - 1) * 90, y);
  }
}

/** A board cleared: how it went, never a failure screen. */
export function drawEndCard(
  ctx: CanvasRenderingContext2D,
  model: { stars: number; progress: number; misses: number; pairs: number; last: boolean },
): void {
  ctx.save();
  dim(ctx);
  panel(ctx, DESIGN.width / 2 - 320, 180, 640, 420, '#f7fbff');
  label(ctx, 'Pond cleared!', DESIGN.width / 2, 250, 52, 'center');
  stars(ctx, DESIGN.width / 2, 340, model.stars, model.progress);
  label(ctx, `Pairs   ${model.pairs}`, DESIGN.width / 2, 420, 32, 'center');
  label(ctx, `Misses   ${model.misses}`, DESIGN.width / 2, 466, 32, 'center');
  label(ctx, model.last ? 'Tap to play again' : 'Tap for the next board', DESIGN.width / 2, 550, 30, 'center');
  ctx.restore();
}

/** Every board, its best stars, and the ones still locked. Tap outside to close. */
export function drawPicker(
  ctx: CanvasRenderingContext2D,
  model: { boards: readonly BoardDef[]; book: StarBook; open: readonly boolean[]; current: number },
): void {
  ctx.save();
  dim(ctx);
  const { left, top, width, height } = LAYOUT.picker;
  panel(ctx, left - 20, top - 70, width + 40, height + 90, '#f7fbff');
  label(ctx, 'Choose a board', DESIGN.width / 2, top - 32, 36, 'center');
  model.boards.forEach((board, index) => {
    const rect = pickerRect(index);
    const open = model.open[index] ?? false;
    ctx.globalAlpha = open ? 1 : 0.5;
    panel(ctx, rect.x, rect.y, rect.w, rect.h, index === model.current ? '#cfeec3' : '#e4f3f7');
    label(ctx, board.title, rect.x + rect.w / 2, rect.y + rect.h * 0.38, 34, 'center');
    const earned = model.book[board.id] ?? 0;
    const line = open ? '★'.repeat(earned) + '☆'.repeat(3 - earned) : 'locked';
    label(ctx, line, rect.x + rect.w / 2, rect.y + rect.h * 0.7, 28, 'center');
    ctx.globalAlpha = 1;
  });
  ctx.restore();
}
