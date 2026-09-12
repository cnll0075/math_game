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

  // Tray shelf.
  const slots = traySlots(hud.tray);
  if (slots.length > 0) {
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    const left = slots[0]!.x - TRAY_SLOT_RADIUS - 16;
    const width = slots.at(-1)!.x + TRAY_SLOT_RADIUS + 16 - left;
    ctx.beginPath();
    ctx.roundRect?.(left, SCENE.trayY - 58, width, 104, 26);
    if (!ctx.roundRect) ctx.rect(left, SCENE.trayY - 58, width, 104);
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
