import { createTicker, type GameHost, type GameModule, type GameSession } from '@bundle/core';
import { createDriver, type Driver, type SessionEvent } from './driver.js';
import { LEVELS, getLevel, sectionOf } from './logic/levels.data.js';
import type { LevelDef } from './logic/level.js';
import type { AnimalId } from './logic/animals.js';
import type { Side, Zone } from './logic/seesaw-state.js';
import { createSynthSoundPack } from './audio/seesaw-sounds.js';
import { createScene, type SceneModel } from './view/scene.js';
import { createSpriteTheme } from './view/sprite-theme.js';
import { createInput, type InputIntent } from './view/input.js';
import { TIMING } from './view/timing.js';
import { DESIGN } from './view/layout.js';

export interface SeesawOptions {
  /** Level to open; defaults to the first unlocked level. */
  startLevel?: string;
}

/** Test seam: drive the game without synthesising pointer geometry. */
export interface SeesawTestHooks {
  place(trayIndex: number, side: Side): void;
  pick(trayIndex: number): void;
  takeBack(uid: string): void;
  step(frames?: number): void;
  status(): 'playing' | 'won';
  zone(): Zone;
  flagRaised(): boolean;
  level(): string;
  section(): string;
  danceProgress(): number;
  placedSpecies(): readonly AnimalId[];
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
    const theme = createSpriteTheme();
    const sounds = createSynthSoundPack(host.audio);
    await Promise.all([theme.preload(), sounds.preload()]);

    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;';
    container.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    const scene = createScene(theme);

    const requested = options.startLevel ? getLevel(options.startLevel) : undefined;
    let level: LevelDef = requested ?? firstUnlockedLevel(host);
    let driver: Driver = createDriver(level);

    /** Set when balance is reached; the bell waits for the plank to settle. */
    let pendingDing = false;
    let dingTimer = 0;
    let celebrating = 0;
    /** Seconds since the level was finished. */
    let finishedFor = 0;
    let announcedGoal = '';
    let announcedSection = '';

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
            sounds.play(`voice:${event.animal.species}`);
            sounds.play('land');
            sounds.play('creak');
            break;
          case 'takenBack':
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
          sounds.play(`voice:${animal.species}`, { delay: 0.2 + index * TIMING.danceStaggerSeconds });
        });
      }
    };

    const startLevel = (next: LevelDef): void => {
      level = next;
      driver = createDriver(level);
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

    /**
     * One path for every way an intention can arrive, so a tap in the browser
     * and a nudge from a test go through exactly the same code.
     */
    const handleIntent = (intent: InputIntent): void => {
      {
        void host.audio.unlock();
        switch (intent.kind) {
          case 'pickTray': {
            driver.pick(intent.index);
            // Touching an animal makes it speak. A child who cannot read the
            // number can still hear which animal they are holding.
            const held = driver.holding;
            if (held) sounds.play(`voice:${held}`);
            break;
          }
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
      }
    };

    const input = createInput(canvas, scene, handleIntent, () => driver.armed);

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
      const model = modelFor();
      scene.update(dt, model);

      // A new question arrives with a sound, so it is noticed even by a child
      // who is still looking at the animals. A new chapter gets a fanfare.
      if (model.goalToken !== announcedGoal) {
        const newSection = sectionOf(level) !== announcedSection;
        announcedGoal = model.goalToken;
        announcedSection = sectionOf(level);
        sounds.play(newSection ? 'stamp' : 'goal');
      }

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
          handleIntent({ kind: 'pickTray', index: trayIndex });
          handleIntent({ kind: 'dropSide', side });
        },
        pick: (trayIndex) => handleIntent({ kind: 'pickTray', index: trayIndex }),
        takeBack: (uid) => handleIntent({ kind: 'takeBack', uid }),
        step: (frames = 1) => {
          for (let i = 0; i < frames; i++) frame(1 / 60);
        },
        status: () => driver.status,
        zone: () => driver.snapshot().zone,
        flagRaised: () => driver.snapshot().zone === 'red',
        level: () => level.id,
        section: () => sectionOf(level),
        danceProgress: () => scene.danceProgress,
        placedSpecies: () => driver.placed().map((animal) => animal.species),
      },
    };
  },
};

export default seesawGame;
export { LEVELS, getLevel, solutionsFor } from './logic/levels.data.js';
export { createSynthSoundPack, SOUND_EVENTS } from './audio/seesaw-sounds.js';
export type { LevelDef } from './logic/level.js';
