import { createSpring, drawArrivingBanner, fitToScreen, hand, label, visibleBounds, type Point, type Size, type Spring } from '@bundle/core';
import type { DriverEvent, SceneModel } from '../driver.js';
import { loadOf, QUEUE_SLOTS, TIMES, type Crate } from '../logic/run.js';
import { drawBar, drawBelt, drawCrate, drawSmoke, drawSprite, drawTrain, drawYard } from './art.js';
import { HUD, QUEUE, slotCentre, trackAt, TRACKS, TRAIN } from './geometry.js';
import { drawPaused, drawSummary, drawTopBar } from './hud.js';
import type { SpriteName, Sprites } from './sprites.js';
import { TIMING } from './timing.js';

export interface Scene {
  update(dt: number, model: SceneModel): void;
  observe(events: readonly DriverEvent[]): void;
  render(ctx: CanvasRenderingContext2D, screen: Size): void;
  toDesign(point: Point, screen: Size): Point;
  /** The crate being dragged and where the finger is, or null when nothing is held. */
  drag(crate: number | null, at?: Point): void;
}

export const COACH_LINE = 'Drag a crate onto a train';

/** What a train's sign says while a crate is held over it. */
export function previewText(load: number, weight: number, target: number): { text: string; tone: 'exact' | 'under' | 'over' } {
  const sum = load + weight;
  return { text: `${load} + ${weight} = ${sum}`, tone: sum === target ? 'exact' : sum < target ? 'under' : 'over' };
}

const TONE_COLOURS = { exact: '#5cc96a', under: '#ffffff', over: '#f07a62' } as const;

interface Float {
  text: string;
  icon: SpriteName | null;
  at: Point;
  life: number;
}

/** A train on its way out, drawn until it is off the right edge. */
interface Leaver {
  track: number;
  load: number[];
  life: number;
}

/** Crates swept away by a bonus, popping where they were. */
interface Pop {
  weight: number;
  at: Point;
  life: number;
}

const LEAVE_SECONDS = 1.2;
const DROP_SECONDS = 0.35;
const POP_SECONDS = 0.6;

