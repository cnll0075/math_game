import { drawArrivingBanner, fitToScreen, visibleBounds, type Point, type Size } from '@bundle/core';
import { sumText } from '@bundle/math';
import { laneCentre } from '../logic/lanes.js';
import type { RunEvent, RunState } from '../logic/run.js';
import { drawBerry, drawBurst, drawObstacle, drawPath, drawRabbit } from './art.js';
import { drawHud, drawSolved, drawSummary, drawThump, type Summary } from './hud.js';
import { PATH, pathPoint } from './geometry.js';
import { TIMING } from './timing.js';

export interface SceneModel {
  run: RunState;
  /** The sum the rabbit wears, already written out. */
  sumText: string;
  stumbling: boolean;
  summary: Summary | null;
}

interface Fading {
  at: Point;
  text: string;
  life: number;
}

export interface Scene {
  update(dt: number, model: SceneModel): void;
  /** What just happened, so the scene can react. State stays the run's. */
  observe(events: readonly RunEvent[]): void;
  render(ctx: CanvasRenderingContext2D, screen: Size): void;
  toDesign(point: Point, screen: Size): Point;
}

export function createScene(): Scene {
  const bursts: Fading[] = [];
  const solved: Fading[] = [];
  let thump: { text: string; life: number } | null = null;
  let banner: { title: string; life: number } | null = null;
  let flash = 0;
  let scroll = 0;
  let bob = 0;
  let model: SceneModel | null = null;

  const scene: Scene = {
    observe(events) {
      for (const event of events) {
        switch (event.type) {
          case 'burst': {
            const at = pathPoint(laneCentre(event.lane), 1);
            bursts.push({ at, text: '', life: 0 });
            solved.push({ at, text: `${sumText(event.sum)} = ${event.sum.answer}`, life: 0 });
            break;
          }
          case 'thump':
            flash = TIMING.flashSeconds;
            thump = { text: `${sumText(event.sum)} = ${event.sum.answer}`, life: 0 };
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
      // The ground only scrolls as fast as the rabbit is actually running.
      scroll += dt * TIMING.groundScroll * (next.stumbling ? 0.35 : 1);
      bob += dt * (next.stumbling ? 1.4 : 3.2);
      if (flash > 0) flash = Math.max(0, flash - dt);
      for (const entry of bursts) entry.life += dt;
      while (bursts.length > 0 && bursts[0]!.life > TIMING.burstSeconds) bursts.shift();
      for (const entry of solved) entry.life += dt;
      while (solved.length > 0 && solved[0]!.life > TIMING.solvedSeconds) solved.shift();
      if (thump) {
        thump.life += dt;
        if (thump.life > TIMING.thumpSeconds) thump = null;
      }
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

      // Meadow across everything visible, so an odd-shaped screen is filled
      // with grass rather than letterboxed.
      ctx.fillStyle = '#a8d98b';
      ctx.fillRect(bounds.left, bounds.top, bounds.right - bounds.left, bounds.bottom - bounds.top);

      drawPath(ctx, scroll);

      for (const berry of current.run.berries) {
        if (berry.taken) continue;
        drawBerry(ctx, pathPoint(laneCentre(berry.lane), berry.progress));
      }
      for (const row of current.run.rows) {
        if (row.resolved) continue;
        row.numbers.forEach((number, lane) => {
          drawObstacle(ctx, pathPoint(laneCentre(lane), row.progress), row.kinds[lane] ?? 'rock', number);
        });
      }
      for (const entry of bursts) drawBurst(ctx, entry.at, entry.life / TIMING.burstSeconds);
      for (const entry of solved) drawSolved(ctx, entry.at, entry.text, entry.life / TIMING.solvedSeconds);

      drawRabbit(ctx, current.run.rabbitX, {
        sum: current.sumText,
        stumbling: current.stumbling,
        bob,
      });

      drawHud(ctx, {
        health: current.run.health,
        score: current.run.score,
        streak: current.run.streak,
        flash: flash / TIMING.flashSeconds,
      });
      if (banner) {
        drawArrivingBanner(
          ctx,
          banner.title,
          banner.life / TIMING.bandAnnounceSeconds,
          TIMING.bandSettleFraction,
          PATH.hudY,
        );
      }
      if (thump) drawThump(ctx, thump.text, thump.life / TIMING.thumpSeconds);
      if (current.summary) drawSummary(ctx, current.summary);

      ctx.restore();
    },

    toDesign(point, screen) {
      return fitToScreen(screen).toDesign(point);
    },
  };

  return scene;
}
