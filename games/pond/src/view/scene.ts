import { createRng, drawArrivingBanner, fitToScreen, visibleBounds, type Point, type Rng, type Size } from '@bundle/core';
import type { DriverEvent, SceneModel } from '../driver.js';
import type { GameEvent } from '../logic/game.js';
import { BOARDS, pairsOf } from '../logic/boards.data.js';
import { sumText } from '../logic/sums.js';
import { drawCoach, drawFrog, drawHand, drawPad, drawPond, drawSplash, lilyColour } from './art.js';
import { COACH_LINES, coachAfter, type CoachStep } from './coach.js';
import { createFrog, FROG, type FrogEvent } from './frog.js';
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
  /** The middle of the frog, or null while it is underwater. */
  frogPoint(): Point | null;
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
  const sprites: Sprites = options.sprites ?? { pond: null, pad: null, frog: null, sitting: null };
  const frog = createFrog(options.rng ?? createRng(Math.floor(Date.now() % 1_000_000)));
  const splashes: Array<{ at: Point; life: number }> = [];
  /** Each matched pad's lily colour: one colour per pair, in the order found. */
  const flowers = new Map<number, string>();
  let pairsFound = 0;
  /** The first board's coach; 'done' everywhere else. */
  let coach: CoachStep = 'done';
  /** The board the coach was last set up for: it starts afresh on every new one. */
  let coachedBoard: string | null = null;
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
      const boardOpened = events.some((event) => event.type === 'board');
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
            const colour = lilyColour(pairsFound);
            pairsFound += 1;
            flowers.set(event.a, colour);
            flowers.set(event.b, colour);
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
            flowers.clear();
            pairsFound = 0;
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
      if (!boardOpened) {
        const played = events.filter(
          (event): event is GameEvent => ['flipped', 'matched', 'missed', 'hidden', 'cleared'].includes(event.type),
        );
        coach = coachAfter(coach, played);
      }
    },

    update(dt, next) {
      model = next;
      // The coach starts over on a new board, or on a fresh deal of the first
      // board once it has finished (a replay from the picker).
      const fresh = next.game.matches === 0 && next.game.misses === 0 && !next.game.pads.some((pad) => pad.up && pad.card.sum);
      if (next.board.id !== coachedBoard || (fresh && coach === 'done')) {
        coach = next.board.size === 2 && fresh ? 'tap' : 'done';
        coachedBoard = next.board.id;
      }
      clock += dt;
      // The frog rests while the picker or the end card is up, so nothing
      // splashes behind them.
      // One frog at a time: while the coach is talking, the leaping frog stays under.
      const coaching = next.board.size === 2 && coach !== 'done';
      const frogEvents = next.phase === 'playing' && !coaching ? frog.step(dt, frogSpots(next.board.size)) : [];
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
          frog: sprites.sitting,
          flower: flowers.get(index) ?? lilyColour(0),
        });
      });

      for (const splash of splashes) drawSplash(ctx, splash.at, splash.life / SPLASH_SECONDS);
      const pose = frog.pose();
      if (pose) drawFrog(ctx, pose, sprites.frog);

      if (coach !== 'done' && current.board.size === size && size === 2 && current.phase === 'playing') {
        drawCoach(ctx, COACH_LINES[coach], sprites.sitting, clock);
        if (coach === 'tap') {
          const first = padRect(size, 0);
          drawHand(ctx, { x: first.x + first.w / 2, y: first.y }, clock);
        }
      }

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
    frogPoint: () => {
      const pose = frog.pose();
      return pose ? { x: pose.at.x, y: pose.at.y - FROG.height / 2 } : null;
    },
  };
}
