import { drawArrivingBanner, fitToScreen, visibleBounds, type Point, type Size } from '@bundle/core';
import type { DriverEvent, SceneModel } from '../driver.js';
import { kitsOf, weightsOf } from '../logic/rescue-def.js';
import { answerLines, canLetGo, canStartOver, clippedOn, liftedSlots, trayTaken, type RescueState } from '../logic/rescue.js';
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
  drawResetButton,
  drawRope,
  drawSelectRing,
  drawSky,
  drawString,
  drawTrayShelf,
} from './art.js';
import { flightPose, type Pose } from './flight.js';
import { bunchCount, bunchPoint, harnessPoint, homeOf, LAYOUT, ledgeSpot, limpPoint, trayPoint } from './geometry.js';
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
  from: { kind: 'tray'; index: number } | { kind: 'clipped'; kit: number; slot: number };
  value: number;
  at: Point;
}

/** How far a kit has risen by the end of the count when its total reaches its weight. */
export const COUNT_RISE = 44;

interface Burst {
  at: Point;
  value: number;
  life: number;
}

const sum = (values: readonly number[]): number => values.reduce((total, value) => total + value, 0);

/** The count, kit by kit: the balloon lit now, and each kit's running total. */
interface CountNow {
  kit: number;
  index: number;
  totals: number[];
  done: boolean[];
}

function countNow(model: SceneModel): CountNow | null {
  const flight = model.flight;
  if (model.phase !== 'flying' || !flight || flight.t >= flight.count) return null;
  const all = flight.lifted.flatMap((values, kit) => values.map((value, index) => ({ kit, index, value })));
  if (all.length === 0) return null;
  const step = Math.min(all.length - 1, Math.floor(flight.t / (flight.count / all.length)));
  const totals = flight.lifted.map(() => 0);
  for (const entry of all.slice(0, step + 1)) totals[entry.kit] = (totals[entry.kit] ?? 0) + entry.value;
  const current = all[step]!;
  const done = flight.lifted.map((values, kit) =>
    kit < current.kit || (kit === current.kit && current.index === values.length - 1),
  );
  return { kit: current.kit, index: current.index, totals, done };
}

/** How high the count has lifted a kit: in proportion to its total over its weight. */
const countLift = (total: number, weight: number): number => COUNT_RISE * Math.min(1, total / Math.max(1, weight));

/** Where a kit is and how it looks, from the model alone. */
export function kitPose(model: SceneModel, kit: number): Pose {
  const def = model.rescue.def;
  const home = homeOf(def, kit);
  const spot = ledgeSpot(def, kit);
  if (model.phase === 'rescued' || model.phase === 'finished') return { at: spot, parachute: false, mood: 'happy' };

  const weight = weightsOf(def)[kit] ?? def.weight;
  const flight = model.flight;
  if (model.phase === 'flying' && flight) {
    if (flight.t < flight.count) {
      const total = countNow(model)?.totals[kit] ?? 0;
      return { at: { x: home.x, y: home.y - countLift(total, weight) }, parachute: false, mood: 'calm' };
    }
    const outcome = flight.outcomes[kit];
    if (!outcome) return { at: home, parachute: false, mood: 'calm' };
    // Each kit flies on its own clock and then holds still, rather than every
    // flight being stretched to the longest one.
    const flyT = (flight.t - flight.count) / TIMING.flight[outcome.verdict];
    const land = flight.outcomes.every((each) => each.verdict === 'exact');
    const pose = flightPose(outcome, flyT, home, spot, land);
    // Carry on from where the count left the kit, rather than snapping back to the ground.
    const carried = countLift(sum(flight.lifted[kit] ?? []), weight) * Math.max(0, 1 - flyT / 0.25);
    return { ...pose, at: { x: pose.at.x, y: pose.at.y - carried } };
  }
  const verdict = model.feedback?.[kit]?.verdict;
  return { at: home, parachute: false, mood: verdict === 'short' ? 'strain' : 'calm' };
}

