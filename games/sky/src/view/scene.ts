import { DESIGN, fitToScreen, visibleBounds, type Point, type Size } from '@bundle/core';
import { sumText } from '../logic/equation.js';
import type { RunEvent, RunState } from '../logic/run.js';
import { drawBoom, drawBullet, drawFighter, drawMissed, drawPlane } from './plane-art.js';
import { drawBanner, drawHud, drawSolved, drawSummary, type Summary } from './hud.js';
import { planePoint } from './geometry.js';
import { TIMING } from './timing.js';

export interface SceneModel {
  run: RunState;
  /** The question, already written out, so the scene never does arithmetic. */
  sumText: string;
  /** How close the plane being asked about is to getting away, 0 to 1. */
  urgency: number;
  /** Whether a gold plane has a heart to give back right now. */
  heartOnOffer: boolean;
  /** Set once the run is over. */
  summary: Summary | null;
}

interface Boom {
  at: Point;
  life: number;
}

interface Solved {
  at: Point;
  text: string;
  life: number;
}

/** One that got away, and the sum it was carrying. */
interface Missed {
  at: Point;
  text: string;
  life: number;
}

export interface Scene {
  update(dt: number, model: SceneModel): void;
  /** What just happened, so the scene can react to it. State stays the run's. */
  observe(events: readonly RunEvent[]): void;
  render(ctx: CanvasRenderingContext2D, screen: Size): void;
  toDesign(point: Point, screen: Size): Point;
  readonly fighterX: number;
}

/** Drifting cloud, so the sky is never a blank wash. */
const CLOUDS: readonly { x: number; y: number; r: number; speed: number }[] = [
  { x: 0.15, y: 0.2, r: 80, speed: 0.012 },
  { x: 0.55, y: 0.12, r: 110, speed: 0.008 },
  { x: 0.8, y: 0.3, r: 70, speed: 0.016 },
  { x: 0.35, y: 0.45, r: 95, speed: 0.01 },
];

export function createScene(): Scene {
  const booms: Boom[] = [];
  const solved: Solved[] = [];
  const missed: Missed[] = [];
  let banner: { title: string; life: number } | null = null;
  let crack = 0;
  let drift = 0;
  let model: SceneModel | null = null;

  const scene: Scene = {
    // The run owns where the fighter is; the scene only draws it there, so a
    // shell always leaves from the nose the player can see.
    get fighterX() {
      return model?.run.fighterX ?? 0.5;
    },

    observe(events) {
      for (const event of events) {
        switch (event.type) {
          case 'destroyed':
            booms.push({ at: planePoint(event.plane), life: 0 });
            // The whole equation, finished. The child's confirmation.
            solved.push({
              at: planePoint(event.plane),
              text: `${sumText(event.sum)} = ${event.sum.answer}`,
              life: 0,
            });
            break;
          case 'damaged':
            booms.push({ at: planePoint(event.plane), life: TIMING.boomSeconds * 0.6 });
            break;
          case 'escaped':
            crack = TIMING.heartCrackSeconds;
            // Say what was lost and why, where it happened.
            missed.push({
              at: planePoint(event.plane),
              text: `${sumText(event.sum)} = ${event.sum.answer}`,
              life: 0,
            });
            break;
          case 'band':
            banner = { title: event.band.title, life: 0 };
            break;
          default:
            break;
        }
      }
    },

    update(dt, next) {
      model = next;
      drift += dt;

      for (const boom of booms) boom.life += dt;
      while (booms.length > 0 && booms[0]!.life > TIMING.boomSeconds) booms.shift();
      for (const entry of solved) entry.life += dt;
      while (solved.length > 0 && solved[0]!.life > TIMING.solvedSeconds) solved.shift();
      for (const entry of missed) entry.life += dt;
      while (missed.length > 0 && missed[0]!.life > TIMING.missedSeconds) missed.shift();
      if (crack > 0) crack = Math.max(0, crack - dt);
      if (banner) {
        banner.life += dt;
        if (banner.life > TIMING.bandAnnounceSeconds) banner = null;
      }
    },

    render(ctx, screen) {
      const current = model;
      if (!current) return;
      const transform = fitToScreen(screen);
      const bounds = visibleBounds(screen, transform);

      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.translate(transform.offsetX, transform.offsetY);
      ctx.scale(transform.scale, transform.scale);

      // Sky and cloud are painted across everything visible, so a screen of a
      // different shape is filled with sky rather than letterboxed.
      const gradient = ctx.createLinearGradient(0, bounds.top, 0, bounds.bottom);
      gradient.addColorStop(0, '#9fd2f2');
      gradient.addColorStop(1, '#dff0fb');
      ctx.fillStyle = gradient;
      ctx.fillRect(bounds.left, bounds.top, bounds.right - bounds.left, bounds.bottom - bounds.top);

      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      for (const cloud of CLOUDS) {
        const x = ((cloud.x + drift * cloud.speed) % 1.2) * DESIGN.width - DESIGN.width * 0.1;
        ctx.beginPath();
        ctx.arc(x, cloud.y * DESIGN.height, cloud.r, 0, Math.PI * 2);
        ctx.arc(x + cloud.r * 0.8, cloud.y * DESIGN.height + cloud.r * 0.2, cloud.r * 0.7, 0, Math.PI * 2);
        ctx.fill();
      }

      for (const plane of current.run.aloft) drawPlane(ctx, plane, current.heartOnOffer);
      for (const bullet of current.run.bullets) drawBullet(ctx, bullet.x, bullet.y);
      for (const boom of booms) drawBoom(ctx, boom.at, boom.life / TIMING.boomSeconds);
      for (const entry of solved) drawSolved(ctx, entry.at, entry.text, entry.life / TIMING.solvedSeconds);
      for (const entry of missed) drawMissed(ctx, entry.at, entry.text, entry.life / TIMING.missedSeconds);

      drawFighter(ctx, current.run.fighterX, {
        jammed: current.run.jam > 0,
        sum: current.sumText,
        urgency: current.urgency,
      });

      drawHud(ctx, {
        hearts: current.run.hearts,
        score: current.run.score,
        streak: current.run.streak,
        crack: crack / TIMING.heartCrackSeconds,
      });
      if (banner) drawBanner(ctx, banner.title, banner.life / TIMING.bandAnnounceSeconds);
      if (current.summary) drawSummary(ctx, current.summary);

      ctx.restore();
    },

    toDesign(point, screen) {
      return fitToScreen(screen).toDesign(point);
    },
  };

  return scene;
}
