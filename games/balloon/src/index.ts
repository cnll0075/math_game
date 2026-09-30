import { createTicker, DESIGN, type GameHost, type GameModule, type GameSession } from '@bundle/core';
import { createDriver, type Driver, type DriverEvent, type Phase } from './driver.js';
import type { Intent } from './intent.js';
import { feedbackLine, type Outcome } from './logic/outcome.js';
import { readBook } from './logic/progress.js';
import { solve } from './logic/solver.js';
import type { StarBook } from './logic/stars.js';
import { createBalloonSoundPack } from './audio/balloon-sounds.js';
import { createInput } from './view/input.js';
import { createScene } from './view/scene.js';
import { TIMING } from './view/timing.js';

export interface BalloonOptions {
  /** A rescue or chapter id, so `?game=balloon&level=pop-1` opens straight into Pop!. */
  startLevel?: string;
}

/** Test seam: play the game without synthesising pointer geometry. */
export interface BalloonTestHooks {
  step(frames?: number): void;
  act(intent: Intent): void;
  /** Step until the kit is back on the ground or on the ledge. */
  settle(): void;
  /** Work the sum out, let go, and land. */
  answer(): void;
  rescueId(): string;
  phase(): Phase;
  tries(): number;
  feedback(): string | null;
  stars(): StarBook;
}

export interface BalloonSession extends GameSession {
  readonly __test: BalloonTestHooks;
}

export interface BalloonModule extends GameModule<BalloonOptions> {
  mount(container: HTMLElement, host: GameHost, options?: BalloonOptions): Promise<BalloonSession>;
}

const STARS_KEY = 'stars';

/** The sound the kit makes as it leaves the ground, once the count is done. */
const liftOffSound = (outcome: Outcome): string => {
  if (outcome.verdict === 'exact' || outcome.axis === 'across') return 'float';
  return outcome.verdict === 'short' ? 'strain' : 'whoosh';
};

export const balloonGame: BalloonModule = {
  id: 'balloon',
  title: 'Balloon Rescue',

  async mount(container, host, options = {}): Promise<BalloonSession> {
    const sounds = createBalloonSoundPack(host.audio);
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
          case 'clipped':
            sounds.play('clip');
            break;
          case 'unclipped':
            sounds.play('unclip');
            break;
          case 'full':
            sounds.play('full');
            break;
          case 'popped':
            sounds.play('pop');
            break;
          case 'reinflated':
            sounds.play('reinflate');
            break;
          case 'puffed':
          case 'unpuffed':
            sounds.play('puff');
            break;
          case 'released': {
            const flight = driver.flight;
            if (!flight) break;
            const beat = flight.count / Math.max(1, flight.lifted.length);
            flight.lifted.forEach((_, step) => sounds.play('count', { delay: step * beat, step }));
            sounds.play(liftOffSound(event.outcome), { delay: flight.count });
            break;
          }
          case 'landed':
            if (event.outcome.verdict !== 'exact') sounds.play('land');
            break;
          case 'rescued':
            sounds.play('cheer');
            for (let step = 0; step < event.stars; step += 1) {
              sounds.play('star', { delay: TIMING.starsDelaySeconds + step * TIMING.starSeconds, step });
            }
            host.storage.set(STARS_KEY, event.book);
            break;
          case 'chapter':
            sounds.play('chapter');
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
      () => ({ phase: driver.phase, rescue: driver.rescue.state }),
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

    const settle = (): void => {
      for (let i = 0; i < 60 * 12 && driver.phase === 'flying'; i += 1) frame(1 / 60);
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
        settle,
        answer: () => {
          const answer = solve(driver.rescue.state.def)[0];
          if (!answer) throw new Error(`no answer to ${driver.rescue.state.def.id}`);
          answer.pop.forEach((index) => act({ kind: 'tied', index }));
          answer.clip.forEach((index) => act({ kind: 'tray', index }));
          answer.puffs.forEach((index) => act({ kind: 'puff', index }));
          act({ kind: 'letGo' });
          settle();
        },
        rescueId: () => driver.rescue.state.def.id,
        phase: () => driver.phase,
        tries: () => driver.rescue.state.tries,
        feedback: () => (driver.feedback ? feedbackLine(driver.feedback) : null),
        stars: () => driver.book,
      },
    };
  },
};

export default balloonGame;
export { createBalloonSoundPack, SOUND_EVENTS } from './audio/balloon-sounds.js';
