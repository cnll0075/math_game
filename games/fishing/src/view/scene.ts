import { createSpring, drawArrivingBanner, fitToScreen, visibleBounds, type Bounds, type Point, type Size } from '@bundle/core';
import type { DriverEvent, SceneModel } from '../driver.js';
import { ITEMS, speciesOfWeight, type ItemId } from '../logic/species.js';
import { BAY, hookX, lineDrag, onLine, total, weightOf, type What, type WorldState } from '../logic/world.js';
import {
  drawBackdrop,
  drawBucketCount,
  drawBuoy,
  drawCreature,
  drawHook,
  drawHookButton,
  drawItemIcon,
  drawLine,
  drawRig,
  drawSeagull,
  drawSplash,
  drawSurface,
  drawDrowning,
  drawWake,
  drawTimer,
  drawWater,
} from './art.js';
import { BUCKET, bucketLocal, bucketMouth, LAYOUT, RIG, rigPoint, TIMER, type RigPlace } from './geometry.js';
import { drawFinished, drawFloat, drawGap, drawLost, drawProgress, drawTopBar, drawWon, lostLines } from './hud.js';
import type { Sprites } from './sprites.js';
import { TIMING } from './timing.js';

export interface Scene {
  update(dt: number, model: SceneModel): void;
  /** What just happened, so the scene can react. State stays the driver's. */
  observe(events: readonly DriverEvent[]): void;
  render(ctx: CanvasRenderingContext2D, screen: Size): void;
  toDesign(point: Point, screen: Size): Point;
}

/** How long a caught fish takes to fly from the line into the bucket. */
export const FLY_SECONDS = 0.6;

/** Out of a net, the fish fly into the bucket this far apart. */
export const NET_STAGGER = 0.2;

/** Rising words go this far out past the line, their middle never further left or right than this. */
const FLOAT_BESIDE = 190;
const FLOAT_LEFT = 190;
const FLOAT_RIGHT = 860;

/** How far through the roll the boy goes over the side. */
const OVERBOARD_AT = 0.35;

/** How far the boat leans for each unit of weight on the line, radians. */
export const LEAN_PER_WEIGHT = 0.026;

interface Float {
  text: string;
  at: Point;
  life: number;
}

interface Splash {
  at: Point;
  life: number;
  size: number;
}

/** A fish on its way somewhere: into the bucket, or back into the sea. */
interface Flyer {
  what: What;
  from: Point;
  to: Point;
  life: number;
  seconds: number;
  /** Into the bucket: it shrinks, and its weight is not counted until it lands. */
  bucket: boolean;
  weight: number;
}

/** The line under the title: on the first level it tells the two things to do. */
export function coachLine(model: SceneModel): string {
  const { level, world } = model;
  if (!level.coach) return level.line;
  if (world.sailed === 0) return 'Tap the water to move the boat';
  if (world.casts === 0) return 'Now tap the yellow hook button!';
  return level.line;
}

