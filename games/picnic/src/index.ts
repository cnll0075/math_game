import { createTicker, DESIGN, type GameHost, type GameModule, type GameSession } from '@bundle/core';
import { createDriver, type Driver, type DriverEvent, type Phase } from './driver.js';
import type { Intent } from './intent.js';
import { playRound, type Policy } from './logic/bot.js';
import { readBook } from './logic/progress.js';
import type { StarBook } from './logic/stars.js';
import { courseOf, type TableState } from './logic/table.js';
import { createPicnicSoundPack } from './audio/picnic-sounds.js';
import { createInput } from './view/input.js';
import { createScene } from './view/scene.js';
import { loadSprites } from './view/sprites.js';
import { TIMING } from './view/timing.js';

export interface PicnicOptions {
  /** A round id, so `?game=picnic&level=cake-quarters` opens straight onto it. */
  startLevel?: string;
}

/** Test seam: play the game without synthesising pointer geometry. */
export interface PicnicTestHooks {
  step(frames?: number): void;
  act(intent: Intent): void;
  /** Let a player finish the round on the table. */
  play(policy?: Policy): void;
  /** Step until a tap would move on. */
  settle(): void;
  levelId(): string;
  phase(): Phase;
  table(): TableState;
  stars(): StarBook;
}

export interface PicnicSession extends GameSession {
  readonly __test: PicnicTestHooks;
}

export interface PicnicModule extends GameModule<PicnicOptions> {
  mount(container: HTMLElement, host: GameHost, options?: PicnicOptions): Promise<PicnicSession>;
}

const STARS_KEY = 'stars';

/** Treats land on plates about this long after a share is pressed, for the pops. */
const LAND_SECONDS = 0.4;

export const picnicGame: PicnicModule = {
  id: 'picnic',
  title: 'Picnic Pals',

  async mount(container, host, options = {}): Promise<PicnicSession> {
    const sounds = createPicnicSoundPack(host.audio);
    const { sprites, ready } = loadSprites();
    // A moment for the pictures to arrive; the game starts either way, with
    // drawn shapes standing in until they do.
    await Promise.all([sounds.preload(), Promise.race([ready, new Promise((resolve) => setTimeout(resolve, 250))])]);

    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;';
    container.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    const scene = createScene(sprites);
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
          case 'level':
            sounds.play('level');
            break;
          case 'gave':
            sounds.play('pop', { delay: LAND_SECONDS, step: driver.table.state.plates[event.plate] ?? 0 });
            break;
          case 'shared':
            sounds.play('whoosh');
            for (let one = 0; one < event.each; one += 1) sounds.play('pop', { delay: LAND_SECONDS + one * 0.08, step: one });
            break;
          case 'refused':
          case 'short':
          case 'unseated':
            sounds.play('nope');
            break;
          case 'leftover':
            sounds.play('woof', { delay: 0.5 });
            break;
          case 'cut':
            sounds.play(event.ok ? 'chop' : 'nope');
            break;
          case 'course':
            sounds.play('munch', { delay: LAND_SECONDS });
            break;
          case 'won':
            sounds.play('cheer', { delay: LAND_SECONDS });
            for (let step = 0; step < event.stars; step += 1) {
              sounds.play('star', { delay: TIMING.cardDelaySeconds + 0.4 + step * TIMING.starSeconds, step });
            }
            host.storage.set(STARS_KEY, event.book);
            break;
          case 'finished':
            sounds.play('cheer');
            break;
          default:
            break;
        }
      }
    };

    const act = (intent: Intent): void => {
      const events = driver.act(intent);
      scene.observe(events);
      handleEvents(events);
    };

    const input = createInput(
      canvas,
      scene,
      (intent) => {
        void host.audio.unlock();
        act(intent);
      },
      () => {
        const state = driver.table.state;
        const course = courseOf(state);
        return { phase: driver.phase, table: state.phase, seated: state.seated.length, food: course.kind === 'cut' ? course.food : null };
      },
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
      scene.observe(events);
      handleEvents(events);
      scene.update(dt, driver.model());
      if (ctx) scene.render(ctx, { width: canvas.width, height: canvas.height });
    };

    const ticker = createTicker(frame);
    ticker.start();

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
        play: (policy = 'best') => {
          // As a child would: the round's title first, then sharing, with each
          // move seen by the scene and heard.
          for (let i = 0; i < 60 * 5 && driver.phase === 'intro'; i += 1) frame(1 / 60);
          const table = driver.table;
          const recorder = {
            get state() {
              return table.state;
            },
            tap: (plate: number) => (act({ kind: 'tap', plate }), []),
            turnDial: (step: 1 | -1) => (act({ kind: 'dial', step }), []),
            share: () => (act({ kind: 'share' }), []),
            cut: (from: { x: number; y: number }, to: { x: number; y: number }) => (act({ kind: 'cut', from, to }), []),
            nextCourse: () => {
              for (let i = 0; i < 60 * 5 && table.state.phase === 'between'; i += 1) frame(1 / 60);
              return [];
            },
          };
          playRound(recorder, policy);
          frame(1 / 60);
        },
        settle: () => {
          for (let i = 0; i < 60 * 10 && !driver.readyForNext; i += 1) frame(1 / 60);
        },
        levelId: () => driver.table.state.def.id,
        phase: () => driver.phase,
        table: () => driver.table.state,
        stars: () => driver.book,
      },
    };
  },
};

export default picnicGame;
export { createPicnicSoundPack, SOUND_EVENTS } from './audio/picnic-sounds.js';
