import type { AnimalId } from '../logic/animals.js';
import type { TrayItem } from '../logic/game.js';
import { DESIGN } from './layout.js';
import { SCENE } from './geometry.js';
import { TIMING } from './timing.js';
import type { SeesawTheme } from './theme.js';

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
function drawGoal(ctx: CanvasRenderingContext2D, hud: HudModel, time: number): void {
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
    const width = 34 + hud.caption.length * 15;
    ctx.globalAlpha = cardAlpha * 0.9;
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.beginPath();
    ctx.roundRect?.(-width / 2, -30, width, 60, 22);
    if (!ctx.roundRect) ctx.rect(-width / 2, -30, width, 60);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  ctx.font = '600 30px system-ui, -apple-system, "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(29,43,50,0.86)';
  ctx.fillText(hud.caption, 0, 0);
  ctx.restore();

  // The dots keep their place while the goal flies past them: a row of markers
  // that jumps about is harder to read than one that simply sits there.
  if (hud.stages > 1) drawStageDots(ctx, hud, 74, time);
}

/**
 * One dot per challenge, ticked off as they are cleared. Level 5 asks for three
 * things in a row, and without this it looks exactly like the levels that ask
 * for one.
 */
function drawStageDots(ctx: CanvasRenderingContext2D, hud: HudModel, y: number, time: number): void {
  const gap = 46;
  const start = DESIGN.width / 2 - ((hud.stages - 1) * gap) / 2;

  for (let index = 0; index < hud.stages; index++) {
    const done = index < hud.stagesCleared;
    const current = index === hud.stagesCleared;
    // The dot just ticked off swells briefly, so the progress is felt.
    const justStamped = hud.stamp > 0 && index === hud.stagesCleared - 1;
    const radius = 13 + (justStamped ? Math.sin(hud.stamp * Math.PI * 1.2) * 7 : 0);

    ctx.save();
    ctx.translate(start + index * gap, y);
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fillStyle = done ? '#63c07a' : 'rgba(255,255,255,0.75)';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = current ? '#ffc21f' : 'rgba(29,43,50,0.25)';
    if (current) {
      ctx.lineWidth = 3 + Math.sin(time * 5) * 1;
    }
    ctx.stroke();

    if (done) {
      // A tick, drawn rather than typed.
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-5.5, 0.5);
      ctx.lineTo(-1.5, 4.5);
      ctx.lineTo(6, -4.5);
      ctx.stroke();
    }
    ctx.restore();
  }
}

/** Arrows sweeping out towards both platforms: tap a side to seat this animal. */
function drawPlacementHint(ctx: CanvasRenderingContext2D, x: number, y: number, time: number): void {
  const sweep = (Math.sin(time * 3) + 1) / 2;
  for (const direction of [-1, 1]) {
    ctx.save();
    ctx.translate(x + direction * (58 + sweep * 22), y - 6);
    ctx.globalAlpha = 0.35 + sweep * 0.55;
    ctx.strokeStyle = '#ffc21f';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(-direction * 9, -13);
    ctx.lineTo(direction * 9, 0);
    ctx.lineTo(-direction * 9, 13);
    ctx.stroke();
    ctx.restore();
  }
}

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
  /** Which queued animal is chosen. */
  selectedQueueIndex: number;
  /** When above zero, the first this many are a family that must all be seated. */
  groupSize: number;
  /** Bells rung, and how many the level asks for. */
  bells: number;
  bellTarget: number | null;
  /** Arcade only: 0..1 through the round, or null in a puzzle. */
  progress: number | null;
  /** Arcade only: 0..1 how close the waiting animal is to placing itself. */
  impatience: number;
  /** Endless only: seconds survived, and the record to beat. */
  survivalSeconds: number | null;
  bestSeconds: number | null;
  /** How many challenges this level has, and how many are done. */
  stages: number;
  stagesCleared: number;
  /** Timed arcade levels: seconds left on the clock. */
  secondsRemaining: number | null;
  /** Show where an arcade animal can be seated. */
  showPlacementHint: boolean;
  /** 0..1 through the goal's arrival, or null when it has settled. */
  announcing: number | null;
  /** Counts down after a stage is stamped off. */
  stamp: number;
}

const QUEUE_SPACING = 108;

/**
 * The hand: every waiting animal can be chosen, so they are laid out evenly and
 * the chosen one is lifted, rather than the first being special. Picking which
 * animal closes the gap is where the arithmetic lives, so the hand has to read
 * as a set of options rather than as a conveyor belt.
 */
export function queueSlots(queue: readonly AnimalId[]): TraySlot[] {
  const start = DESIGN.width / 2 - ((queue.length - 1) * QUEUE_SPACING) / 2;
  return queue.map((species, position) => ({
    index: position,
    item: { uid: `queue-${position}`, species, used: false },
    x: start + position * QUEUE_SPACING,
    y: SCENE.trayY,
    radius: TRAY_SLOT_RADIUS,
  }));
}

