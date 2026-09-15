import type { TrayItem } from '../logic/game.js';
import { DESIGN } from './layout.js';
import { SCENE } from './geometry.js';
import { TIMING } from './timing.js';
import type { SeesawTheme } from './theme.js';

export interface HudModel {
  tray: readonly TrayItem[];
  selectedTrayIndex: number | null;
  caption: string;
  won: boolean;
  /** The chapter's name, on the question that opens it. */
  chapter: string | null;
  /** 0..1 through the goal's arrival, or null when it has settled. */
  announcing: number | null;
}

/** Where the goal sits once it has settled. */
const GOAL_RESTING_Y = 36;
/** Where it arrives, before flying up: over the sky, clear of the seesaw. */
const GOAL_ARRIVAL_Y = 196;

const ease = (t: number): number => 1 - (1 - t) * (1 - t);

/**
 * The goal, arriving. Every level asks for something different, and a caption
 * that merely changes is easy to miss: this one appears big in the middle of
 * the scene, holds, then flies up to its place at the top. It fires again when
 * a level's next challenge begins, so a new ask always announces itself.
 */
function drawGoal(ctx: CanvasRenderingContext2D, theme: SeesawTheme, hud: HudModel, time: number): void {
  const settleAt = 1 - TIMING.goalSettleFraction;
  const arriving = hud.announcing !== null;
  const through = hud.announcing ?? 1;

  let y = GOAL_RESTING_Y;
  let scale = 1;
  let cardAlpha = 0;

  if (arriving) {
    if (through < settleAt) {
      // Popping in and holding, centre stage.
      // Starts at two thirds rather than nothing, so even the first frame
      // reads as a goal arriving rather than as a speck.
      const pop = Math.min(1, through / 0.12);
      y = GOAL_ARRIVAL_Y;
      scale = 1.7 * (0.66 + 0.34 * ease(pop));
      cardAlpha = ease(pop);
    } else {
      // Flying up to the bar.
      const settle = ease((through - settleAt) / TIMING.goalSettleFraction);
      y = GOAL_ARRIVAL_Y + (GOAL_RESTING_Y - GOAL_ARRIVAL_Y) * settle;
      scale = 1.7 + (1 - 1.7) * settle;
      cardAlpha = 1 - settle;
    }
  }

  ctx.save();
  ctx.translate(DESIGN.width / 2, y);
  ctx.scale(scale, scale);

  if (cardAlpha > 0.01) {
    const longest = Math.max(hud.caption.length, hud.chapter?.length ?? 0);
    const width = 34 + longest * 15;
    const height = hud.chapter && arriving ? 96 : 60;
    ctx.globalAlpha = cardAlpha * 0.9;
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.beginPath();
    ctx.roundRect?.(-width / 2, -height / 2, width, height, 24);
    if (!ctx.roundRect) ctx.rect(-width / 2, -height / 2, width, height);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  if (hud.chapter && arriving) {
    // A new chapter gets its name, with the question underneath it.
    ctx.font = '700 34px system-ui, -apple-system, "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#d8842b';
    ctx.fillText(hud.chapter, 0, -16);
    ctx.font = '600 26px system-ui, -apple-system, "Segoe UI", sans-serif';
    ctx.fillStyle = 'rgba(29,43,50,0.86)';
    ctx.fillText(hud.caption, 0, 20);
  } else {
    ctx.font = '600 30px system-ui, -apple-system, "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(29,43,50,0.86)';
    ctx.fillText(hud.caption, 0, 0);
  }
  ctx.restore();

}

export interface TraySlot {
  index: number;
  item: TrayItem;
  x: number;
  y: number;
  radius: number;
}

const TRAY_SPACING = 96;
/** Groups need a pen each, so they stand further apart than single animals. */
const GROUP_SPACING = 178;
export const TRAY_SLOT_RADIUS = 42;

export function traySlots(tray: readonly TrayItem[]): TraySlot[] {
  const available = tray.map((item, index) => ({ item, index })).filter(({ item }) => !item.used);
  const spacing = available.some(({ item }) => item.count > 1) ? GROUP_SPACING : TRAY_SPACING;
  const start = DESIGN.width / 2 - ((available.length - 1) * spacing) / 2;
  return available.map(({ item, index }, position) => ({
    index,
    item,
    x: start + position * spacing,
    y: SCENE.trayY,
    radius: item.count > 1 ? TRAY_SLOT_RADIUS + 32 : TRAY_SLOT_RADIUS,
  }));
}

/**
 * Where each member of a group sits in its pen. The whole question in this
 * chapter is "how many?", so no animal may hide behind another: two and three
 * stand in a row, four stand in a square, and nothing overlaps.
 */
export function groupOffsets(count: number): Array<{ x: number; y: number; scale: number }> {
  if (count <= 1) return [{ x: 0, y: 0, scale: 1 }];

  const perRow = count <= 3 ? count : 2;
  const rows = Math.ceil(count / perRow);
  const acrossGap = count <= 2 ? 50 : 46;
  const downGap = 44;
  const scale = count <= 2 ? 0.56 : count === 3 ? 0.5 : 0.46;

  return Array.from({ length: count }, (_, index) => {
    const row = Math.floor(index / perRow);
    const inRow = index % perRow;
    const rowCount = Math.min(perRow, count - row * perRow);
    return {
      x: (inRow - (rowCount - 1) / 2) * acrossGap,
      // Back rows sit higher, and far enough up to clear the row in front.
      y: (row - (rows - 1) / 2) * -downGap,
      scale,
    };
  });
}

/**
 * A tray item: one animal, or a huddle of them with the total on a tag. A group
 * is picked up as one thing, so the question is which group fits rather than
 * how many times to drag.
 */
function drawTrayItem(
  ctx: CanvasRenderingContext2D,
  theme: SeesawTheme,
  slot: TraySlot,
  selected: boolean,
  time: number,
): void {
  const { item } = slot;
  const offsets = groupOffsets(item.count);

  if (item.count > 1) {
    // A pen around the huddle, so it reads as one thing to pick up.
    ctx.save();
    ctx.fillStyle = selected ? 'rgba(255,210,63,0.3)' : 'rgba(255,255,255,0.45)';
    ctx.strokeStyle = selected ? 'rgba(224,165,0,0.9)' : 'rgba(29,43,50,0.22)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    const width = slot.radius * 2 + 10;
    const height = TRAY_SLOT_RADIUS * 2 + (item.count > 2 ? 56 : 12);
    // A tall pen has to sit higher, or its bottom runs off the screen.
    const lift = item.count > 2 ? 26 : 6;
    ctx.roundRect?.(slot.x - width / 2, slot.y - height / 2 - lift, width, height, 22);
    if (!ctx.roundRect) ctx.rect(slot.x - width / 2, slot.y - height / 2 - lift, width, height);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // Back rows first, so the front of the huddle overlaps them.
  const memberPose = (offset: { x: number; y: number; scale: number }) => ({
    x: slot.x + offset.x,
    y: slot.y + offset.y + (item.count > 2 ? -2 : 18),
    scale: (selected ? 0.68 : 0.6) * offset.scale * (item.count > 1 ? 1.5 : 1),
    tiltRad: 0,
    wobble: selected ? Math.sin(time * 7 + offset.x) * 0.3 : 0,
    slide: 0,
    dance: 0,
    arriving: 1,
    clock: time,
    // In the tray they face the middle of the screen, as they will on the plank.
    facing: (slot.x > DESIGN.width / 2 ? -1 : 1) as 1 | -1,
    expression: 'calm' as const,
  });

  // Back rows first, then every tag, as on the plank.
  const ordered = [...offsets].sort((a, b) => a.y - b.y);
  for (const offset of ordered) theme.animals.draw(ctx, item.species, memberPose(offset));
  for (const offset of ordered) theme.animals.drawTag(ctx, item.species, memberPose(offset));
}

export function drawHud(ctx: CanvasRenderingContext2D, theme: SeesawTheme, hud: HudModel, time: number): void {
  drawGoal(ctx, theme, hud, time);

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
    if (selected) {
      // A soft ring, pulsing, so the chosen animal is obvious without text.
      ctx.save();
      ctx.beginPath();
      ctx.arc(slot.x, slot.y, TRAY_SLOT_RADIUS + 4 + Math.sin(time * 6) * 2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,210,63,0.55)';
      ctx.fill();
      ctx.restore();
    }
    drawTrayItem(ctx, theme, slot, selected, time);
  }
}

/** Highlights the two landing areas while an animal is armed. */
export function drawSideTargets(
  ctx: CanvasRenderingContext2D,
  plankAngle: number,
  time: number,
  emphasis = 1,
): void {
  const pulse = (0.25 + Math.sin(time * 5) * 0.1) * emphasis;
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
