import { createTicker, type GameHost, type GameModule, type GameSession } from '@bundle/core';
import { createDriver, type Driver, type SessionEvent } from './driver.js';
import { LEVELS, getLevel } from './logic/levels.data.js';
import type { LevelDef } from './logic/level.js';
import type { Side, Zone } from './logic/seesaw-state.js';
import type { AnimalId } from './logic/animals.js';
import { createSynthSoundPack } from './audio/seesaw-sounds.js';
import { createScene, type SceneModel } from './view/scene.js';
import { createVectorTheme } from './view/vector-theme.js';
import { createInput } from './view/input.js';
import { TIMING } from './view/timing.js';
import { DESIGN } from './view/layout.js';

export interface SeesawOptions {
  /** Level to open; defaults to the first unlocked level. */
  startLevel?: string;
}

/** Test seam: drive the game without synthesising pointer geometry. */
export interface SeesawTestHooks {
  place(trayIndex: number, side: Side): void;
  drop(side: Side): void;
  takeBack(uid: string): void;
  step(frames?: number): void;
  status(): 'playing' | 'won' | 'lost';
  zone(): Zone;
  flagRaised(): boolean;
  level(): string;
  danceProgress(): number;
  danger(): number;
  queueLength(): number;
  queue(): readonly AnimalId[];
  balanceDifference(): number;
  survivalSeconds(): number | null;
  bestSeconds(): number | null;
  windPhase(): 'calm' | 'warning' | 'blowing';
}

export interface SeesawSession extends GameSession {
  readonly __test: SeesawTestHooks;
}

const contentIdFor = (levelId: string): string => `seesaw:${levelId}`;

const firstUnlockedLevel = (host: GameHost): LevelDef => {
  const unlocked = LEVELS.find((level) => host.content.isUnlocked(contentIdFor(level.id)));
  return unlocked ?? LEVELS[0]!;
};

/** Narrows `mount` to the seesaw's own session type, test hooks included. */
export interface SeesawModule extends GameModule<SeesawOptions> {
  mount(container: HTMLElement, host: GameHost, options?: SeesawOptions): Promise<SeesawSession>;
}

