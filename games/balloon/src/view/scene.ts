import { drawArrivingBanner, fitToScreen, visibleBounds, type Point, type Size } from '@bundle/core';
import type { DriverEvent, SceneModel } from '../driver.js';
import { layerOf } from '../logic/rescue-def.js';
import { answerLines, canLetGo, liftedSlots, trayTaken, type RescueState } from '../logic/rescue.js';
import {
  drawBalloon,
  drawBreeze,
  drawButton,
  drawCliff,
  drawEmptyClip,
  drawFox,
  drawGround,
  drawParachute,
  drawPopBurst,
  drawRope,
  drawSky,
  drawString,
  drawTrayShelf,
  drawWindLayers,
} from './art.js';
import { flightPose, type Pose } from './flight.js';
import { bunchCount, bunchPoint, harnessPoint, HOME, LAYOUT, ledgeSpot, trayPoint } from './geometry.js';
import { drawCount, drawFinished, drawGauge, drawSolved, drawStars, drawTopBar } from './hud.js';
import { TIMING } from './timing.js';

export interface Scene {
  update(dt: number, model: SceneModel): void;
  /** What just happened, so the scene can react. State stays the driver's. */
  observe(events: readonly DriverEvent[]): void;
  render(ctx: CanvasRenderingContext2D, screen: Size): void;
  toDesign(point: Point, screen: Size): Point;
  /** A balloon being dragged, drawn under the finger; null when nothing is. */
  setDrag(drag: Drag | null): void;
}

/** A balloon being dragged: where it came from, its value, and where the finger is. */
export interface Drag {
  from: { kind: 'tray'; index: number } | { kind: 'clipped'; slot: number };
  value: number;
  at: Point;
}

interface Burst {
  at: Point;
  value: number;
  life: number;
}

/** Where the kit is and how it looks, from the model alone. */
function poseOf(model: SceneModel): Pose {
  const def = model.rescue.def;
  if (model.phase === 'rescued' || model.phase === 'finished') {
    return { at: ledgeSpot(def), parachute: false, mood: 'happy' };
  }
  const flight = model.flight;
  if (model.phase === 'flying' && flight && flight.t >= flight.count) {
    return flightPose(def, flight.outcome, (flight.t - flight.count) / flight.fly);
  }
  return { at: HOME, parachute: false, mood: model.feedback?.verdict === 'short' ? 'strain' : 'calm' };
}

/** During the count: which lifting balloon is lit, and the total so far. */
function countNow(model: SceneModel): { slot: number; text: string } | null {
  const flight = model.flight;
  if (model.phase !== 'flying' || !flight || flight.t >= flight.count || flight.lifted.length === 0) return null;
  const beat = flight.count / flight.lifted.length;
  const index = Math.min(flight.lifted.length - 1, Math.floor(flight.t / beat));
  const sum = flight.lifted.slice(0, index + 1).reduce((total, value) => total + value, 0);
  const last = index === flight.lifted.length - 1;
  return { slot: liftedSlots(model.rescue)[index] ?? -1, text: last ? `${sum}!` : `${sum}…` };
}

function drawBunch(
  ctx: CanvasRenderingContext2D,
  state: RescueState,
  at: Point,
  lit: number,
  showFree: boolean,
  hide: number,
): void {
  const count = bunchCount(state);
  const ring = harnessPoint(at);
  const values = [...state.tied.map((balloon) => balloon.value), ...state.clipped.map((taken) => taken.value)];
  values.forEach((value, slot) => {
    if (slot === hide) return;
    const point = bunchPoint(slot, count, at);
    const limp = state.tied[slot]?.popped ?? false;
    drawString(ctx, ring, limp ? { x: point.x, y: point.y + 40 } : point);
    drawBalloon(ctx, point, value, { limp, glow: slot === lit ? 1 : 0 });
  });
  if (!showFree) return;
  for (let slot = values.length; slot < count; slot += 1) drawEmptyClip(ctx, ring, bunchPoint(slot, count, at));
}

