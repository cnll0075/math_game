import { drawArrivingBanner, fitToScreen, label, visibleBounds, type Point, type Size } from '@bundle/core';
import type { DriverEvent, SceneModel } from '../driver.js';
import { treatName, type Mood, type TreatId } from '../logic/friends.js';
import { hasLeftovers, LEVELS } from '../logic/levels.data.js';
import { courseOf, preview, type Summary, type TableState } from '../logic/table.js';
import {
  bowlSpot,
  drawBasket,
  drawBowl,
  drawBubble,
  drawKnife,
  drawCentred,
  drawDial,
  drawDog,
  drawFence,
  drawFood,
  drawFriend,
  drawHeap,
  drawPark,
  drawPiece,
  drawPlate,
  drawPool,
  drawQuestion,
  drawShare,
  drawTable,
  drawTag,
  drawWaiting,
  heapSpot,
  poolSpot,
} from './art.js';
import { fenceSpot, fromFood, HUD, seats } from './geometry.js';
import { drawDone, drawFinished, drawProgress, drawTopBar } from './hud.js';
import type { Sprites } from './sprites.js';
import { TIMING } from './timing.js';

export interface Scene {
  update(dt: number, model: SceneModel): void;
  /** What just happened, so the scene can react. State stays the driver's. */
  observe(events: readonly DriverEvent[]): void;
  /** A swipe across the food, in its radii, so a cut can be drawn where it went. */
  swipe(from: Point, to: Point): void;
  /** The knife being drawn across the food, in its radii: from where it started to where it is; null when let go. */
  knife(from: Point | null, to?: Point): void;
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

/** Biscuit's bowl, as a flyer's destination. */
const BOWL_PLATE = -1;

/** A treat on its way from the grass to a plate, or to Biscuit's bowl. */
interface Flyer {
  treat: TreatId;
  from: Point;
  /** A plate, or `BOWL_PLATE`. */
  plate: number;
  /** Where in the heap (or the bowl) it lands. */
  slot: number;
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
const TRAIL_SECONDS = 0.9;
/** Biscuit eats for this long when something lands in his bowl. */
const DOG_EAT_SECONDS = 1.6;
/** In the round where Biscuit first comes, he says so all round; after that, as each round starts. */
const FIRST_DOG_ROUND = LEVELS.find(hasLeftovers)?.id;
const BUBBLE_SECONDS = 4;

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
  /** What lies in Biscuit's bowl this course. */
  let bowl: { treat: TreatId; count: number } | null = null;
  /** How long Biscuit has been eating; zero when he is sitting, hoping. */
  let eating = 0;
  let trail: { from: Point; to: Point; life: number; ok: boolean | null } | null = null;
  let drag: { from: Point; to: Point } | null = null;
  let dialPulse = 0;

  const above = (plate: number, count: number): Point => {
    const seat = seats(count)[plate] ?? { x: 576, y: 392 };
    return { x: seat.x, y: seat.y - 230 };
  };

  const hold = (plate: number, mood: Mood, seconds: number): void => void held.set(plate, { mood, life: 0, seconds });

