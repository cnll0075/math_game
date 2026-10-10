import { createTicker, DESIGN, type GameHost, type GameModule, type GameSession } from '@bundle/core';
import { createDriver, type Driver, type DriverEvent, type Phase } from './driver.js';
import type { Intent } from './intent.js';
import { botTurn, type Policy } from './logic/bot.js';
import { readBook } from './logic/progress.js';
import type { ItemId } from './logic/species.js';
import type { StarBook } from './logic/stars.js';
import type { WorldState } from './logic/world.js';
import { createFishingSoundPack } from './audio/fishing-sounds.js';
import { createInput } from './view/input.js';
import { createScene, FLY_SECONDS } from './view/scene.js';
import { loadSprites } from './view/sprites.js';
import { TIMING } from './view/timing.js';

export interface FishingOptions {
  /** A level id, so `?game=fishing&level=jellyfish` opens straight onto it. */
  startLevel?: string;
  /** Seeds each pond in turn, for tests. */
  seed?: () => number;
}

/** Test seam: play the game without synthesising pointer geometry. */
export interface FishingTestHooks {
  step(frames?: number): void;
  act(intent: Intent): void;
  /** Let a bot fish until the level ends one way or another. */
  play(policy?: Policy): void;
  /** Step until a tap would move on. */
  settle(): void;
  levelId(): string;
  phase(): Phase;
  state(): WorldState;
  stars(): StarBook;
}

export interface FishingSession extends GameSession {
  readonly __test: FishingTestHooks;
}

export interface FishingModule extends GameModule<FishingOptions> {
  mount(container: HTMLElement, host: GameHost, options?: FishingOptions): Promise<FishingSession>;
}

const STARS_KEY = 'stars';

const ITEM_SOUNDS: Record<ItemId, string> = {
  'speed-potion': 'speed',
  'health-potion': 'health',
  net: 'item',
  'bonus-time': 'bonus',
  treasure: 'treasure',
};

export const fishingGame: FishingModule = {
  id: 'fishing',
  title: 'Bucket Bay',

  async mount(container, host, options = {}): Promise<FishingSession> {
    const sounds = createFishingSoundPack(host.audio);
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
      seed: options.seed,
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
          case 'cast':
            sounds.play('cast');
            sounds.play('plop', { delay: 0.12 });
            break;
          case 'hooked':
            sounds.play('hooked', { step: event.weight });
            break;
          case 'empty':
            sounds.play('empty');
            break;
          case 'reel':
            sounds.play('reel', { step: event.weight });
            break;
          case 'caught':
            sounds.play('caught', { delay: FLY_SECONDS * 0.9, step: event.weight });
            break;
          case 'item':
            sounds.play(ITEM_SOUNDS[event.item]);
            break;
          case 'saved':
            sounds.play('saved');
            break;
          case 'full':
            sounds.play('full', { delay: FLY_SECONDS });
            break;
          case 'won':
            for (let step = 0; step < event.stars; step += 1) {
              sounds.play('star', { delay: FLY_SECONDS + TIMING.starsDelaySeconds + step * TIMING.starSeconds, step });
            }
            host.storage.set(STARS_KEY, event.book);
            break;
          case 'capsized':
            sounds.play('capsize', { delay: FLY_SECONDS });
            break;
          case 'timeout':
            sounds.play('timeout');
            break;
          case 'stuck':
            sounds.play('stuck', { delay: FLY_SECONDS });
            break;
          case 'tick':
            sounds.play('tick');
            break;
          case 'finished':
            sounds.play('full');
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
      () => ({ phase: driver.phase, boatX: driver.world.state.boat.x, swing: driver.world.state.boat.swing }),
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
      // The scene sees a catch before the world moves on, so it knows where it came from.
      scene.observe(events);
      handleEvents(events);
      scene.update(dt, driver.model());
      if (ctx) scene.render(ctx, { width: canvas.width, height: canvas.height });
    };

    const ticker = createTicker(frame);
    ticker.start();

    const playing = (): boolean => driver.phase === 'intro' || driver.phase === 'fishing';

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
        play: (policy = 'biggest') => {
          for (let i = 0; i < 60 * 300 && playing(); i += 1) {
            if (driver.phase === 'fishing') botTurn(driver.world, policy);
            frame(1 / 60);
          }
        },
        settle: () => {
          for (let i = 0; i < 60 * 10 && !driver.readyForNext; i += 1) frame(1 / 60);
        },
        levelId: () => driver.world.state.def.id,
        phase: () => driver.phase,
        state: () => driver.world.state,
        stars: () => driver.book,
      },
    };
  },
};

export default fishingGame;
export { createFishingSoundPack, SOUND_EVENTS } from './audio/fishing-sounds.js';
