import { createTicker, type GameHost, type GameModule, type GameSession } from '@bundle/core';
import { createGame, type Game, type GameEvent } from './logic/game.js';
import { LEVELS, getLevel } from './logic/levels.data.js';
import { balanceConfigFor, type LevelDef } from './logic/level.js';
import { currentChallenge, describeObjective, stageCount } from './logic/objectives.js';
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
  place(trayIndex: number, side: 'left' | 'right'): void;
  takeBack(uid: string): void;
  step(frames?: number): void;
  status(): 'playing' | 'won';
  zone(): 'green' | 'yellow' | 'red';
  flagRaised(): boolean;
  level(): string;
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

    const requested = options.startLevel ? getLevel(options.startLevel) : undefined;
    let level: LevelDef = requested ?? firstUnlockedLevel(host);
    let game: Game = createGame(level);
    let selectedTrayIndex: number | null = null;

    /** Set when balance is reached; the bell waits for the plank to settle. */
    let pendingDing = false;
    let dingTimer = 0;
    let celebrating = 0;
    let wonFor = 0;

    const applySettings = (): void => {
      host.audio.muted = host.settings.values.muted;
      host.audio.volume = host.settings.values.volume;
    };
    applySettings();
    const unsubscribeSettings = host.settings.subscribe(applySettings);

    const targetBalanceFor = (): number | null => {
      const challenge = currentChallenge(level.objective, game.state.stage);
      if (challenge.kind !== 'tilt') return null;
      return challenge.target / balanceConfigFor(level).maxTiltDifference;
    };

    const stageLabel = (): string | null => {
      const total = stageCount(level.objective);
      return total > 1 ? `${Math.min(game.state.stage + 1, total)} of ${total}` : null;
    };

    const modelFor = (): SceneModel => ({
      snapshot: game.snapshot(),
      placed: game.state.placed,
      targetBalance: targetBalanceFor(),
      gateOpen: game.state.status === 'won',
      celebrating: celebrating > 0,
      tray: game.state.tray,
      selectedTrayIndex,
      caption: describeObjective(currentChallenge(level.objective, game.state.stage)),
      stageLabel: stageLabel(),
      won: game.state.status === 'won',
    });

    const handleEvents = (events: readonly GameEvent[]): void => {
      for (const event of events) {
        switch (event.type) {
          case 'placed':
            sounds.play(`chirp:${event.animal.species}`);
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
          case 'levelCleared':
            wonFor = 0;
            break;
          default:
            break;
        }
      }
      if (events.some((event) => event.type === 'levelCleared')) {
        sounds.play('success');
        sounds.play('gate');
      }
    };

    const advanceLevel = (): void => {
      const index = LEVELS.findIndex((entry) => entry.id === level.id);
      const next = LEVELS[index + 1];
      if (!next || !host.content.isUnlocked(contentIdFor(next.id))) {
        host.exit();
        return;
      }
      level = next;
      game = createGame(level);
      selectedTrayIndex = null;
      host.storage.set('lastLevel', level.id);
    };

    const place = (trayIndex: number, side: 'left' | 'right'): void => {
      handleEvents(game.place(trayIndex, side));
      selectedTrayIndex = null;
    };

    const input = createInput(
      canvas,
      scene,
      (intent) => {
        void host.audio.unlock();
        switch (intent.kind) {
          case 'pickTray':
            selectedTrayIndex = intent.index;
            break;
          case 'dropSide':
            if (selectedTrayIndex !== null) place(selectedTrayIndex, intent.side);
            break;
          case 'takeBack':
            handleEvents(game.takeBack(intent.uid));
            break;
          case 'clearSelection':
            selectedTrayIndex = null;
            break;
        }
      },
      () => selectedTrayIndex !== null,
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

      if (game.state.status === 'won') {
        wonFor += dt;
        // Let the gate finish opening before moving on.
        if (wonFor > TIMING.gateSeconds + 1.4) advanceLevel();
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
        place,
        takeBack: (uid) => handleEvents(game.takeBack(uid)),
        step: (frames = 1) => {
          for (let i = 0; i < frames; i++) frame(1 / 60);
        },
        status: () => game.state.status,
        zone: () => game.snapshot().zone,
        flagRaised: () => game.snapshot().zone === 'red',
        level: () => level.id,
      },
    };
  },
};

export default seesawGame;
export { LEVELS, getLevel, solutionsFor } from './logic/levels.data.js';
export { createSynthSoundPack, SOUND_EVENTS } from './audio/seesaw-sounds.js';
export type { LevelDef } from './logic/level.js';