function drawBunch(
  ctx: CanvasRenderingContext2D,
  state: RescueState,
  kit: number,
  at: Point,
  lit: number,
  showFree: boolean,
  hide: number,
): void {
  const count = bunchCount(state, kit);
  const ring = harnessPoint(at);
  const tied = kit === 0 ? state.tied : [];
  const values = [...tied.map((balloon) => balloon.value), ...clippedOn(state, kit).map((taken) => taken.value)];
  values.forEach((value, slot) => {
    if (slot === hide) return;
    const point = bunchPoint(slot, count, at);
    const limp = tied[slot]?.popped ?? false;
    drawString(ctx, ring, limp ? { x: point.x, y: limpPoint(point).y - 14 } : point);
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
          const at = bunchPoint(event.index, bunchCount(model.rescue, 0), homeOf(model.rescue.def, 0));
          bursts.push({ at, value: event.value, life: 0 });
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
      const kits = kitsOf(def);
      const weights = weightsOf(def);
      const building = current.phase === 'building';
      const count = countNow(current);

      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.translate(transform.offsetX, transform.offsetY);
      ctx.scale(transform.scale, transform.scale);

      drawSky(ctx, bounds);
      drawCliff(ctx, bounds, 'left', LAYOUT.cliffEdgeX);
      drawBreeze(ctx, bounds, clock);
      drawGround(ctx, bounds);

      for (let kit = 0; kit < kits; kit += 1) {
        const home = homeOf(def, kit);
        const pose = kitPose(current, kit);
        if (building && kit === 0 && state.tied.length > 0) drawRope(ctx, home);
        if (building && kits > 1 && kit === current.selected) drawSelectRing(ctx, home);
        if (pose.parachute) {
          drawParachute(ctx, pose.at);
        } else if (current.phase === 'rescued' || current.phase === 'finished') {
          // Safe on the ledge, the kit lets the bunch go: it rises away rather
          // than sitting over the top bar, which is where it would be otherwise.
          const rise = rescuedFor * TIMING.releaseRise;
          if (rise < TIMING.releaseGone) drawBunch(ctx, state, kit, { x: pose.at.x, y: pose.at.y - rise }, -1, false, -1);
        } else {
          const lit = count && count.kit === kit ? liftedSlots(state, kit)[count.index] ?? -1 : -1;
          const tiedHere = kit === 0 ? state.tied.length : 0;
          const hide = drag?.from.kind === 'clipped' && drag.from.kit === kit ? tiedHere + drag.from.slot : -1;
          drawBunch(ctx, state, kit, pose.at, lit, building, hide);
        }
        drawFox(ctx, pose.at, { weight: weights[kit] ?? def.weight, mood: pose.mood, bob: clock * 0.8 });
      }
      for (const burst of bursts) drawPopBurst(ctx, burst.at, burst.value, burst.life / TIMING.popSeconds);

      drawTrayShelf(ctx);
      def.tray.forEach((value, index) => {
        const lifted = drag?.from.kind === 'tray' && drag.from.index === index;
        if (!trayTaken(state, index) && !lifted) drawBalloon(ctx, trayPoint(def, index), value);
      });
      drawButton(ctx, building && canLetGo(state));
      drawResetButton(ctx, building && canStartOver(state));
      if (drag && building) drawBalloon(ctx, drag.at, drag.value);

      drawTopBar(ctx, {
        title: current.chapter.title,
        number: current.number,
        count: current.chapter.rescues.length,
        line: def.line,
        totalStars: current.totalStars,
      });

      if (count) {
        for (let kit = 0; kit < kits; kit += 1) {
          const total = count.totals[kit] ?? 0;
          if (total === 0) continue;
          const home = homeOf(def, kit);
          const at = kits > 1 ? { x: home.x, y: 190 } : { x: HOME_COUNT.x, y: HOME_COUNT.y };
          drawCount(ctx, count.done[kit] ? `${total}!` : `${total}…`, at);
        }
      }
      if (building && current.feedback) {
        if (kits > 1) {
          current.feedback.forEach((outcome, kit) => drawGauge(ctx, outcome, { x: homeOf(def, kit).x, y: 185 }, true));
        } else if (current.feedback[0]) {
          drawGauge(ctx, current.feedback[0]);
        }
      }
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

/** Where a lone kit's count is written: up and to the right of it. */
const HOME_COUNT: Point = { x: LAYOUT.homeX + 230, y: LAYOUT.groundY - 320 };
