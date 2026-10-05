import { createRng, drawArrivingBanner, fitToScreen, visibleBounds, type Point, type Rng, type Size } from '@bundle/core';
import type { DriverEvent, SceneModel } from '../driver.js';
import { BOARDS, pairsOf } from '../logic/boards.data.js';
import { sumText } from '../logic/sums.js';
import { drawFrog, drawPad, drawPond, drawSplash } from './art.js';
import { createFrog, type FrogEvent } from './frog.js';
import { frogSpots, LAYOUT, padFont, padRect } from './geometry.js';
import type { Sprites } from './sprites.js';
import { drawEndCard, drawMatchLine, drawPicker, drawTopBar } from './hud.js';
import { TIMING } from './timing.js';

export interface Scene {
  /** Moves everything on; returns what the frog did, for the sound. */
  update(dt: number, model: SceneModel): FrogEvent[];
  /** What just happened, so the scene can react. State stays the driver's. */
  observe(events: readonly DriverEvent[]): void;
  render(ctx: CanvasRenderingContext2D, screen: Size): void;
  toDesign(point: Point, screen: Size): Point;
  /** The keyboard highlight, or null. */
  setCursor(index: number | null): void;
  /** Whether a point is on the frog while it can be tapped. */
  frogAt(point: Point): boolean;
  /** A tap on the frog: it cheers. Nothing on the board changes. */
  pokeFrog(point: Point): FrogEvent[];
  /** Where the frog sits, or null while it is underwater. */
  frogSpot(): Point | null;
}

export interface SceneOptions {
  /** The painting's pieces; anything still null is drawn instead. */
  sprites?: Sprites;
  /** For the frog's whims. */
  rng?: Rng;
}

/** How long a splash lasts. */
const SPLASH_SECONDS = 0.6;

export function createScene(options: SceneOptions = {}): Scene {
  const sprites: Sprites = options.sprites ?? { pond: null, pad: null, frog: null };
  const frog = createFrog(options.rng ?? createRng(Math.floor(Date.now() % 1_000_000)));
  const splashes: Array<{ at: Point; life: number }> = [];
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
            // The pads are about to move under the frog: it goes under.
            frog.scatter();
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
      const frogEvents = frog.step(dt, frogSpots(next.board.size));
      for (const event of frogEvents) {
        if (event.type === 'emerged' || event.type === 'dived') splashes.push({ at: event.at, life: 0 });
      }
      for (const splash of splashes) splash.life += dt;
      while (splashes.length > 0 && splashes[0]!.life > SPLASH_SECONDS) splashes.shift();
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
      return frogEvents;
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

      drawPond(ctx, bounds, clock, sprites.pond);
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
          image: sprites.pad,
        });
      });

      for (const splash of splashes) drawSplash(ctx, splash.at, splash.life / SPLASH_SECONDS);
      const pose = frog.pose();
      if (pose) drawFrog(ctx, pose, sprites.frog);

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

    frogAt: (point) => frog.hit(point),
    pokeFrog: (point) => frog.tap(point),
    frogSpot: () => (frog.phase === 'hidden' ? null : frog.spot),
  };
}