export function createScene(sprites: Sprites): Scene {
  let model: SceneModel | null = null;
  let clock = 0;
  let banner: { title: string; life: number } | null = null;
  let held: { crate: number; at: Point } | null = null;
  /** Each queued crate's drawn x, sliding to its slot. */
  const slide = new Map<number, Spring>();
  const floats: Float[] = [];
  const leavers: Leaver[] = [];
  const pops: Pop[] = [];
  /** Crates let go off the trains, springing back down to the belt: how far above it they are. */
  const lifts = new Map<number, Spring>();
  /** Crates dropping into their place, by id: seconds since they started. */
  const drops = new Map<number, number>();

  const float = (text: string, icon: SpriteName | null, at: Point): void => void floats.push({ text, icon, at, life: 0 });

  return {
    drag(crate, at) {
      if ((crate === null || !at) && held) {
        // Let go: it springs home from where the finger left it, rather than
        // jumping back. A crate that was loaded leaves the queue and is not drawn.
        const spring = slide.get(held.crate);
        if (spring) {
          spring.snap(held.at.x);
          lifts.set(held.crate, createSpring(held.at.y - QUEUE.y, { stiffness: 120 }));
        }
      }
      held = crate === null || !at ? null : { crate, at };
    },

    observe(events) {
      for (const event of events) {
        switch (event.type) {
          case 'start':
            banner = { title: event.band.title, life: 0 };
            floats.length = 0;
            lifts.clear();
            leavers.length = 0;
            pops.length = 0;
            slide.clear();
            break;
          case 'band':
            banner = { title: event.band.title, life: 0 };
            break;
          case 'speed':
            float('Speed up!', 'bolt', { x: 576, y: 600 });
            break;
          case 'crate':
            // Out of the port: it slides along from the start of the belt.
            // Set down by the crane at the end of the queue, dropping in from above.
            drops.set(event.crate.id, 0);
            break;
          case 'sent':
            leavers.push({ track: event.track, load: event.load, life: 0 });
            float(event.bonus ? 'Bonus!' : 'Train ready!', event.bonus ? 'star' : 'tick', { x: TRACKS[event.track]!.trainX, y: TRACKS[event.track]!.railY - 60 });
            break;
          case 'cleared':
            for (const crate of event.crates) {
              const spring = slide.get(crate.id);
              pops.push({ weight: crate.weight, at: { x: spring?.value ?? QUEUE.markerX, y: QUEUE.y }, life: 0 });
              slide.delete(crate.id);
            }
            break;
          case 'broke':
            // Its crates tumble back onto the end of the queue.
            for (const crate of model?.run.queue.slice(-event.load.length) ?? []) drops.set(crate.id, 0);
            float('Too heavy!', 'cross', { x: TRACKS[event.track]!.trainX, y: TRACKS[event.track]!.railY - 60 });
            break;
          default:
            break;
        }
      }
    },

    update(dt, next) {
      model = next;
      if (next.phase === 'paused') return;
      clock += dt;
      if (banner) {
        banner.life += dt;
        if (banner.life > TIMING.bannerSeconds) banner = null;
      }
      for (const entry of floats) entry.life += dt;
      while (floats.length > 0 && floats[0]!.life > TIMING.floatSeconds) floats.shift();
      for (const leaver of leavers) leaver.life += dt;
      while (leavers.length > 0 && leavers[0]!.life > LEAVE_SECONDS) leavers.shift();
      for (const pop of pops) pop.life += dt;
      while (pops.length > 0 && pops[0]!.life > POP_SECONDS) pops.shift();
      for (const [id, lift] of lifts) {
        lift.target = 0;
        lift.step(dt);
        if (lift.settled) lifts.delete(id);
      }
      for (const [id, life] of drops) {
        if (life > DROP_SECONDS) drops.delete(id);
        else drops.set(id, life + dt);
      }
      next.run.queue.forEach((crate, index) => {
        const spring = slide.get(crate.id) ?? createSpring(slotCentre(index).x, { stiffness: 120 });
        spring.target = slotCentre(index).x;
        spring.step(dt);
        slide.set(crate.id, spring);
      });
    },

    render(ctx, screen) {
      const current = model;
      if (!current) return;
      const transform = fitToScreen(screen);
      const bounds = visibleBounds(screen, transform);
      const run = current.run;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.translate(transform.offsetX, transform.offsetY);
      ctx.scale(transform.scale, transform.scale);

      drawYard(ctx, sprites, bounds.left, bounds.right, bounds.bottom, bounds.top);

      const heldCrate: Crate | undefined = held ? run.queue.find((crate) => crate.id === held!.crate) : undefined;
      const over = held && heldCrate ? trackAt(held.at) : null;

      /** The sum a held crate would make: drawn over the crate, once it is drawn. */
      const previews: { text: string; colour: string }[] = [];
      run.tracks.forEach((track, index) => {
        const place = TRACKS[index]!;
        if (track.phase === 'rolling') {
          // Rolling in from the left over the last part of its wait.
          const t = 1 - Math.max(0, track.timer) / TIMES.rollIn;
          const x = -TRAIN.width + (place.trainX + TRAIN.width) * Math.min(1, t * 1.15);
          drawTrain(ctx, sprites, { track: index, place, x, tilt: 0, load: [] });
          return;
        }
        if (track.phase === 'broken') {
          drawTrain(ctx, sprites, { track: index, place, x: place.trainX, tilt: -0.11 + Math.sin(clock * 20) * 0.004, load: [] });
          drawSprite(ctx, sprites, 'broken-track', { x: place.trainX + 20, y: place.railY + 4 }, 64);
          drawSmoke(ctx, { x: place.trainX + 80, y: place.railY - TRAIN.height - 14 }, clock, '#464a52');
          drawSprite(ctx, sprites, 'warning', { x: place.trainX - 60, y: place.railY - TRAIN.height * 0.5 }, 46, Math.floor(clock * 3) % 2 === 0 ? 1 : 0.5);
          drawSprite(ctx, sprites, 'worker-wrench', { x: place.trainX - 150, y: place.railY - 40 }, 80);
          drawSprite(ctx, sprites, 'worker-wheel', { x: place.trainX + 150, y: place.railY - 34 }, 70);
          drawSprite(ctx, sprites, 'repair', { x: place.sign.x - 70, y: place.sign.y }, 40);
          drawBar(ctx, { x: place.sign.x + 10, y: place.sign.y }, 110, 1 - track.timer / TIMES.repair, '#f0a32e');
          return;
        }
        const judder = track.star > 0 ? Math.sin(clock * 40) * 1.5 : 0;
        drawTrain(ctx, sprites, { track: index, place, x: place.trainX + judder, tilt: 0, load: track.load });
        const load = loadOf(track);
        const preview = over === index && heldCrate ? previewText(load, heldCrate.weight, track.target) : null;
        drawSign(ctx, sprites, place.sign, `${load} / ${track.target}`, '#ffffff', track.star > 0, clock);
        if (preview && held) previews.push({ text: preview.text, colour: TONE_COLOURS[preview.tone] });
        drawBar(ctx, { x: place.sign.x, y: place.sign.y + 40 }, 110, load / track.target, track.star > 0 ? '#ffcc3a' : '#5cb85c');
        if (track.star > 0) {
          drawSprite(ctx, sprites, 'star', { x: place.trainX - TRAIN.width * 0.25, y: place.railY - TRAIN.height * 0.55 }, 40);
          drawStarClock(ctx, sprites, { x: place.sign.x - 128, y: place.sign.y + 2 }, track.star);
        }
      });

      for (const leaver of leavers) {
        const place = TRACKS[leaver.track]!;
        const t = leaver.life / LEAVE_SECONDS;
        drawTrain(ctx, sprites, { track: leaver.track, place, x: place.trainX + t * t * 900, tilt: 0, load: leaver.load });
        drawSmoke(ctx, { x: place.trainX + t * t * 900 + 90, y: place.railY - TRAIN.height }, clock);
      }

      drawBelt(ctx, clock);
      // The marker, and the warning as the queue nears it.
      const danger = Math.max(0, run.queue.length - (QUEUE_SLOTS - 4)) / 4;
      const blink = danger > 0 && Math.floor(clock * (2 + danger * 4)) % 2 === 0;
      drawSprite(ctx, sprites, 'signal', { x: QUEUE.markerX + 30, y: QUEUE.y - 20 }, 90, blink ? 1 : 0.85);
      for (let slot = QUEUE_SLOTS - 3; slot < QUEUE_SLOTS; slot += 1) {
        const at = slotCentre(slot);
        ctx.fillStyle = slot >= QUEUE_SLOTS - 1 ? 'rgba(232,84,63,0.28)' : 'rgba(240,163,46,0.22)';
        ctx.fillRect(at.x - QUEUE.pitch / 2, QUEUE.y - QUEUE.crate / 2 - 6, QUEUE.pitch, QUEUE.crate + 12);
      }

      run.queue.forEach((crate) => {
        if (held && crate.id === held.crate) return;
        const x = slide.get(crate.id)?.value ?? QUEUE.firstX;
        const drop = drops.get(crate.id);
        const fall = drop === undefined ? 0 : (1 - Math.min(1, drop / DROP_SECONDS)) ** 2 * 140;
        const lift = lifts.get(crate.id)?.value ?? 0;
        drawCrate(ctx, sprites, crate.weight, { x, y: QUEUE.y + lift - fall }, QUEUE.crate);
      });
      for (const pop of pops) {
        const t = pop.life / POP_SECONDS;
        drawSprite(ctx, sprites, 'star', { x: pop.at.x, y: pop.at.y - t * 50 }, 40 * (1 + t), 1 - t);
      }
      if (held && heldCrate) {
        drawCrate(ctx, sprites, heldCrate.weight, held.at, QUEUE.crate * 1.15);
        for (const preview of previews) drawPreview(ctx, { x: held.at.x, y: held.at.y - 78 }, preview.text, preview.colour);
      }

      drawTopBar(ctx, sprites, run.sent, current.seconds);
      if (current.coach && current.phase === 'playing') label(ctx, COACH_LINE, 576, HUD.coachY, 30, 'center');
      for (const entry of floats) {
        const t = entry.life / TIMING.floatSeconds;
        ctx.save();
        ctx.globalAlpha = t > 0.7 ? (1 - t) / 0.3 : 1;
        if (entry.icon) drawSprite(ctx, sprites, entry.icon, { x: entry.at.x - 110, y: entry.at.y - t * 50 }, 46);
        label(ctx, entry.text, entry.at.x, entry.at.y - t * 50, 40, 'center');
        ctx.restore();
      }
      if (banner) drawArrivingBanner(ctx, banner.title, banner.life / TIMING.bannerSeconds, TIMING.bannerSettleFraction, HUD.bandY);

      if (current.phase === 'paused') drawPaused(ctx);
      if (current.phase === 'over' && current.summary) drawSummary(ctx, current.summary);
      ctx.restore();
    },

    toDesign(point, screen) {
      return fitToScreen(screen).toDesign(point);
    },
  };
}

