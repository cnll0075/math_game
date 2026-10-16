import { createRng, createTicker, DESIGN, type GameHost, type GameModule, type GameSession } from '@bundle/core';
import { createDriver, type Driver, type DriverEvent, type Phase, type Summary } from './driver.js';
import type { Intent } from './intent.js';
import { chooseMove, type Policy } from './logic/bot.js';
import { QUEUE_SLOTS, type RunState } from './logic/run.js';
import { createTrainSoundPack } from './audio/train-sounds.js';
import { createInput } from './view/input.js';
import { createScene } from './view/scene.js';
import { loadSprites } from './view/sprites.js';

export interface TrainOptions {
  /** A band id, so `?game=train&level=heavy` opens a run straight into it. */
  startLevel?: string;
  /** Seeds each run in turn, for tests. */
  seed?: () => number;
}

/** Test seam: play the game without synthesising pointer geometry. */
export interface TrainTestHooks {
  step(frames?: number): void;
  act(intent: Intent): void;
  /** Let a bot load crates, at a child's pace, until the run ends or the time is up. */
  play(policy: Policy, seconds: number): void;
  phase(): Phase;
  state(): RunState;
  summary(): Summary | null;
}

export interface TrainSession extends GameSession {
  readonly __test: TrainTestHooks;
}

export interface TrainModule extends GameModule<TrainOptions> {
  mount(container: HTMLElement, host: GameHost, options?: TrainOptions): Promise<TrainSession>;
}

const BEST_KEY = 'best';

/** The crew's hammering while a train is mended, in seconds after it broke. */
const HAMMERING = [0.6, 1.0, 1.4, 2.2, 2.6, 3.0, 3.8, 4.2];

/** A bot loads one crate every this many frames: 1.2 seconds, a child's pace. */
const BOT_FRAMES = 72;

export const trainGame: TrainModule = {
  id: 'train',
  title: 'Cargo Yard',

  async mount(container, host, options = {}): Promise<TrainSession> {
    const sounds = createTrainSoundPack(host.audio);
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
      best: host.storage.get<number>(BEST_KEY, 0),
      startBand: options.startLevel,
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
          case 'start':
            sounds.play('start');
            break;
          case 'band':
            sounds.play('band');
            break;
          case 'speed':
            sounds.play('speed');
            break;
          case 'crate':
            sounds.play('crate');
            if (driver.run.state.queue.length >= QUEUE_SLOTS - 3) sounds.play('danger', { delay: 0.1 });
            break;
          case 'loaded':
            sounds.play('thunk', { step: event.crate.weight });
            break;
          case 'sent':
            sounds.play('whistle');
            if (event.bonus) sounds.play('bonus', { delay: 0.2 });
            break;
          case 'broke':
            sounds.play('crunch');
            for (const delay of HAMMERING) sounds.play('hammer', { delay });
            break;
          case 'arrived':
            if (event.star) sounds.play('horn');
            break;
          case 'starTick':
            sounds.play('tick');
            break;
          case 'over':
            sounds.play('over');
            if (driver.summary?.beatenBest) sounds.play('best', { delay: 0.6 });
            if (driver.summary) host.storage.set(BEST_KEY, driver.summary.best);
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
        if (intent.kind === 'load') sounds.play('pick');
        act(intent);
      },
      () => ({ phase: driver.phase, queue: driver.run.state.queue }),
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
      // The shell pausing (a call, the home button) pauses the yard too, so
      // nothing piles up while the child is away.
      pause: () => {
        ticker.stop();
        act({ kind: 'pause' });
      },
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
        play: (policy, seconds) => {
          const rng = createRng(1);
          for (let i = 0; i < seconds * 60 && driver.phase === 'playing'; i += 1) {
            if (i % BOT_FRAMES === BOT_FRAMES - 1) {
              const move = chooseMove(driver.run.state, policy, rng);
              if (move) act({ kind: 'load', ...move });
            }
            frame(1 / 60);
          }
        },
        phase: () => driver.phase,
        state: () => driver.run.state,
        summary: () => driver.summary,
      },
    };
  },
};

export default trainGame;
export { createTrainSoundPack, SOUND_EVENTS } from './audio/train-sounds.js';
