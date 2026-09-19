import { createTicker, DESIGN, type GameHost, type GameModule, type GameSession } from '@bundle/core';
import { createDriver, type Driver } from './driver.js';
import type { BandId } from './logic/bands.data.js';
import type { RunEvent } from './logic/run.js';
import { planeX, struck, type Plane } from './logic/sky-state.js';
import { createSkySoundPack } from './audio/sky-sounds.js';
import { createScene } from './view/scene.js';
import { createInput, type InputIntent } from './view/input.js';
import { TIMING } from './view/timing.js';

export interface SkyOptions {
  /** A band id, so `?game=sky&level=take-aways` opens straight into subtraction. */
  startLevel?: string;
}

/** Test seam: play the game without synthesising pointer geometry. */
export interface SkyTestHooks {
  step(frames?: number): void;
  aim(lane: number): void;
  fire(): void;
  /** Line up under the plane wearing the answer and shoot it down. */
  shootAnswer(): void;
  /** Line up under a plane that is not the answer and shoot it. */
  shootWrong(): void;
  sum(): string;
  answer(): number | null;
  numbers(): readonly number[];
  hearts(): number;
  score(): number;
  band(): BandId;
  status(): 'flying' | 'over';
  jammed(): boolean;
  restart(): void;
}

export interface SkySession extends GameSession {
  readonly __test: SkyTestHooks;
}

export interface SkyModule extends GameModule<SkyOptions> {
  mount(container: HTMLElement, host: GameHost, options?: SkyOptions): Promise<SkySession>;
}

export const skyGame: SkyModule = {
  id: 'sky',
  title: 'Sky Patrol',

  async mount(container, host, options = {}): Promise<SkySession> {
    const sounds = createSkySoundPack(host.audio);
    await sounds.preload();

    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;';
    container.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    const scene = createScene();
    const best = host.storage.get('best', 0);
    const driver: Driver = createDriver({ best, startBand: options.startLevel });

    /** Set when the run ends, so the card waits for the last heart to be seen. */
    let endingFor: number | null = null;

    const applySettings = (): void => {
      host.audio.muted = host.settings.values.muted;
      host.audio.volume = host.settings.values.volume;
    };
    applySettings();
    const unsubscribeSettings = host.settings.subscribe(applySettings);

    const handleEvents = (events: readonly RunEvent[]): void => {
      for (const event of events) {
        switch (event.type) {
          case 'destroyed':
            sounds.play('destroy');
            break;
          case 'damaged':
            sounds.play('damage');
            break;
          case 'jammed':
            sounds.play('jam');
            break;
          case 'escaped':
            sounds.play('escape');
            sounds.play('heart', { delay: 0.1 });
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
      switch (intent.kind) {
        case 'aim':
          driver.aim(intent.lane);
          break;
        case 'fire':
          if (driver.state.jam <= 0) sounds.play('fire');
          driver.fire();
          break;
        case 'restart':
          driver.restart();
          endingFor = null;
          break;
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
      if (endingFor !== null) endingFor += dt;
      // The card waits a beat, so the last heart is seen to go.
      const showCard = endingFor !== null && endingFor >= TIMING.summaryDelaySeconds;
      scene.update(dt, { ...driver.model(), summary: showCard ? driver.summary : null });
      if (ctx) scene.render(ctx, { width: canvas.width, height: canvas.height });
    };

    const ticker = createTicker(frame);
    ticker.start();

    /** The plane the question is about, for the test hooks. */
    const target = () => driver.state.aloft.find((plane) => plane.uid === driver.state.targetUid);

    /** Is anything flying between the fighter's column and this plane? */
    const blocked = (chosen: Plane): boolean =>
      driver.state.aloft.some(
        (plane) =>
          plane.uid !== chosen.uid &&
          plane.progress > chosen.progress &&
          struck(plane, planeX(chosen), plane.progress),
      );

    /**
     * Shoots a plane down the way someone who means it would: line up, wait for
     * a clear shot, one shell at a time. `stopOnJam` is for the hook that means
     * to hit the wrong plane, where the jam is the whole point.
     */
    const shootUntilGone = (uid: string, stopOnJam = false): void => {
      for (let i = 0; i < 900; i += 1) {
        const plane = driver.state.aloft.find((entry) => entry.uid === uid);
        if (!plane) return;
        driver.aim(planeX(plane));
        const lined = Math.abs(driver.state.fighterX - planeX(plane)) < 0.01;
        const idle = driver.state.bullets.length === 0 && driver.state.pendingFire === 0;
        if (lined && idle && (stopOnJam || !blocked(plane))) driver.fire();
        const events = driver.step(1 / 60);
        handleEvents(events);
        scene.observe(events);
        if (stopOnJam && events.some((event) => event.type === 'jammed')) return;
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
        aim: (lane) => driver.aim(lane),
        fire: () => driver.fire(),
        shootAnswer() {
          const chosen = target();
          if (chosen) shootUntilGone(chosen.uid);
        },
        shootWrong() {
          const wrong = driver.state.aloft.find((plane) => plane.number !== driver.state.sum?.answer);
          if (wrong) shootUntilGone(wrong.uid, true);
        },
        sum: () => driver.model().sumText,
        answer: () => driver.state.sum?.answer ?? null,
        numbers: () => driver.state.aloft.map((plane) => plane.number),
        hearts: () => driver.state.hearts,
        score: () => driver.state.score,
        band: () => driver.state.band.id,
        status: () => driver.state.status,
        jammed: () => driver.state.jam > 0,
        restart: () => driver.restart(),
      },
    };
  },
};

export default skyGame;
export { BANDS, bandAt, bandById, type Band, type BandId } from './logic/bands.data.js';
export { PLANE_TYPES, PLANE_IDS, type PlaneTypeId } from './logic/planes.js';
export { createSkySoundPack, SOUND_EVENTS } from './audio/sky-sounds.js';
