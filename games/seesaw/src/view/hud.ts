import type { AnimalId } from '../logic/animals.js';
import type { TrayItem } from '../logic/game.js';
import { DESIGN } from './layout.js';
import { SCENE } from './geometry.js';
import type { SeesawTheme } from './theme.js';

/**
 * Prototype UI chrome: the tray of animals waiting to be placed, the one-line
 * objective, and the side highlights while an animal is armed. Kept apart from
 * the theme, which owns the world's art — the chrome is expected to be
 * redesigned separately from the park.
 */

export interface TraySlot {
  index: number;
  item: TrayItem;
  x: number;
  y: number;
  radius: number;
}

const TRAY_SPACING = 96;
export const TRAY_SLOT_RADIUS = 42;

export function traySlots(tray: readonly TrayItem[]): TraySlot[] {
  const available = tray.map((item, index) => ({ item, index })).filter(({ item }) => !item.used);
  const start = DESIGN.width / 2 - ((available.length - 1) * TRAY_SPACING) / 2;
  return available.map(({ item, index }, position) => ({
    index,
    item,
    x: start + position * TRAY_SPACING,
    y: SCENE.trayY,
    radius: TRAY_SLOT_RADIUS,
  }));
}

export interface HudModel {
  tray: readonly TrayItem[];
  selectedTrayIndex: number | null;
  caption: string;
  stageLabel: string | null;
  won: boolean;
  /** Arcade only: animals waiting to be placed, the current one first. */
  queue: readonly AnimalId[];
  /** Arcade only: 0..1 through the round, or null in a puzzle. */
  progress: number | null;
  /** Arcade only: 0..1 how close the waiting animal is to placing itself. */
  impatience: number;
  /** Endless only: seconds survived, and the record to beat. */
  survivalSeconds: number | null;
  bestSeconds: number | null;
}

const QUEUE_SPACING = 84;

/** Where the animal being placed sits, and where the ones behind it queue up. */
export function queueSlots(queue: readonly AnimalId[]): TraySlot[] {
  return queue.map((species, position) => ({
    index: position,
    item: { uid: `queue-${position}`, species, used: false },
    x: DESIGN.width / 2 + (position === 0 ? 0 : 30 + position * QUEUE_SPACING),
    y: SCENE.trayY,
    radius: position === 0 ? TRAY_SLOT_RADIUS : TRAY_SLOT_RADIUS * 0.7,
  }));
}

/** The survival bar: a round in progress, filling as it is survived. */
function drawProgress(ctx: CanvasRenderingContext2D, progress: number): void {
  const width = SCENE.gaugeWidth;
  const x = (DESIGN.width - width) / 2;
  const y = SCENE.gaugeY + 32;
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath();
  ctx.roundRect?.(x, y, width, 10, 5);
  if (!ctx.roundRect) ctx.rect(x, y, width, 10);
  ctx.fill();
  ctx.fillStyle = '#63c07a';
  ctx.beginPath();
  ctx.roundRect?.(x, y, width * Math.min(1, progress), 10, 5);
  if (!ctx.roundRect) ctx.rect(x, y, width * Math.min(1, progress), 10);
  ctx.fill();
  ctx.restore();
}

/**
 * The endless run: how long this one has lasted, and how it compares with the
 * best so far. A bar rather than a scoreboard, so beating your own record is
 * the reward and nothing else is dangled.
 */
function drawRun(ctx: CanvasRenderingContext2D, seconds: number, best: number | null): void {
  const width = SCENE.gaugeWidth;
  const x = (DESIGN.width - width) / 2;
  const y = SCENE.gaugeY + 32;
  const beaten = best !== null && seconds > best;
  const fraction = best && best > 0 ? Math.min(1, seconds / best) : Math.min(1, seconds / 60);

  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath();
  ctx.roundRect?.(x, y, width, 10, 5);
  if (!ctx.roundRect) ctx.rect(x, y, width, 10);
  ctx.fill();

  ctx.fillStyle = beaten ? '#ffc21f' : '#63c07a';
  ctx.beginPath();
  ctx.roundRect?.(x, y, width * fraction, 10, 5);
  if (!ctx.roundRect) ctx.rect(x, y, width * fraction, 10);
  ctx.fill();

  ctx.font = '700 22px system-ui, -apple-system, "Segoe UI", sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(29,43,50,0.85)';
  ctx.textAlign = 'left';
  ctx.fillText(`${Math.floor(seconds)}s`, x + width + 14, y + 4);
  if (best !== null && best > 0) {
    ctx.font = '600 16px system-ui, -apple-system, "Segoe UI", sans-serif';
    ctx.fillStyle = 'rgba(29,43,50,0.5)';
    ctx.textAlign = 'right';
    ctx.fillText(`best ${Math.floor(best)}s`, x - 14, y + 4);
  }
  ctx.restore();
}