  return {
    swipe(from, to) {
      trail = { from, to, life: 0, ok: null };
    },

    knife(from, to) {
      drag = from && to ? { from, to } : null;
    },

    observe(events) {
      for (const event of events) {
        if (event.type === 'level' || event.type === 'next') {
          if (event.type === 'level') banner = { title: event.level.title, life: 0 };
          flyers.length = 0;
          held.clear();
          bowl = null;
          eating = 0;
          trail = null;
          drag = null;
          continue;
        }
        const table = model?.table;
        if (!table) continue;
        const count = table.seated.length;
        const treat = shareTreat(table);
        switch (event.type) {
          case 'gave':
            if (treat) flyers.push({ treat, from: poolSpot(table.basket, table.basket + 1), plate: event.plate, slot: (table.plates[event.plate] ?? 1) - 1, life: 0 });
            break;
          case 'shared':
            for (let plate = 0; plate < count; plate += 1) {
              for (let one = 0; one < event.each; one += 1) {
                const spot = poolSpot(plate * event.each + one, count * event.each);
                const slot = (table.plates[plate] ?? event.each) - event.each + one;
                if (treat) flyers.push({ treat, from: spot, plate, slot, life: -(plate * 0.12 + one * 0.06) });
              }
            }
            break;
          case 'leftover':
            // What cannot go round flies into Biscuit's bowl, after the last share has landed.
            if (treat) {
              for (let one = 0; one < event.count; one += 1) {
                flyers.push({ treat, from: poolSpot(one, event.count), plate: BOWL_PLATE, slot: one, life: -(0.5 + one * 0.12) });
              }
              bowl = { treat, count: event.count };
            }
            break;
          case 'refused':
            hold(event.plate, 'grumpy', 0.9);
            floats.push({ text: 'One each first!', at: above(event.plate, count), life: 0 });
            break;
          case 'short':
            for (let plate = 0; plate < count; plate += 1) hold(plate, 'puzzled', 1.2);
            floats.push({ text: 'Not enough to go round!', at: { x: 576, y: 150 }, life: 0 });
            break;
          case 'uneven':
            for (let plate = 0; plate < count; plate += 1) hold(plate, 'puzzled', 1.2);
            floats.push({
              text: event.friends < 2 ? 'Invite some friends!' : `${event.friends} friends: ${event.leftover} left over!`,
              at: { x: 576, y: 150 },
              life: 0,
            });
            break;
          case 'cut':
            if (trail) trail.ok = event.ok;
            if (!event.ok) {
              for (let plate = 0; plate < count; plate += 1) hold(plate, plate === count - 1 ? 'grumpy' : 'puzzled', 1.1);
              floats.push({ text: event.why === 'cross' ? 'Cut across the first one!' : 'Through the middle!', at: { x: 576, y: 150 }, life: 0 });
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
      for (const flyer of flyers) {
        const was = flyer.life;
        flyer.life += dt;
        // Biscuit starts eating as the first of his leftovers lands.
        if (flyer.plate === BOWL_PLATE && was < FLY_SECONDS && flyer.life >= FLY_SECONDS && eating === 0) eating = 0.001;
      }
      for (let index = flyers.length - 1; index >= 0; index -= 1) if (flyers[index]!.life >= FLY_SECONDS) flyers.splice(index, 1);
      if (eating > 0) {
        eating += dt;
        if (eating > DOG_EAT_SECONDS) {
          eating = 0;
          bowl = null;
        }
      }
      for (const entry of floats) entry.life += dt;
      while (floats.length > 0 && floats[0]!.life > TIMING.floatSeconds) floats.shift();
      for (const [plate, face] of held) {
        face.life += dt;
        if (face.life > face.seconds) held.delete(plate);
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
      const inviting = playing && table.phase === 'inviting';
      const look = preview(table);
      const treat = shareTreat(table);
      // Biscuit only comes to rounds where something will be left over for him.
      const dogHere = hasLeftovers(table.def);

      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.translate(transform.offsetX, transform.offsetY);
      ctx.scale(transform.scale, transform.scale);

      drawPark(ctx, bounds);
      // Friends not yet asked wait behind the fence, peeking over it.
      if (table.phase === 'inviting') {
        table.def.friends.forEach((friend, index) => {
          if (index === 0 || table.seated.includes(friend)) return;
          drawWaiting(ctx, sprites, friend, fenceSpot(index), Math.abs(Math.sin(clock * 2 + index)) * 6);
        });
      }
      drawFence(ctx, sprites, bounds);

      // How many each plate shows: what it has, less what is still in the air.
      const shown = table.plates.map((count, plate) => count - flyers.filter((flyer) => flyer.plate === plate).length);
      // A share that would run out fills these plates and not the rest.
      const canFill = dialing ? Math.min(seated, Math.floor(table.basket / Math.max(1, table.dial))) : seated;
      const short = (plate: number): boolean => dialing && !look.fits && plate >= canFill;

      // The friends sit behind the table, so it hides them below the shoulders.
      table.seated.forEach((friend, plate) => {
        const face = held.get(plate);
        let mood: Mood = 'happy';
        if (feasting && (table.plates[plate] ?? 0) > 0) mood = 'eating';
        else if (face) mood = face.mood;
        else if (short(plate)) mood = 'puzzled';
        const bob = mood === 'eating' ? Math.abs(Math.sin(clock * 6 + plate)) * 5 : 0;
        drawFriend(ctx, sprites, friend, mood, places[plate]!, bob);
      });
      drawTable(ctx, sprites);
      places.forEach((seat, plate) => {
        drawPlate(ctx, seat);
        if (short(plate)) drawQuestion(ctx, { x: seat.x + 70, y: seat.y - 190 });
      });

      if (course.kind === 'cut') {
        if (table.phase === 'cutting') {
          drawFood(ctx, sprites, course.food, table.cuts.map((cut) => cut.angle), null);
          if (drag) {
            // The cut so far, as the knife is drawn across.
            const from = fromFood(course.food, drag.from);
            const to = fromFood(course.food, drag.to);
            ctx.save();
            ctx.strokeStyle = 'rgba(255,255,255,0.85)';
            ctx.lineWidth = 6;
            ctx.lineCap = 'round';
            ctx.setLineDash?.([12, 9]);
            ctx.beginPath();
            ctx.moveTo(from.x, from.y);
            ctx.lineTo(to.x, to.y);
            ctx.stroke();
            ctx.setLineDash?.([]);
            ctx.restore();
            drawKnife(ctx, to, Math.atan2(to.y - from.y, to.x - from.x) + Math.PI);
          } else {
            // The knife waits beside the food, to be picked up.
            drawKnife(ctx, fromFood(course.food, { x: 1.18, y: 0.7 }), -0.35 + Math.sin(clock * 2) * 0.04);
          }
        } else places.forEach((seat) => drawPiece(ctx, sprites, course.food, seat));
      } else if (treat) {
        places.forEach((seat, plate) => drawHeap(ctx, sprites, treat, Math.max(0, shown[plate] ?? 0), seat));
        const lift = 30 + Math.sin(clock * 3) * 5;
        // Ghosts of the next share, hovering over the plates they would go to.
        if (dialing) {
          for (let plate = 0; plate < canFill; plate += 1) drawHeap(ctx, sprites, treat, table.dial, places[plate]!, 0.55, table.plates[plate] ?? 0, lift);
        }
        if (inviting && seated >= 2) places.forEach((seat) => drawHeap(ctx, sprites, treat, look.each, seat, 0.55, 0, lift));
      }

      // The count on each plate, glowing together when they are all the same.
      if (course.kind !== 'cut') {
        const equal = shown.length > 0 && shown.every((count) => count === shown[0]) && (shown[0] ?? 0) > 0;
        places.forEach((seat, plate) => drawTag(ctx, String(Math.max(0, shown[plate] ?? 0)), { x: seat.x, y: seat.y + 34 }, 20, equal));
      } else if (table.phase !== 'cutting') {
        places.forEach((seat) => drawTag(ctx, seated === 2 ? '1/2' : '1/4', { x: seat.x, y: seat.y + 34 }, 24, true));
      }

      if (treat) {
        const waiting = table.basket + flyers.filter((flyer) => flyer.life < 0).length;
        drawBasket(ctx, sprites, waiting);
        drawPool(ctx, sprites, treat, waiting);
      }

      // Biscuit and his bowl, in rounds with leftovers: what cannot go round goes in it.
      if (dogHere) drawBowl(ctx);
      // In the bowl until he picks it up: then it is in his mouth instead.
      if (dogHere && bowl && eating === 0) {
        const landed = bowl.count - flyers.filter((flyer) => flyer.plate === BOWL_PLATE).length;
        for (let one = 0; one < landed; one += 1) drawCentred(ctx, sprites, bowl.treat, bowlSpot(one), 34);
      }
      const leftoverShown = dogHere && treat && look.leftover > 0 && ((dialing && look.fits) || (inviting && seated >= 2));
      if (treat && leftoverShown) {
        // The leftovers this share, or this table, would leave: hovering over his bowl.
        const lift = 26 + Math.sin(clock * 3) * 5;
        for (let one = 0; one < look.leftover; one += 1) {
          const spot = bowlSpot(one);
          drawCentred(ctx, sprites, treat, { x: spot.x, y: spot.y - lift }, 34, 0.55);
        }
      }
      if (dogHere) {
        drawDog(ctx, sprites, eating > 0 && bowl ? { treat: bowl.treat, progress: eating / DOG_EAT_SECONDS } : null, clock);
        const first = table.def.id === FIRST_DOG_ROUND;
        const talking = current.phase === 'playing' && !bowl && (first || current.since < BUBBLE_SECONDS);
        if (talking) drawBubble(ctx, first ? 'Just the one left over, please!' : 'Any left over? For me!', 1);
      }

      if (playing && (dialing || inviting)) {
        if (dialing) drawDial(ctx, sprites, table.dial, dialPulse);
        drawShare(ctx, sprites, look.fits);
      }

      for (const flyer of flyers) {
        if (flyer.life < 0) continue;
        const t = Math.min(1, flyer.life / FLY_SECONDS);
        const to = flyer.plate === BOWL_PLATE ? bowlSpot(flyer.slot) : heapSpot(places[flyer.plate] ?? { x: 576, y: 392 }, flyer.slot);
        const at = { x: flyer.from.x + (to.x - flyer.from.x) * t, y: flyer.from.y + (to.y - flyer.from.y) * t - Math.sin(t * Math.PI) * 120 };
        drawCentred(ctx, sprites, flyer.treat, at, 46 - t * 12);
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

      if (current.phase !== 'intro' && !banner) drawTopBar(ctx, current.level.line);
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
