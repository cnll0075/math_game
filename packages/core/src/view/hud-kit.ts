import { DESIGN } from './viewport.js';
import { hand } from './type.js';

/**
 * The game's lettering, with a pale rim under it so it stays readable against
 * any background a game happens to draw behind it.
 */
export const label = (
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

export interface FuelModel {
  /** 0 to 100. */
  health: number;
  /** 0..1 through the flash that follows a drop. */
  flash: number;
}

/** Green while there is plenty, amber when it matters, red when it is nearly out. */
const fuelColour = (health: number): string => {
  if (health > 60) return '#5cb85c';
  if (health > 30) return '#f0a32e';
  return '#e8543f';
};

/**
 * The fuel a run flies on. A bar rather than a row of lives because it drains
 * visibly: a life blinking out of existence said nothing about why, and a bar
 * that slides down in front of you says it without a word.
 *
 * `notchEvery` is whatever one reward is worth in that game, so the segments
 * price both a mistake and its remedy.
 */
export function drawFuelBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  model: FuelModel,
  notchEvery: number,
): void {
  const width = 240;
  const height = 26;
  const share = Math.max(0, Math.min(1, model.health / 100));

  ctx.save();
  ctx.translate(x, y);

  // The empty tank behind it, so what is gone is as visible as what is left.
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.strokeStyle = 'rgba(30,42,56,0.35)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect?.(0, 0, width, height, 13);
  ctx.fill();
  ctx.stroke();

  if (share > 0) {
    ctx.fillStyle = fuelColour(model.health);
    ctx.beginPath();
    ctx.roundRect?.(0, 0, Math.max(height, width * share), height, 13);
    ctx.fill();
  }

  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 2;
  for (let mark = notchEvery; mark < 100; mark += notchEvery) {
    const at = width * (mark / 100);
    ctx.beginPath();
    ctx.moveTo(at, 4);
    ctx.lineTo(at, height - 4);
    ctx.stroke();
  }

  // A flash across the bar on the beat it drops.
  if (model.flash > 0) {
    ctx.fillStyle = `rgba(232,84,63,${0.5 * model.flash})`;
    ctx.beginPath();
    ctx.roundRect?.(0, 0, width, height, 13);
    ctx.fill();
  }

  ctx.font = hand(700, 17);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#1e2a38';
  ctx.fillText(`${Math.round(model.health)}%`, width / 2, height / 2 + 1);
  ctx.restore();
}

/**
 * Something announcing itself: large in the middle, then away to its home in
 * the top bar, so a change in the rules is seen arriving rather than
 * discovered. Every game in the bundle uses the same grammar, because a child
 * who has played one already knows what a banner means.
 */
export function drawArrivingBanner(
  ctx: CanvasRenderingContext2D,
  title: string,
  progress: number,
  settleFraction: number,
  homeY: number,
): void {
  const settle = Math.max(0, (progress - (1 - settleFraction)) / settleFraction);
  const y = DESIGN.height * 0.38 + (homeY - DESIGN.height * 0.38) * settle;
  const scale = 1 - 0.55 * settle;
  ctx.save();
  ctx.translate(DESIGN.width / 2, y);
  ctx.scale(scale, scale);
  ctx.globalAlpha = progress > 0.92 ? (1 - progress) / 0.08 : 1;
  label(ctx, title, 0, 0, 76, 'center');
  ctx.restore();
}

export interface RunSummary {
  score: number;
  bestStreak: number;
  seconds: number;
  best: number;
  beatenBest: boolean;
  /** Each game words its own: "A new best!", "Good flying!", "Good running!" */
  headline: string;
  /** The rows of the card, already worded, so core never names a plane. */
  lines: readonly string[];
}

/** How far you got, never a failure screen. */
export function drawSummaryCard(ctx: CanvasRenderingContext2D, summary: RunSummary): void {
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

  label(ctx, summary.headline, DESIGN.width / 2, top + 62, 52, 'center');
  const spacing = Math.min(48, (height - 190) / Math.max(1, summary.lines.length));
  summary.lines.forEach((line, index) => {
    label(ctx, line, DESIGN.width / 2, top + 140 + index * spacing, 32, 'center');
  });
  label(ctx, 'Tap to go again', DESIGN.width / 2, top + height - 34, 30, 'center');
  ctx.restore();
}
