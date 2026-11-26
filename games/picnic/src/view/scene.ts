import { drawArrivingBanner, fitToScreen, label, visibleBounds, type Point, type Size } from '@bundle/core';
import type { DriverEvent, SceneModel } from '../driver.js';
import { treatName, type Mood, type TreatId } from '../logic/friends.js';
import { courseOf, preview, type Summary, type TableState } from '../logic/table.js';
import {
  drawBasket,
  drawChair,
  drawCentred,
  drawDial,
  drawFood,
  drawFriend,
  drawHeap,
  drawPark,
  drawPiece,
  drawPool,
  drawQuestion,
  drawShare,
  drawStanding,
  drawTable,
  drawTag,
  heapSpot,
  poolSpot,
} from './art.js';
import { DOG, fromFood, HUD, seats } from './geometry.js';
import { drawDone, drawFinished, drawProgress, drawTopBar } from './hud.js';
import type { Sprites } from './sprites.js';
import { TIMING } from './timing.js';

export interface Scene {
  update(dt: number, model: SceneModel): void;
  /** What just happened, so the scene can react. State stays the driver's. */
  observe(events: readonly DriverEvent[]): void;
  /** A swipe across the food, in its radii, so a cut can be drawn where it went. */
  swipe(from: Point, to: Point): void;
  render(ctx: CanvasRenderingContext2D, screen: Size): void;
  toDesign(point: Point, screen: Size): Point;
}

/** What a finished course came to, in words: `12 cookies, 3 friends: 4 each!`. */
export function courseLines(summary: Summary): string[] {
  if (summary.item === 'pizza' || summary.item === 'cake') {
    const piece = summary.friends === 2 ? 'a half' : 'a quarter';
    return [`1 ${summary.item}, ${summary.friends} friends: ${piece} each!`];
  }
  const lines = [`${summary.count} ${treatName(summary.item, summary.count)}, ${summary.friends} friends: ${summary.each} each!`];
  if (summary.leftover > 0) lines.push(`${summary.leftover} for Biscuit!`);
  return lines;
}

/** A treat on its way from the grass to a plate. */
interface Flyer {
  treat: TreatId;
  from: Point;
  plate: number;
  /** Below zero, still waiting its turn. */
  life: number;
}

interface Float {
  text: string;
  at: Point;
  life: number;
}

/** A face held for a moment: a friend refused a second helping, puzzled at a share that will not go round. */
interface Held {
  mood: Mood;
  life: number;
  seconds: number;
}

const FLY_SECONDS = 0.42;
const DOG_SECONDS = 1.9;
const TRAIL_SECONDS = 0.9;

const shareTreat = (table: TableState): TreatId | null => {
  const course = courseOf(table);
  return course.kind === 'cut' ? null : course.treat;
};