export function createScene(): Scene {
  let model: SceneModel | null = null;
  let banner: { title: string; life: number } | null = null;
  let rescuedFor = 0;
  let clock = 0;
  let drag: Drag | null = null;
  const bursts: Burst[] = [];

  return {
    observe(events) {
      for (const event of events) {
        if (event.type === 'chapter') banner = { title: event.chapter.title, life: 0 };
        if (event.type === 'popped' && model) {
          bursts.push({ at: bunchPoint(event.index, bunchCount(model.rescue), HOME), value: event.value, life: 0 });
        }
        if (event.type === 'rescued') rescuedFor = 0;
      }
    },

    update(dt, next) {
      model = next;
      clock += dt;
      if (next.phase === 'rescued') rescuedFor += dt;
      if (banner) {
        banner.life += dt;
        if (banner.life > TIMING.chapterAnnounceSeconds) banner = null;
      }
      for (const burst of bursts) burst.life += dt;
      while (bursts.length > 0 && bursts[0]!.life > TIMING.popSeconds) bursts.shift();
    },

    render(ctx, screen) {
      const current = model;
      if (!current) return;
      const transform = fitToScreen(screen);
      const bounds = visibleBounds(screen, transform);
      const state = current.rescue;
      const def = state.def;
      const pose = poseOf(current);
      const building = current.phase === 'building';

      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.translate(transform.offsetX, transform.offsetY);
      ctx.scale(transform.scale, transform.scale);

      drawSky(ctx, bounds);
      const layer = layerOf(def);
      if (layer > 0) {
        drawCliff(ctx, bounds, 'right', LAYOUT.rightCliffEdgeX, ledgeSpot(def).y);
        drawWindLayers(ctx, bounds, layer, clock);
      } else {
        drawCliff(ctx, bounds, 'left', LAYOUT.cliffEdgeX);
        drawBreeze(ctx, bounds, clock);
      }
      drawGround(ctx, bounds);

      if (building && state.tied.length > 0) drawRope(ctx, HOME);
      if (pose.parachute) {
        drawParachute(ctx, pose.at);
      } else if (current.phase === 'rescued' || current.phase === 'finished') {
        // Safe on the ledge, the kit lets the bunch go: it rises away rather
        // than sitting over the top bar, which is where it would be otherwise.
        const rise = rescuedFor * TIMING.releaseRise;
        if (rise < TIMING.releaseGone) drawBunch(ctx, state, { x: pose.at.x, y: pose.at.y - rise }, -1, false, -1);
      } else {
        const hiddenSlot = drag?.from.kind === 'clipped' ? state.tied.length + drag.from.slot : -1;
        drawBunch(ctx, state, pose.at, countNow(current)?.slot ?? -1, building, hiddenSlot);
      }
      drawFox(ctx, pose.at, { weight: def.weight, mood: pose.mood, bob: clock * 0.8 });
      for (const burst of bursts) drawPopBurst(ctx, burst.at, burst.value, burst.life / TIMING.popSeconds);

      drawTrayShelf(ctx);
      def.tray.forEach((value, index) => {
        const lifted = drag?.from.kind === 'tray' && drag.from.index === index;
        if (!trayTaken(state, index) && !lifted) drawBalloon(ctx, trayPoint(def, index), value);
      });
      drawButton(ctx, building && canLetGo(state));
      if (drag && building) drawBalloon(ctx, drag.at, drag.value);

      drawTopBar(ctx, {
        title: current.chapter.title,
        number: current.number,
        count: current.chapter.rescues.length,
        line: def.line,
        totalStars: current.totalStars,
      });

      const count = countNow(current);
      if (count) drawCount(ctx, count.text, { x: HOME.x + 230, y: HOME.y - 320 });
      if (building && current.feedback) drawGauge(ctx, current.feedback);
      if (current.phase === 'rescued') {
        drawSolved(ctx, answerLines(state), rescuedFor / TIMING.solvedSeconds);
        if (rescuedFor >= TIMING.starsDelaySeconds) {
          drawStars(ctx, current.earned ?? 0, (rescuedFor - TIMING.starsDelaySeconds) / TIMING.starSeconds);
        }
      }
      if (banner) {
        drawArrivingBanner(ctx, banner.title, banner.life / TIMING.chapterAnnounceSeconds, TIMING.chapterSettleFraction, LAYOUT.hudY);
      }
      if (current.phase === 'finished') drawFinished(ctx, current.totalStars, current.maxStars);

      ctx.restore();
    },

    toDesign(point, screen) {
      return fitToScreen(screen).toDesign(point);
    },

    setDrag(next) {
      drag = next;
    },
  };
}
