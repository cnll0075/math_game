import { drawArrivingBanner, fitToScreen, visibleBounds, type Point, type Size } from '@bundle/core';
import type { DriverEvent, SceneModel } from '../driver.js';
import { BOARDS, pairsOf } from '../logic/boards.data.js';
import { sumText } from '../logic/sums.js';
import { drawPad, drawPond } from './art.js';
import { LAYOUT, padFont, padRect } from './geometry.js';
import { drawEndCard, drawMatchLine, drawPicker, drawTopBar } from './hud.js';
import { TIMING } from './timing.js';

export interface Scene {
  update(dt: number, model: SceneModel): void;
  /** What just happened, so the scene can react. State stays the driver's. */
  observe(events: readonly DriverEvent[]): void;
  render(ctx: CanvasRenderingContext2D, screen: Size): void;
  toDesign(point: Point, screen: Size): Point;
  /** The keyboard highlight, or null. */
  setCursor(index: number | null): void;
}

export function createScene(): Scene {
  let model: SceneModel | null = null;
  let clock = 0;
  let clearedFor = 0;
  let cursor: number | null = null;
  /** Seconds since each pad started turning over. */
  const turning = new Map<number, number>();
  /** Seconds since each matched pad's flower started opening. */
  const blooming = new Map<number, number>();
  let matchLine: { text: string; life: number } | null = null;
  let banner: { title: string; life: number } | null = null;

  return {
    observe(events) {
      for (const event of events) {
        switch (event.type) {
          case 'flipped':
            turning.set(event.index, 0);
            break;
          case 'hidden':
            turning.set(event.a, 0);
            turning.set(event.b, 0);
            break;
          case 'matched': {
            blooming.set(event.a, 0);
            blooming.set(event.b, 0);
            const pads = model?.game.pads;
            const first = pads?.[event.a]?.card.sum;
            const second = pads?.[event.b]?.card.sum;
            if (first && second) matchLine = { text: `${sumText(first)} = ${event.value} = ${sumText(second)}`, life: 0 };
            break;
          }
          case 'board':
            turning.clear();
            blooming.clear();
            matchLine = null;
            banner = { title: event.board.title, life: 0 };
            break;
          case 'scored':
            clearedFor = 0;
            break;
          default:
            break;
        }
      }
    },

    update(dt, next) {
      model = next;
      clock += dt;
      if (next.phase === 'cleared') clearedFor += dt;
      for (const [index, life] of turning) {
        if (life + dt >= TIMING.flipSeconds) turning.delete(index);
        else turning.set(index, life + dt);
      }
      for (const [index, life] of blooming) blooming.set(index, Math.min(TIMING.bloomSeconds, life + dt));
      if (matchLine) {
        matchLine.life += dt;
        if (matchLine.life > TIMING.matchLineSeconds) matchLine = null;
      }
      if (banner) {
        banner.life += dt;
        if (banner.life > TIMING.boardAnnounceSeconds) banner = null;
      }
    },

    render(ctx, screen) {
      const current = model;
      if (!current) return;
      const transform = fitToScreen(screen);
      const bounds = visibleBounds(screen, transform);
      const size = current.board.size;
      const font = padFont(size);

      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.translate(transform.offsetX, transform.offsetY);
      ctx.scale(transform.scale, transform.scale);

      drawPond(ctx, bounds, clock);
      current.game.pads.forEach((pad, index) => {
        const sum = pad.card.sum;
        const life = turning.get(index);
        // Turning over: the old face for the first half, the new one after.
        const through = life === undefined ? 1 : life / TIMING.flipSeconds;
        const showsUp = through < 0.5 ? !pad.up : pad.up;
        const face = sum === null ? 'star' : showsUp ? 'up' : 'down';
        drawPad(ctx, padRect(size, index), {
          face,
          text: sum && showsUp ? sumText(sum) : '',
          font,
          turn: life === undefined ? 1 : Math.abs(Math.cos(through * Math.PI)),
          bloom: pad.matched ? (blooming.get(index) ?? TIMING.bloomSeconds) / TIMING.bloomSeconds : 0,
          cursor: cursor === index && current.phase === 'playing',
        });
      });

      drawTopBar(ctx, { title: current.board.title, totalStars: current.totalStars });
      if (matchLine) drawMatchLine(ctx, matchLine.text, matchLine.life / TIMING.matchLineSeconds);
      if (banner) {
        drawArrivingBanner(ctx, banner.title, banner.life / TIMING.boardAnnounceSeconds, TIMING.boardSettleFraction, LAYOUT.hudY);
      }
      if (current.phase === 'cleared' || (current.phase === 'picking' && current.game.cleared)) {
        drawEndCard(ctx, {
          stars: current.earned ?? 0,
          progress: (clearedFor - TIMING.starsDelaySeconds) / TIMING.starSeconds,
          misses: current.game.misses,
          pairs: pairsOf(current.board),
          last: current.index === BOARDS.length - 1,
        });
      }
      if (current.phase === 'picking') drawPicker(ctx, { boards: BOARDS, book: current.book, open: current.open, current: current.index });

      ctx.restore();
    },

    toDesign(point, screen) {
      return fitToScreen(screen).toDesign(point);
    },

    setCursor(index) {
      cursor = index;
    },
  };
}