export function createScene(sprites: Sprites): Scene {
  let model: SceneModel | null = null;
  let clock = 0;
  let banner: { title: string; life: number } | null = null;
  const flyers: Flyer[] = [];
  const floats: Float[] = [];
  const held = new Map<number, Held>();
  let dog: { life: number; count: number; treat: TreatId } | null = null;
  let trail: { from: Point; to: Point; life: number; ok: boolean | null } | null = null;
  let dialPulse = 0;

  const above = (plate: number, count: number): Point => {
    const seat = seats(count)[plate] ?? { x: 576, y: 418 };
    return { x: seat.x, y: seat.y - 210 };
  };

  const hold = (plate: number, mood: Mood, seconds: number): void => void held.set(plate, { mood, life: 0, seconds });

  return {
    swipe(from, to) {
      trail = { from, to, life: 0, ok: null };
    },

    observe(events) {
      for (const event of events) {
        if (event.type === 'level' || event.type === 'next') {
          if (event.type === 'level') banner = { title: event.level.title, life: 0 };
          flyers.length = 0;
          held.clear();
          dog = null;
          trail = null;
          continue;
        }
        const table = model?.table;
        if (!table) continue;
        const count = table.seated.length;
        const treat = shareTreat(table);
        switch (event.type) {
          case 'gave':
            if (treat) flyers.push({ treat, from: poolSpot(table.basket, table.basket + 1), plate: event.plate, life: 0 });
            break;
          case 'shared':
            for (let plate = 0; plate < count; plate += 1) {
              for (let one = 0; one < event.each; one += 1) {
                const spot = poolSpot(table.basket + plate * event.each + one, table.basket + count * event.each);
                if (treat) flyers.push({ treat, from: spot, plate, life: -(plate * 0.12 + one * 0.06) });
              }
            }
            break;
          case 'refused':
            hold(event.plate, 'grumpy', 0.9);
            floats.push({ text: 'One each first!', at: above(event.plate, count), life: 0 });
            break;
          case 'short':
            for (let plate = 0; plate < count; plate += 1) hold(plate, 'puzzled', 1.2);
            floats.push({ text: 'Not enough to go round!', at: { x: 576, y: 230 }, life: 0 });
            break;
          case 'unseated':
            floats.push({ text: `${event.chairs} chairs: ${event.leftover} left over!`, at: { x: 576, y: 230 }, life: 0 });
            break;
          case 'leftover':
            if (treat) dog = { life: 0, count: event.count, treat };
            break;
          case 'cut':
            if (trail) trail.ok = event.ok;
            if (!event.ok) {
              for (let plate = 0; plate < count; plate += 1) hold(plate, plate === count - 1 ? 'grumpy' : 'puzzled', 1.1);
              floats.push({ text: event.why === 'cross' ? 'Cut across the first one!' : 'Through the middle!', at: { x: 576, y: 230 }, life: 0 });
            }
            break;
          default:
            break;
        }
      }
    },

    update(dt, next) {
      const before = model?.table.dial;
      model = next;
      clock += dt;
      if (before !== undefined && before !== next.table.dial) dialPulse = 1;
      dialPulse = Math.max(0, dialPulse - dt * 4);
      if (banner) {
        banner.life += dt;
        if (banner.life > TIMING.introSeconds) banner = null;
      }
      for (const flyer of flyers) flyer.life += dt;
      for (let index = flyers.length - 1; index >= 0; index -= 1) if (flyers[index]!.life >= FLY_SECONDS) flyers.splice(index, 1);
      for (const entry of floats) entry.life += dt;
      while (floats.length > 0 && floats[0]!.life > TIMING.floatSeconds) floats.shift();
      for (const [plate, face] of held) {
        face.life += dt;
        if (face.life > face.seconds) held.delete(plate);
      }
      if (dog) {
        dog.life += dt;
        if (dog.life > DOG_SECONDS) dog = null;
      }
      if (trail) {
        trail.life += dt;
        if (trail.life > TRAIL_SECONDS) trail = null;
      }
    },

    render(ctx, screen) {
      const current = model;
      if (!current) return;
      const transform = fitToScreen(screen);
      const bounds = visibleBounds(screen, transform);
      const table = current.table;
      const course = courseOf(table);
      const seated = table.seated.length;
      const places = seats(seated);
      const playing = current.phase === 'playing' || current.phase === 'intro';
      const feasting = current.phase === 'done' || table.phase === 'between';
      const dialing = playing && table.phase === 'sharing' && !(course.kind === 'share' && course.mode === 'tap');
      const look = preview(table);

      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.translate(transform.offsetX, transform.offsetY);
      ctx.scale(transform.scale, transform.scale);

      drawPark(ctx, sprites, bounds);
      if (table.phase === 'chairs') for (const seat of seats(table.dial)) drawChair(ctx, sprites, seat);
      drawTable(ctx, sprites);

      // How many each plate shows: what it has, less what is still in the air.
      const shown = table.plates.map((count, plate) => count - flyers.filter((flyer) => flyer.plate === plate).length);
      // A share that would run out fills these plates and not the rest.
      const canFill = dialing ? Math.min(seated, Math.floor(table.basket / Math.max(1, table.dial))) : seated;

      table.seated.forEach((friend, plate) => {
        const seat = places[plate]!;
        const face = held.get(plate);
        let mood: Mood = 'happy';
        if (feasting && (table.plates[plate] ?? 0) > 0) mood = 'eating';
        else if (face) mood = face.mood;
        else if (dialing && !look.fits && plate >= canFill) mood = 'puzzled';
        const bob = mood === 'eating' ? Math.abs(Math.sin(clock * 6 + plate)) * 5 : 0;
        drawFriend(ctx, sprites, friend, mood, seat, bob);
        if (dialing && !look.fits && plate >= canFill) drawQuestion(ctx, { x: seat.x + 78, y: seat.y - 205 });
      });

      if (course.kind === 'cut') {
        if (table.phase === 'cutting') drawFood(ctx, sprites, course.food, table.cuts.map((cut) => cut.angle), null);
        else places.forEach((seat) => drawPiece(ctx, sprites, course.food, seat));
      } else {
        const treat = course.treat;
        places.forEach((seat, plate) => drawHeap(ctx, sprites, treat, Math.max(0, shown[plate] ?? 0), seat));
        if (dialing) {
          // Ghosts of the next share, hovering over the plates they would go to.
          const lift = 30 + Math.sin(clock * 3) * 5;
          for (let plate = 0; plate < canFill; plate += 1) drawHeap(ctx, sprites, treat, table.dial, places[plate]!, 0.55, table.plates[plate] ?? 0, lift);
        }
      }

      // The count on each plate, glowing together when they are all the same.
      if (course.kind !== 'cut') {
        const equal = shown.length > 0 && shown.every((count) => count === shown[0]) && (shown[0] ?? 0) > 0;
        places.forEach((seat, plate) => drawTag(ctx, String(Math.max(0, shown[plate] ?? 0)), { x: seat.x, y: seat.y + 40 }, 21, equal));
      } else if (table.phase !== 'cutting') {
        places.forEach((seat) => drawTag(ctx, seated === 2 ? '1/2' : '1/4', { x: seat.x, y: seat.y + 40 }, 24, true));
      }

      const treat = shareTreat(table);
      if (treat) {
        const waiting = table.basket + flyers.filter((flyer) => flyer.life < 0).length;
        drawBasket(ctx, sprites, waiting);
        drawPool(ctx, sprites, treat, waiting);
      }

      if (table.phase === 'chairs' && course.kind === 'chairs') {
        seats(table.dial).forEach((seat) => drawHeap(ctx, sprites, course.treat, look.each, seat, 0.55, 0, 30 + Math.sin(clock * 3) * 5));
        // Biscuit peeks in hopefully at any number that would leave him some.
        if (!look.fits) drawStanding(ctx, sprites, 'dog-caught', { x: 930, y: 594 }, 0.5);
      }

      if (playing && (dialing || table.phase === 'chairs')) {
        drawDial(ctx, sprites, table.dial, dialPulse);
        drawShare(ctx, sprites, table.phase === 'chairs' ? look.fits : look.fits, table.phase === 'chairs' ? 'Sit down' : 'Share');
      }

      for (const flyer of flyers) {
        if (flyer.life < 0) continue;
        const t = Math.min(1, flyer.life / FLY_SECONDS);
        const index = Math.max(0, (table.plates[flyer.plate] ?? 1) - 1);
        const to = heapSpot(places[flyer.plate] ?? { x: 576, y: 418 }, index);
        const at = { x: flyer.from.x + (to.x - flyer.from.x) * t, y: flyer.from.y + (to.y - flyer.from.y) * t - Math.sin(t * Math.PI) * 120 };
        drawCentred(ctx, sprites, flyer.treat, at, 46 - t * 12);
      }

      if (dog) {
        // In from the right, a grab, and away again with the leftovers.
        const t = dog.life;
        const inward = t < 0.7;
        const x = inward ? DOG.offX + (DOG.grabX - DOG.offX) * (t / 0.7) : t < 1 ? DOG.grabX : DOG.grabX + (DOG.offX - DOG.grabX) * ((t - 1) / 0.9);
        if (t < 0.85) for (let one = 0; one < dog.count; one += 1) drawCentred(ctx, sprites, dog.treat, { x: DOG.grabX - 70 - one * 40, y: DOG.y + 20 }, 42);
        drawStanding(ctx, sprites, 'dog-sneak', { x, y: DOG.y + 70 }, 0.62, { flip: inward });
      }

      if (trail && course.kind === 'cut') {
        const from = fromFood(course.food, trail.from);
        const to = fromFood(course.food, trail.to);
        ctx.save();
        ctx.globalAlpha = 1 - trail.life / TRAIL_SECONDS;
        ctx.strokeStyle = trail.ok === false ? '#e8543f' : 'rgba(255,255,255,0.9)';
        ctx.lineWidth = 9;
        ctx.lineCap = 'round';
        if (trail.ok === false) ctx.setLineDash?.([14, 10]);
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
        ctx.setLineDash?.([]);
        ctx.restore();
      }

      for (const entry of floats) {
        const t = entry.life / TIMING.floatSeconds;
        ctx.save();
        ctx.globalAlpha = t > 0.7 ? (1 - t) / 0.3 : 1;
        label(ctx, entry.text, entry.at.x, entry.at.y - t * 40, 32, 'center');
        ctx.restore();
      }

      if (current.phase !== 'intro') drawTopBar(ctx, current.level.line);
      drawProgress(ctx, current.number, current.count, current.totalStars);
      if (banner) drawArrivingBanner(ctx, banner.title, banner.life / TIMING.introSeconds, TIMING.introSettleFraction, HUD.bannerY);

      if (current.phase === 'done') {
        const since = current.since - TIMING.cardDelaySeconds;
        if (since > 0) {
          drawDone(
            ctx,
            table.summaries.flatMap(courseLines),
            since / 0.6,
            current.earned ?? 0,
            (since - 0.4) / TIMING.starSeconds,
            current.since >= TIMING.doneHoldSeconds,
          );
        }
      }
      if (current.phase === 'finished') drawFinished(ctx, current.totalStars, current.maxStars);
      ctx.restore();
    },

    toDesign(point, screen) {
      return fitToScreen(screen).toDesign(point);
    },
  };
}