/** The sign at a track's end: its load and target, or the held crate's sum. Gold and pulsing for a star train. */
function drawSign(ctx: CanvasRenderingContext2D, sprites: Sprites, at: Point, text: string, colour: string, star: boolean, clock: number): void {
  const grow = star ? 1 + Math.sin(clock * 8) * 0.05 : 1;
  ctx.save();
  ctx.translate(at.x, at.y);
  ctx.scale(grow, grow);
  const image = sprites.sign;
  if (image) ctx.drawImage(image, -64, -32, 128, 64);
  else {
    ctx.fillStyle = '#3a3a42';
    ctx.fillRect(-64, -32, 128, 64);
  }
  if (star) {
    ctx.strokeStyle = '#ffcc3a';
    ctx.lineWidth = 5;
    ctx.strokeRect(-66, -34, 132, 68);
  }
  // To the right of the sign's painted crate.
  ctx.font = hand(700, text.length > 7 ? 19 : 27);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = colour;
  ctx.fillText(text, 20, 1);
  ctx.restore();
}

/** The sum a held crate would make, in a bubble over it: green if exact, red if too heavy. */
function drawPreview(ctx: CanvasRenderingContext2D, at: Point, text: string, colour: string): void {
  const width = 170;
  const height = 54;
  ctx.save();
  ctx.fillStyle = colour;
  ctx.strokeStyle = '#1e2a38';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(at.x - width / 2 + 20, at.y - height / 2);
  ctx.arcTo(at.x + width / 2, at.y - height / 2, at.x + width / 2, at.y + height / 2, 20);
  ctx.arcTo(at.x + width / 2, at.y + height / 2, at.x - width / 2, at.y + height / 2, 20);
  ctx.arcTo(at.x - width / 2, at.y + height / 2, at.x - width / 2, at.y - height / 2, 20);
  ctx.arcTo(at.x - width / 2, at.y - height / 2, at.x + width / 2, at.y - height / 2, 20);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.font = hand(700, 32);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#1e2a38';
  ctx.fillText(text, at.x, at.y + 1);
  ctx.restore();
}

/** The little stopwatch over a star train's sign, red for the last two seconds. */
function drawStarClock(ctx: CanvasRenderingContext2D, sprites: Sprites, at: Point, seconds: number): void {
  drawSprite(ctx, sprites, 'stopwatch', { x: at.x - 26, y: at.y }, 40);
  label(ctx, String(Math.ceil(seconds)), at.x + 14, at.y, 30, 'center');
  if (seconds <= 2) {
    ctx.save();
    ctx.fillStyle = 'rgba(232,84,63,0.35)';
    ctx.beginPath();
    ctx.arc(at.x - 26, at.y, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