export const seesawGame: SeesawModule = {
  id: 'seesaw',
  title: 'Seesaw Park',

  async mount(container, host, options = {}): Promise<SeesawSession> {
    const theme = createVectorTheme();
    const sounds = createSynthSoundPack(host.audio);
    await Promise.all([theme.preload(), sounds.preload()]);

    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;';
    container.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    const scene = createScene(theme);

    const bestKey = (levelId: string): string => `best:${levelId}`;
    const bestFor = (levelId: string): number | null => {
      const stored = host.storage.get<number>(bestKey(levelId), 0);
      return stored > 0 ? stored : null;
    };

    const requested = options.startLevel ? getLevel(options.startLevel) : undefined;
    let level: LevelDef = requested ?? firstUnlockedLevel(host);
    let driver: Driver = createDriver(level, bestFor(level.id));

    /** Set when balance is reached; the bell waits for the plank to settle. */
    let pendingDing = false;
    let dingTimer = 0;
    let celebrating = 0;
    /** Seconds since the round finished, won or lost. */
    let finishedFor = 0;

    const applySettings = (): void => {
      host.audio.muted = host.settings.values.muted;
      host.audio.volume = host.settings.values.volume;
    };
    applySettings();
    const unsubscribeSettings = host.settings.subscribe(applySettings);

    const modelFor = (): SceneModel => ({
      ...driver.model(),
      snapshot: driver.snapshot(),
      placed: driver.placed(),
      celebrating: celebrating > 0,
      dancing: driver.status === 'won',
    });

    const handleEvents = (events: readonly SessionEvent[]): void => {
      for (const event of events) {
        switch (event.type) {
          case 'placed':
            sounds.play(`chirp:${event.animal.species}`);
            sounds.play('land');
            sounds.play('creak');
            break;
          case 'takenBack':
          case 'left':
            sounds.play('creak');
            break;
          case 'perfectBalance':
            // Held until the plank stops moving: land, creak, settle, DING.
            pendingDing = true;
            dingTimer = 0;
            break;
          case 'zoneChanged':
            if (event.to === 'red') sounds.play('danger');
            break;
          case 'windChanged':
            // The warning is the sound that matters: it is the beat of notice
            // the child gets before the push arrives.
            if (event.phase === 'warning') sounds.play('gust');
            break;
          default:
            break;
        }
      }

      if (events.some((event) => event.type === 'levelCleared')) {
        finishedFor = 0;
        sounds.play('success');
        sounds.play('cheer', { delay: 0.12 });
        // One chirp per dancer, in the same wave the hops run in.
        driver.placed().forEach((animal, index) => {
          sounds.play(`chirp:${animal.species}`, { delay: 0.2 + index * TIMING.danceStaggerSeconds });
        });
      }
      if (events.some((event) => event.type === 'roundLost')) {
        finishedFor = 0;
        pendingDing = false;
        sounds.play('tumble');
        // An endless run is only worth anything if the best is remembered.
        const stats = driver.stats();
        if (stats && driver.model().survivalSeconds !== null) {
          const best = host.storage.get<number>(bestKey(level.id), 0);
          if (stats.secondsSurvived > best) {
            host.storage.set(bestKey(level.id), Math.floor(stats.secondsSurvived));
          }
        }
      }
    };

    const startLevel = (next: LevelDef): void => {
      level = next;
      driver = createDriver(level, bestFor(next.id));
      finishedFor = 0;
      celebrating = 0;
      pendingDing = false;
      host.storage.set('lastLevel', level.id);
    };

    const advanceLevel = (): void => {
      const index = LEVELS.findIndex((entry) => entry.id === level.id);
      const next = LEVELS[index + 1];
      if (!next || !host.content.isUnlocked(contentIdFor(next.id))) {
        host.exit();
        return;
      }
      startLevel(next);
    };

    const input = createInput(
      canvas,
      scene,
      (intent) => {
        void host.audio.unlock();
        switch (intent.kind) {
          case 'pickTray':
            driver.pick(intent.index);
            break;
          case 'dropSide':
            handleEvents(driver.drop(intent.side));
            break;
          case 'takeBack':
            handleEvents(driver.takeBack(intent.uid));
            break;
          case 'clearSelection':
            driver.pick(-1);
            break;
        }
      },
      () => driver.armed,
    );

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
      if (driver.status === 'playing') handleEvents(driver.tick(dt));

      scene.update(dt, modelFor());

      if (pendingDing && scene.tiltSettled) {
        dingTimer += dt;
        if (dingTimer >= TIMING.dingDelaySeconds) {
          sounds.play('ding');
          pendingDing = false;
          celebrating = TIMING.celebrateSeconds;
        }
      }
      if (celebrating > 0) celebrating = Math.max(0, celebrating - dt);

      if (driver.status === 'won') {
        finishedFor += dt;
        // Let the animals finish dancing before the next level arrives.
        if (finishedFor > TIMING.danceSeconds + TIMING.levelChangeSeconds) advanceLevel();
      } else if (driver.status === 'lost') {
        finishedFor += dt;
        // A lost round simply starts again: the point is another go, not a
        // verdict on the child.
        if (finishedFor > TIMING.retrySeconds) startLevel(level);
      }

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
        place(trayIndex, side) {
          driver.pick(trayIndex);
          handleEvents(driver.drop(side));
        },
        drop: (side) => handleEvents(driver.drop(side)),
        takeBack: (uid) => handleEvents(driver.takeBack(uid)),
        step: (frames = 1) => {
          for (let i = 0; i < frames; i++) frame(1 / 60);
        },
        status: () => driver.status,
        zone: () => driver.snapshot().zone,
        flagRaised: () => driver.snapshot().zone === 'red',
        level: () => level.id,
        danceProgress: () => scene.danceProgress,
        danger: () => driver.model().danger,
        queueLength: () => driver.model().queue.length,
        queue: () => driver.model().queue,
        balanceDifference: () => driver.snapshot().balanceDifference,
        survivalSeconds: () => driver.model().survivalSeconds,
        bestSeconds: () => driver.model().bestSeconds,
        windPhase: () => driver.model().wind.phase,
      },
    };
  },
};

export default seesawGame;
export { LEVELS, PUZZLE_LEVELS, ARCADE_LEVELS, getLevel, solutionsFor } from './logic/levels.data.js';
export { createSynthSoundPack, SOUND_EVENTS } from './audio/seesaw-sounds.js';
export type { LevelDef, PuzzleLevelDef, ArcadeLevelDef } from './logic/level.js';
