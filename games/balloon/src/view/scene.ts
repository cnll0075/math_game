import { drawArrivingBanner, fitToScreen, visibleBounds, type Point, type Size } from '@bundle/core';
import type { DriverEvent, SceneModel } from '../driver.js';
import { answerLines, canLetGo, liftedSlots, puffTaken, trayTaken, type RescueState } from '../logic/rescue.js';
import {
  drawBalloon,
  drawButton,
  drawCliff,
  drawFox,
  drawGround,
  drawParachute,
  drawPopBurst,
  drawPuff,
  drawRope,
  drawSky,
  drawStepMarks,
  drawString,
  drawTrayShelf,
  drawWindSock,
} from './art.js';
import { flightPose, type Pose } from './flight.js';
import { bunchPoint, harnessPoint, HOME, LAYOUT, ledgeSpot, puffPoint, puffTrayPoint, trayPoint } from './geometry.js';
import { drawCount, drawFinished, drawGauge, drawSolved, drawStars, drawTopBar } from './hud.js';
import { TIMING } from './timing.js';

export interface Scene {
  update(dt: number, model: SceneModel): void;
  /** What just happened, so the scene can react. State stays the driver's. */
  observe(events: readonly DriverEvent[]): void;
  render(ctx: CanvasRenderingContext2D, screen: Size): void;
  toDesign(point: Point, screen: Size): Point;
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

function drawBunch(ctx: CanvasRenderingContext2D, state: RescueState, at: Point, lit: number): void {
  const count = state.tied.length + state.clipped.length;
  const ring = harnessPoint(at);
  const values = [...state.tied.map((balloon) => balloon.value), ...state.clipped.map((taken) => taken.value)];
  values.forEach((value, slot) => {
    const point = bunchPoint(slot, count, at);
    const limp = state.tied[slot]?.popped ?? false;
    drawString(ctx, ring, limp ? { x: point.x, y: point.y + 40 } : point);
    drawBalloon(ctx, point, value, { limp, glow: slot === lit ? 1 : 0 });
  });
}

export function createScene(): Scene {
  let model: SceneModel | null = null;
  let banner: { title: string; life: number } | null = null;
  let rescuedFor = 0;
  let bob = 0;
  const bursts: Burst[] = [];

  return {
    observe(events) {
      for (const event of events) {
        if (event.type === 'chapter') banner = { title: event.chapter.title, life: 0 };
        if (event.type === 'popped' && model) {
          const count = model.rescue.tied.length + model.rescue.clipped.length;
          bursts.push({ at: bunchPoint(event.index, count, HOME), value: event.value, life: 0 });
        }
        if (event.type === 'rescued') rescuedFor = 0;
      }
    },

    update(dt, next) {
      model = next;
      bob += dt * 0.8;
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
      if (def.wind) {
        drawCliff(ctx, bounds, 'right', ledgeSpot(def).x - 50);
        drawWindSock(ctx, def.wind.wind);
      } else {
        drawCliff(ctx, bounds, 'left', LAYOUT.cliffEdgeX);
      }
      drawGround(ctx, bounds);
      if (def.wind) drawStepMarks(ctx, def.wind.ledge);

      if (building && state.tied.length > 0) drawRope(ctx, HOME);
      state.puffs.forEach((taken, slot) => drawPuff(ctx, puffPoint(slot, pose.at), taken.value));
      if (pose.parachute) {
        drawParachute(ctx, pose.at);
      } else {
        drawBunch(ctx, state, pose.at, countNow(current)?.slot ?? -1);
      }
      drawFox(ctx, pose.at, { weight: def.weight, mood: pose.mood, bob });
      for (const burst of bursts) drawPopBurst(ctx, burst.at, burst.value, burst.life / TIMING.popSeconds);

      drawTrayShelf(ctx);
      def.tray.forEach((value, index) => {
        if (!trayTaken(state, index)) drawBalloon(ctx, trayPoint(def, index), value);
      });
      def.wind?.puffs.forEach((value, index) => {
        if (!puffTaken(state, index)) drawPuff(ctx, puffTrayPoint(def, index), value);
      });
      drawButton(ctx, building && canLetGo(state));

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
  };
}