/** Bells rung so far, drawn as bells: progress readable without numerals. */
function drawBells(ctx: CanvasRenderingContext2D, hud: HudModel, time: number): void {
  const total = hud.bellTarget ?? Math.max(hud.bells, 1);
  const gap = 42;
  const start = DESIGN.width / 2 - ((total - 1) * gap) / 2;

  for (let index = 0; index < total; index++) {
    const rung = index < hud.bells;
    const justRung = rung && index === hud.bells - 1;
    const lift = justRung ? Math.abs(Math.sin(time * 9)) * 4 : 0;

    ctx.save();
    ctx.translate(start + index * gap, 144 - lift);
    ctx.globalAlpha = rung ? 1 : 0.3;
    ctx.fillStyle = rung ? '#ffc21f' : 'rgba(255,255,255,0.85)';
    ctx.strokeStyle = rung ? '#c98a00' : 'rgba(29,43,50,0.35)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 2, 12, Math.PI, 0);
    ctx.lineTo(13, 9);
    ctx.lineTo(-13, 9);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 12, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

/**
 * The clock: how much of the round is done, and how long is left. Taller than a
 * progress bar needs to be, and carrying its own number, because in play it was
 * easy to miss that there was a countdown at all.
 */
function drawProgress(ctx: CanvasRenderingContext2D, progress: number, remaining: number | null, time: number): void {
  const width = SCENE.gaugeWidth;
  const x = (DESIGN.width - width) / 2;
  const y = SCENE.gaugeY + 34;
  const height = 18;
  const closing = remaining !== null && remaining <= 5;

  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath();
  ctx.roundRect?.(x, y, width, height, height / 2);
  if (!ctx.roundRect) ctx.rect(x, y, width, height);
  ctx.fill();

  // The last few seconds pulse, so the finish is felt as well as seen.
  ctx.fillStyle = closing ? '#ffc21f' : '#63c07a';
  ctx.globalAlpha = closing ? 0.75 + Math.sin(time * 10) * 0.25 : 1;
  ctx.beginPath();
  ctx.roundRect?.(x, y, Math.max(height, width * Math.min(1, progress)), height, height / 2);
  if (!ctx.roundRect) ctx.rect(x, y, width * Math.min(1, progress), height);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.strokeStyle = 'rgba(29,43,50,0.25)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect?.(x, y, width, height, height / 2);
  if (!ctx.roundRect) ctx.rect(x, y, width, height);
  ctx.stroke();

  if (remaining !== null) {
    ctx.font = '700 26px system-ui, -apple-system, "Segoe UI", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = closing ? '#d8552b' : 'rgba(29,43,50,0.8)';
    ctx.fillText(`${Math.ceil(remaining)}s`, x + width + 16, y + height / 2);
  }
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
  const bound = hud.groupSize > 0 ? Math.min(hud.groupSize, slots.length) : 0;

  // A family arrives roped together and every member must be seated, so it is
  // drawn as one bracketed group rather than as separate animals.
  if (bound > 1) {
    const first = slots[0]!;
    const last = slots[bound - 1]!;
    const left = first.x - TRAY_SLOT_RADIUS - 12;
    const width = last.x + TRAY_SLOT_RADIUS + 12 - left;
    ctx.save();
    ctx.fillStyle = 'rgba(255,194,31,0.22)';
    ctx.strokeStyle = 'rgba(201,138,0,0.55)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect?.(left, first.y - TRAY_SLOT_RADIUS - 10, width, TRAY_SLOT_RADIUS * 2 + 36, 26);
    if (!ctx.roundRect) ctx.rect(left, first.y - TRAY_SLOT_RADIUS - 10, width, TRAY_SLOT_RADIUS * 2 + 36);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  for (const slot of slots) {
    const chosen = slot.index === hud.selectedQueueIndex;
    const choosable = bound === 0 || slot.index < bound;

    if (chosen) {
      ctx.save();
      ctx.strokeStyle = hud.impatience > 0.7 ? 'rgba(228,105,95,0.95)' : 'rgba(255,210,63,0.95)';
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

    if (chosen && hud.showPlacementHint) drawPlacementHint(ctx, slot.x, slot.y, time);

    ctx.save();
    ctx.globalAlpha = choosable ? 1 : 0.4;
    theme.animals.draw(ctx, slot.item.species, {
      x: slot.x,
      y: slot.y + 24 - (chosen ? 10 : 0),
      scale: chosen ? 0.8 : 0.66,
      tiltRad: 0,
      wobble: chosen ? Math.sin(time * 6) * 0.2 : 0,
      slide: 0,
      dance: 0,
      expression: 'calm',
    });
    ctx.restore();
  }
}

export function drawHud(ctx: CanvasRenderingContext2D, theme: SeesawTheme, hud: HudModel, time: number): void {
  drawGoal(ctx, hud, time);

  if (hud.bellTarget !== null || hud.bells > 0) drawBells(ctx, hud, time);
  if (hud.progress !== null) drawProgress(ctx, hud.progress, hud.secondsRemaining, time);
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
