import { createTicker, DESIGN, type GameHost, type GameModule, type GameSession } from '@bundle/core';
import { createDriver, type Driver, type DriverEvent, type Phase } from './driver.js';
import type { Intent } from './intent.js';
import { valueAt, type GameState } from './logic/game.js';
import { readBook } from './logic/progress.js';
import type { StarBook } from './logic/stars.js';
import { createPondSoundPack } from './audio/pond-sounds.js';
import { createInput } from './view/input.js';
import { createScene } from './view/scene.js';
import { TIMING } from './view/timing.js';

export interface PondOptions {
  /** A board id, so `?game=pond&level=board-5` opens straight onto the 5×5 board. */
  startLevel?: string;
}

/** Test seam: play the game without synthesising pointer geometry. */
export interface PondTestHooks {
  step(frames?: number): void;
  act(intent: Intent): void;
  flip(index: number): void;
  /** Two face-down pads that are equal (or not). */
  pair(equal: boolean): [number, number];
  /** Clear the board, matching every pair. */
  solve(): void;
  /** Wait out the stars, and move to the next board. */
  next(): void;
  boardId(): string;
  phase(): Phase;
  state(): GameState;
  stars(): StarBook;
}

export interface PondSession extends GameSession {
  readonly __test: PondTestHooks;
}

export interface PondModule extends GameModule<PondOptions> {
  mount(container: HTMLElement, host: GameHost, options?: PondOptions): Promise<PondSession>;
}

const STARS_KEY = 'stars';

export const pondGame: PondModule = {
  id: 'pond',
  title: 'Pond Pairs',

  async mount(container, host, options = {}): Promise<PondSession> {
    const sounds = createPondSoundPack(host.audio);
    await sounds.preload();

    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;';
    container.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    const scene = createScene();
    const driver: Driver = createDriver({
      book: readBook(host.storage.get<unknown>(STARS_KEY, {})),
      startLevel: options.startLevel,
    });

    const applySettings = (): void => {
      host.audio.muted = host.settings.values.muted;
      host.audio.volume = host.settings.values.volume;
    };
    applySettings();
    const unsubscribeSettings = host.settings.subscribe(applySettings);

    const handleEvents = (events: readonly DriverEvent[]): void => {
      for (const event of events) {
        switch (event.type) {
          case 'flipped':
            sounds.play('flip');
            break;
          case 'matched':
            sounds.play('match');
            break;
          case 'missed':
            sounds.play('miss', { delay: 0.15 });
            break;
          case 'scored':
            sounds.play('cleared');
            for (let step = 0; step < event.stars; step += 1) {
              sounds.play('star', { delay: TIMING.starsDelaySeconds + step * TIMING.starSeconds, step });
            }
            host.storage.set(STARS_KEY, event.book);
            break;
          case 'board':
            sounds.play('board');
            break;
          case 'picker':
            sounds.play('pick');
            break;
          default:
            break;
        }
      }
    };

    const act = (intent: Intent): void => {
      const events = driver.act(intent);
      handleEvents(events);
      scene.observe(events);
    };

    const input = createInput(
      canvas,
      scene,
      (intent) => {
        void host.audio.unlock();
        act(intent);
      },
      () => ({ phase: driver.phase, size: driver.model().board.size }),
    );

    const resize = (): void => {
      const ratio = Math.min(globalThis.devicePixelRatio || 1, 3);
      canvas.width = Math.round((canvas.clientWidth || DESIGN.width) * ratio);
      canvas.height = Math.round((canvas.clientHeight || DESIGN.height) * ratio);
    };
    resize();
    globalThis.addEventListener?.('resize', resize);

    const frame = (dt: number): void => {
      const events = driver.step(dt);
      handleEvents(events);
      scene.observe(events);
      scene.update(dt, driver.model());
      if (ctx) scene.render(ctx, { width: canvas.width, height: canvas.height });
    };

    const ticker = createTicker(frame);
    ticker.start();

    const pair = (equal: boolean): [number, number] => {
      const state = driver.game.state;
      for (let a = 0; a < state.pads.length; a += 1) {
        for (let b = a + 1; b < state.pads.length; b += 1) {
          if (state.pads[a]!.up || state.pads[b]!.up) continue;
          if ((valueAt(state, a) === valueAt(state, b)) === equal) return [a, b];
        }
      }
      throw new Error(`no ${equal ? 'equal' : 'unequal'} pair left`);
    };

    return {
      pause: () => ticker.stop(),
      resume: () => ticker.start(),
      unmount() {
        ticker.stop();
        input.dispose();
        unsubscribeSettings();
        globalThis.removeEventListener?.('resize', resize);
        canvas.remove();
      },
      __test: {
        step: (frames = 1) => {
          for (let i = 0; i < frames; i += 1) frame(1 / 60);
        },
        act,
        flip: (index) => act({ kind: 'flip', index }),
        pair,
        solve: () => {
          while (!driver.game.state.cleared) {
            const [a, b] = pair(true);
            act({ kind: 'flip', index: a });
            act({ kind: 'flip', index: b });
          }
        },
        next: () => {
          for (let i = 0; i < 60 * 5 && !driver.readyForNext; i += 1) frame(1 / 60);
          act({ kind: 'next' });
        },
        boardId: () => driver.model().board.id,
        phase: () => driver.phase,
        state: () => driver.game.state,
        stars: () => driver.book,
      },
    };
  },
};

export default pondGame;
export { createPondSoundPack, SOUND_EVENTS } from './audio/pond-sounds.js';