/**
 * The queue: the animal being placed, prominent, with the next ones smaller
 * behind it. Seeing what is coming is what lets a child plan rather than only
 * react (source spec 5).
 */
function drawQueue(ctx: CanvasRenderingContext2D, theme: SeesawTheme, hud: HudModel, time: number): void {
  const slots = queueSlots(hud.queue);

  for (const slot of [...slots].reverse()) {
    const current = slot.index === 0;

    if (current) {
      // A ring that empties as the animal's patience runs out.
      ctx.save();
      ctx.strokeStyle = hud.impatience > 0.7 ? 'rgba(228,105,95,0.95)' : 'rgba(255,210,63,0.9)';
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(
        slot.x,
        slot.y - 6,
        TRAY_SLOT_RADIUS + 8,
        -Math.PI / 2,
        -Math.PI / 2 + Math.PI * 2 * (1 - hud.impatience),
      );
      ctx.stroke();
      ctx.restore();
    }

    theme.animals.draw(ctx, slot.item.species, {
      x: slot.x,
      y: slot.y + (current ? 24 : 16),
      scale: current ? 0.78 : 0.5,
      tiltRad: 0,
      wobble: current ? Math.sin(time * 6) * 0.25 : 0,
      slide: 0,
      dance: 0,
      expression: 'calm',
    });
  }
}

export function drawHud(ctx: CanvasRenderingContext2D, theme: SeesawTheme, hud: HudModel, time: number): void {
  // Objective caption, one short line, low in the visual hierarchy.
  ctx.save();
  ctx.font = '600 30px system-ui, -apple-system, "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(29,43,50,0.82)';
  ctx.fillText(hud.caption, DESIGN.width / 2, 36);
  if (hud.stageLabel) {
    ctx.font = '600 20px system-ui, -apple-system, "Segoe UI", sans-serif';
    ctx.fillStyle = 'rgba(29,43,50,0.55)';
    ctx.fillText(hud.stageLabel, DESIGN.width / 2, 142);
  }
  ctx.restore();

  if (hud.progress !== null) drawProgress(ctx, hud.progress);
  else if (hud.survivalSeconds !== null) drawRun(ctx, hud.survivalSeconds, hud.bestSeconds);

  if (hud.queue.length > 0) {
    drawQueue(ctx, theme, hud, time);
    return;
  }

  // Tray shelf.
  const slots = traySlots(hud.tray);
  if (slots.length > 0) {
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.42)';
    const left = slots[0]!.x - TRAY_SLOT_RADIUS - 16;
    const width = slots.at(-1)!.x + TRAY_SLOT_RADIUS + 16 - left;
    // Kept short enough to clear the fulcrum's base, so the seesaw does not
    // look like it is standing on the tray.
    const top = SCENE.trayY - 44;
    ctx.beginPath();
    ctx.roundRect?.(left, top, width, 88, 24);
    if (!ctx.roundRect) ctx.rect(left, top, width, 88);
    ctx.fill();
    ctx.restore();
  }

  for (const slot of slots) {
    const selected = slot.index === hud.selectedTrayIndex;
    ctx.save();
    if (selected) {
      // A soft ring, pulsing, so the armed animal is obvious without text.
      ctx.beginPath();
      ctx.arc(slot.x, slot.y, TRAY_SLOT_RADIUS + 4 + Math.sin(time * 6) * 2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,210,63,0.55)';
      ctx.fill();
    }
    ctx.restore();

    theme.animals.draw(ctx, slot.item.species, {
      x: slot.x,
      // Tray animals stand on the shelf, so the pose sits at their feet too.
      y: slot.y + 24,
      scale: selected ? 0.68 : 0.6,
      tiltRad: 0,
      wobble: selected ? Math.sin(time * 7) * 0.35 : 0,
      slide: 0,
      dance: 0,
      expression: 'calm',
    });
  }
}

/** Highlights the two landing areas while an animal is armed. */
export function drawSideTargets(ctx: CanvasRenderingContext2D, plankAngle: number, time: number): void {
  const pulse = 0.25 + Math.sin(time * 5) * 0.1;
  for (const direction of [-1, 1]) {
    const armX = direction * SCENE.plankHalfLength;
    const x = SCENE.fulcrumX + armX * Math.cos(plankAngle);
    const y = SCENE.fulcrumY + armX * Math.sin(plankAngle);
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.ellipse(x, y - 60, SCENE.platformWidth / 2, 78, plankAngle, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