export function createScene(sprites: Sprites): Scene {
  let model: SceneModel | null = null;
  let clock = 0;
  let banner: { title: string; life: number } | null = null;
  const lean = createSpring(0, { stiffness: 60 });
  const sink = createSpring(4, { stiffness: 40 });
  /** Where the boat is drawn now, with any extra roll and sink a capsize adds. */
  const placeOf = (world: WorldState, roll = 0): RigPlace => ({
    x: world.boat.x,
    angle: lean.value + roll * roll * 2.6,
    sink: sink.value + roll * 46,
  });
  const floats: Float[] = [];
  const splashes: Splash[] = [];
  const flyers: Flyer[] = [];
  let bump = 0;
  let pulse = 0;

  const launch = (what: What, from: Point, to: Point, bucket: boolean, delay = 0): void => {
    flyers.push({ what, from, to, life: -delay, seconds: bucket ? FLY_SECONDS : 0.9, bucket, weight: bucket ? weightOf(what) : 0 });
  };

  return {
    observe(events) {
      // Out of a net, the sum is said once rather than a "+3" for every fish.
      const netted = events.some((event) => event.type === 'netted');
      for (const event of events) {
        if (event.type === 'level') {
          banner = { title: event.retry ? 'Try again!' : event.level.title, life: 0 };
          floats.length = 0;
          flyers.length = 0;
          splashes.length = 0;
          lean.snap(0);
          sink.snap(4);
        }
        if (!model) continue;
        const world = model.world;
        const x = hookX(world);
        const place = placeOf(world);
        // Words rise over open water: out past the line, or behind the boat when
        // it is too near the timer for that. The fish fly the other way, to the bucket.
        const ahead = x + FLOAT_BESIDE;
        const above = { x: ahead <= FLOAT_RIGHT ? ahead : Math.max(FLOAT_LEFT, world.boat.x - 280), y: BAY.surfaceY - 100 };
        switch (event.type) {
          case 'cast':
            splashes.push({ at: { x, y: BAY.surfaceY + 4 }, life: 0, size: 20 });
            break;
          case 'caught': {
            const species = speciesOfWeight(event.weight);
            const from = { x: x + (event.order % 2 === 1 ? -1 : 1) * 24 * Math.ceil(event.order / 2), y: BAY.surfaceY - 30 };
            if (species) launch({ kind: 'fish', species }, from, bucketMouth(place), true, event.order * NET_STAGGER);
            if (!netted) floats.push({ text: `+${event.weight}`, at: above, life: 0 });
            if (event.order === 0) splashes.push({ at: { x, y: BAY.surfaceY }, life: 0, size: 26 });
            break;
          }
          case 'netted': {
            const sum = event.weights.reduce((acc, weight) => acc + weight, 0);
            floats.push({ text: `${event.weights.join(' + ')} = ${sum}`, at: above, life: 0 });
            break;
          }
          case 'item':
            floats.push({ text: ITEMS[event.item].says, at: above, life: 0 });
            break;
          case 'saved': {
            event.weights.forEach((weight, index) => {
              const species = speciesOfWeight(weight);
              const to = { x: x + 120 + index * 50, y: BAY.surfaceY + 120 + index * 30 };
              if (species) launch({ kind: 'fish', species }, { x, y: BAY.surfaceY - 30 }, to, false, index * 0.1);
            });
            floats.push({ text: `Too heavy! Back you go!`, at: above, life: 0 });
            break;
          }
          case 'capsized': {
            // Everything in the bucket leaps for freedom.
            const mouth = bucketMouth(place);
            world.bucket.forEach((weight, index) => {
              const species = speciesOfWeight(weight);
              if (!species) return;
              const from = { x: mouth.x + index * 8, y: mouth.y };
              const to = { x: mouth.x - 220 + index * 80, y: BAY.surfaceY + 140 + (index % 3) * 40 };
              flyers.push({ what: { kind: 'fish', species }, from, to, life: -FLY_SECONDS - 0.4 - index * 0.08, seconds: 0.9, bucket: false, weight: 0 });
            });
            break;
          }
          case 'tick':
            pulse = 1;
            break;
          default:
            break;
        }
      }
    },

    update(dt, next) {
      model = next;
      clock += dt;
      if (banner) {
        banner.life += dt;
        if (banner.life > TIMING.introSeconds) banner = null;
      }
      for (const float of floats) float.life += dt;
      while (floats.length > 0 && floats[0]!.life > TIMING.floatSeconds) floats.shift();
      for (const splash of splashes) splash.life += dt;
      while (splashes.length > 0 && splashes[0]!.life > TIMING.splashSeconds) splashes.shift();
      for (const flyer of flyers) {
        const before = flyer.life;
        flyer.life += dt;
        if (flyer.bucket && before < flyer.seconds && flyer.life >= flyer.seconds) bump = 1;
        if (!flyer.bucket && before < flyer.seconds && flyer.life >= flyer.seconds) {
          splashes.push({ at: { x: flyer.to.x, y: BAY.surfaceY + 2 }, life: 0, size: 18 });
        }
      }
      for (let index = flyers.length - 1; index >= 0; index -= 1) {
        if (flyers[index]!.life > flyers[index]!.seconds) flyers.splice(index, 1);
      }
      bump = Math.max(0, bump - dt * 3);
      pulse = Math.max(0, pulse - dt * 3);

      // The physics the child feels: weight on the line pulls the boat over,
      // a fuller bucket sits it lower in the water.
      const world = next.world;
      const drag = lineDrag(world);
      const share = Math.min(1, total(world) / Math.max(1, world.def.capacity));
      lean.target = drag * LEAN_PER_WEIGHT + (world.hook.state === 'dropping' ? 0.02 : 0) + Math.sin(clock * 1.3) * 0.018;
      sink.target = 4 + share * 14 + drag * 1.2;
      lean.step(dt);
      sink.step(dt);
    },

    render(ctx, screen) {
      const current = model;
      if (!current) return;
      const transform = fitToScreen(screen);
      const bounds = visibleBounds(screen, transform);
      const world = current.world;
      const x = hookX(world);

      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.translate(transform.offsetX, transform.offsetY);
      ctx.scale(transform.scale, transform.scale);

      drawBackdrop(ctx, bounds, sprites);
      drawSeagull(ctx, sprites, bounds, clock);
      drawWater(ctx, bounds, clock, sprites);
      drawBuoy(ctx, sprites, 1110, clock);

      for (const part of ['body', 'tag'] as const) {
        for (const swimmer of world.swimmers) {
          if (swimmer.hooked) continue;
          drawCreature(ctx, sprites, { what: swimmer.what, at: swimmer, dir: swimmer.dir, hooked: false, clock, phase: swimmer.phase, part });
        }
      }

      // Capsizing: the boat rolls over once the last fish has reached the bucket.
      const capsized = current.outcome === 'capsized' && current.phase === 'lost';
      const roll = capsized ? Math.max(0, Math.min(1, (current.since - FLY_SECONDS) / TIMING.capsizeSeconds)) : 0;
      const place = placeOf(world, roll);
      const overboard = roll > OVERBOARD_AT;
      const hop = current.phase === 'won' && current.since < 1.6 ? Math.abs(Math.sin(current.since * 8)) * 12 : 0;

      if (!capsized) {
        const tip = rigPoint(place, { x: RIG.rodTip.x, y: RIG.rodTip.y - hop });
        drawLine(ctx, tip, { x, y: world.hook.y - 14 }, lineDrag(world) / 8, clock);
        const haul = onLine(world);
        // Holding a net, the next cast is the net's: it hangs from the rod ready.
        const net = world.hook.net || (world.nets > 0 && world.hook.state === 'ready');
        // A net goes behind what it scooped, so every number can be read; a hook goes in front.
        if (net) drawHook(ctx, sprites, { x, y: world.hook.y }, true, world.hook.state);
        for (const part of ['body', 'tag'] as const) {
          for (const on of haul) drawCreature(ctx, sprites, { what: on.what, at: on, dir: on.dir, hooked: true, clock, phase: on.phase, part });
        }
        if (!net) drawHook(ctx, sprites, { x, y: world.hook.y }, false, world.hook.state);
      }
      // The bucket counts a fish when it lands in it, not while it is in the air.
      const flying = flyers.filter((flyer) => flyer.bucket && flyer.life < flyer.seconds);
      const shown = total(world) - flying.reduce((sum, flyer) => sum + flyer.weight, 0);
      const inBucket = world.bucket.slice(0, world.bucket.length - flying.length);
      // Over the top, the fish have all leapt out by the time the boat is on its side.
      const fish = capsized && roll > 0.2 ? [] : inBucket.flatMap((weight) => speciesOfWeight(weight) ?? []);
      const bucket = { total: shown, capacity: world.def.capacity, bump, over: shown > world.def.capacity, fish };
      if (!capsized) {
        const sailing = Math.abs(world.boat.target - world.boat.x) > 1 ? Math.sign(world.boat.target - world.boat.x) : 0;
        drawWake(ctx, world.boat.x, sailing, clock);
      }
      drawRig(ctx, sprites, { place, overboard, hop, bucket }, clock);
      drawSurface(ctx, bounds, clock);
      // When the boat is half off the left edge, the count stays on the screen.
      if (!overboard) drawBucketCount(ctx, bucket, onScreen(rigPoint(place, bucketLocal(BUCKET.label)), bounds, 60));
      if (overboard) {
        // Thrown off over the side the boat rolled towards.
        const beside = rigPoint({ ...place, angle: 0, sink: 0 }, { x: RIG.boat.width + 110, y: RIG.waterline });
        const t = current.since - FLY_SECONDS - TIMING.capsizeSeconds * OVERBOARD_AT;
        drawDrowning(ctx, sprites, beside.x, t, clock);
        if (roll < 0.6) drawSplash(ctx, { x: beside.x, y: BAY.surfaceY }, (roll - OVERBOARD_AT) / 0.25, 60);
      }
      for (const splash of splashes) drawSplash(ctx, splash.at, splash.life / TIMING.splashSeconds, splash.size);

      drawTimer(ctx, sprites, { timeLeft: world.timeLeft, seconds: world.def.seconds, pulse });
      drawProgress(ctx, current.number, current.count, current.totalStars);
      if (world.def.showGap && playingPhase(current) && !capsized) {
        // Beside the bucket, out past the stern, so it never sits on the line under the title.
        drawGap(ctx, world.def.capacity - shown, onScreen(rigPoint(place, bucketLocal({ x: -62, y: 70 })), bounds, 70, 70));
      }
      drawHeld(ctx, sprites, world.fast, world.saves, world.nets);
      drawTopBar(ctx, coachLine(current));
      if (banner) drawArrivingBanner(ctx, banner.title, banner.life / TIMING.introSeconds, TIMING.introSettleFraction, LAYOUT.titleY);

      const playing = playingPhase(current);
      const beckon = current.level.coach && world.sailed > 0 && world.casts === 0 ? (clock * 1.2) % 1 : 0;
      drawHookButton(ctx, sprites, playing && world.hook.state === 'ready', beckon, world.nets > 0);

      for (const flyer of flyers) {
        if (flyer.life < 0) continue;
        const t = Math.min(1, flyer.life / flyer.seconds);
        const lift = flyer.bucket ? 160 : 90;
        const at = {
          x: flyer.from.x + (flyer.to.x - flyer.from.x) * t,
          y: flyer.from.y + (flyer.to.y - flyer.from.y) * t - Math.sin(t * Math.PI) * lift,
        };
        drawCreature(ctx, sprites, {
          what: flyer.what,
          at,
          dir: flyer.to.x < flyer.from.x ? -1 : 1,
          hooked: false,
          clock,
          phase: 0,
          scale: flyer.bucket ? 1 - t * 0.6 : 1,
          alpha: flyer.bucket ? 1 : 1 - Math.max(0, t - 0.8) / 0.2,
        });
      }
      for (const float of floats) drawFloat(ctx, float.text, float.at, float.life / TIMING.floatSeconds);

      if (current.phase === 'won') {
        const since = current.since - FLY_SECONDS;
        if (since > 0) {
          drawWon(
            ctx,
            world.bucket,
            since / TIMING.solvedSeconds,
            current.earned ?? 0,
            (since - TIMING.starsDelaySeconds) / TIMING.starSeconds,
            current.since >= FLY_SECONDS + TIMING.starsDelaySeconds + (current.earned ?? 0) * TIMING.starSeconds,
          );
        }
      }
      if (current.phase === 'lost' && current.outcome) {
        const wait = current.outcome === 'capsized' ? FLY_SECONDS + TIMING.capsizeSeconds : current.outcome === 'stuck' ? FLY_SECONDS : 0;
        if (current.since > wait) {
          const gap = world.def.capacity - total(world);
          drawLost(ctx, lostLines(current.outcome, world.bucket, world.def.capacity, gap), (current.since - wait) / 0.6, current.since >= TIMING.lostHoldSeconds);
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

/** Kept inside the visible screen, `margin` from the left edge, `lift` higher when pushed. */
function onScreen(at: Point, bounds: Bounds, margin: number, lift = 0): Point {
  const left = bounds.left + margin;
  return at.x >= left ? at : { x: left, y: at.y - lift };
}

const playingPhase = (model: SceneModel): boolean => model.phase === 'intro' || model.phase === 'fishing';

/** The things held, in a row under the timer: what the potions and the net have given. */
function drawHeld(ctx: CanvasRenderingContext2D, sprites: Sprites, fast: boolean, saves: number, nets: number): void {
  const held: ItemId[] = [];
  if (fast) held.push('speed-potion');
  for (let save = 0; save < saves; save += 1) held.push('health-potion');
  for (let net = 0; net < nets; net += 1) held.push('net');
  const y = LAYOUT.timer.y + TIMER.height * LAYOUT.timer.scale + 56;
  const right = LAYOUT.timer.x + TIMER.width * LAYOUT.timer.scale;
  held.forEach((item, index) => drawItemIcon(ctx, sprites, item, { x: right - 20 - index * 44, y }, 40));
}
