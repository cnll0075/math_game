import { createTicker, DESIGN, type GameHost, type GameModule, type GameSession } from '@bundle/core';
import type { BandId } from '@bundle/math';
import { createDriver, type Driver } from './driver.js';
import { laneAt, laneCentre, LANES } from './logic/lanes.js';
import { currentRow, type RunEvent } from './logic/run.js';
import { createBrambleSoundPack } from './audio/bramble-sounds.js';
import { createScene } from './view/scene.js';
import { createInput, type InputIntent } from './view/input.js';
import { TIMING } from './view/timing.js';

export interface BrambleOptions {
  /** A band id, so `?game=bramble&level=take-aways` opens straight into subtraction. */
  startLevel?: string;
}

/** Test seam: play the game without synthesising pointer geometry. */
export interface BrambleTestHooks {
  step(frames?: number): void;
  steer(x: number): void;
  /** Run into the lane wearing the answer, and meet the row. */
  takeRightLane(): void;
  /** Run into a lane that is not the answer, and meet the row. */
  takeWrongLane(): void;
  sum(): string;
  health(): number;
  score(): number;
  band(): BandId;
  status(): 'running' | 'over';
  restart(): void;
}

export interface BrambleSession extends GameSession {
  readonly __test: BrambleTestHooks;
}

export interface BrambleModule extends GameModule<BrambleOptions> {
  mount(container: HTMLElement, host: GameHost, options?: BrambleOptions): Promise<BrambleSession>;
}

export const brambleGame: BrambleModule = {
  id: 'bramble',
  title: 'Bramble Dash',

  async mount(container, host, options = {}): Promise<BrambleSession> {
    const sounds = createBrambleSoundPack(host.audio);
    await sounds.preload();

    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;';
    container.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    const scene = createScene();
    const best = host.storage.get('best', 0);
    const driver: Driver = createDriver({ best, startBand: options.startLevel });

    /** Set when the run ends, so the card waits for the last fuel to be seen. */
    let endingFor: number | null = null;
    /** The lane the rabbit was in last frame, so a change can make a sound. */
    let lastLane = laneAt(driver.state.rabbitX);

    const applySettings = (): void => {
      host.audio.muted = host.settings.values.muted;
      host.audio.volume = host.settings.values.volume;
    };
    applySettings();
    const unsubscribeSettings = host.settings.subscribe(applySettings);

    const handleEvents = (events: readonly RunEvent[]): void => {
      for (const event of events) {
        switch (event.type) {
          case 'burst':
            sounds.play('burst');
            break;
          case 'thump':
            sounds.play('thump');
            break;
          case 'berry':
            sounds.play('berry');
            break;
          case 'band':
            sounds.play('band');
            break;
          case 'ended':
            endingFor = 0;
            sounds.play('over');
            if (driver.summary?.beatenBest) sounds.play('best', { delay: 0.5 });
            host.storage.set('best', Math.max(best, event.score));
            break;
          default:
            break;
        }
      }
    };

    const handleIntent = (intent: InputIntent): void => {
      void host.audio.unlock();
      if (intent.kind === 'steer') driver.steer(intent.x);
      else {
        driver.restart();
        endingFor = null;
      }
    };

    const input = createInput(canvas, scene, handleIntent, () => driver.state.status === 'over');

    const resize = (): void => {
      const ratio = Math.min(globalThis.devicePixelRatio || 1, 3);
      const width = canvas.clientWidth || DESIGN.width;
      const height = canvas.clientHeight || DESIGN.height;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
    };
    resize();
    globalThis.addEventListener?.('resize', resize);

    const frame = (dt: number): void => {
      const events = driver.step(dt);
      handleEvents(events);
      scene.observe(events);

      // A soft note each time the rabbit crosses into another lane, so steering
      // has a sound of its own.
      const lane = laneAt(driver.state.rabbitX);
      if (lane !== lastLane) {
        lastLane = lane;
        sounds.play('hop');
      }

      if (endingFor !== null) endingFor += dt;
      const showCard = endingFor !== null && endingFor >= TIMING.summaryDelaySeconds;
      scene.update(dt, { ...driver.model(), summary: showCard ? driver.summary : null });
      if (ctx) scene.render(ctx, { width: canvas.width, height: canvas.height });
    };

    const ticker = createTicker(frame);
    ticker.start();

    /** Steers into a lane and runs until the row there is met. */
    const meetRow = (lane: (answerLane: number) => number): void => {
      for (let i = 0; i < 60 * 40; i += 1) {
        const row = currentRow(driver.state);
        if (!row) {
          frame(1 / 60);
          continue;
        }
        driver.steer(laneCentre(lane(row.answerLane)));
        const events = driver.step(1 / 60);
        handleEvents(events);
        scene.observe(events);
        scene.update(1 / 60, driver.model());
        if (events.some((event) => event.type === 'burst' || event.type === 'thump')) return;
      }
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
        steer: (x) => driver.steer(x),
        takeRightLane: () => meetRow((answerLane) => answerLane),
        takeWrongLane: () => meetRow((answerLane) => (answerLane + 1) % LANES),
        sum: () => driver.model().sumText,
        health: () => driver.state.health,
        score: () => driver.state.score,
        band: () => driver.state.band.id,
        status: () => driver.state.status,
        restart: () => driver.restart(),
      },
    };
  },
};

export default brambleGame;
export { LANES, laneCentre } from './logic/lanes.js';
export { createBrambleSoundPack, SOUND_EVENTS } from './audio/bramble-sounds.js';
