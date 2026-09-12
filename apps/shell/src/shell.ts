import {
  createAudioBus,
  createContentManifest,
  createProfileStore,
  createSettings,
  type AudioBus,
  type ContentManifest,
  type GameHost,
  type GameSession,
  type ProfileStore,
  type Settings,
} from '@bundle/core';
import { CATALOG, type GameTile } from './catalog.js';
import { createLauncher } from './launcher.js';
import { createSettingsPanel } from './settings-panel.js';

export interface ShellDeps {
  audio?: AudioBus;
  profile?: ProfileStore;
  content?: ContentManifest;
}

export interface Shell {
  showLauncher(): void;
  openGame(id: string, options?: { startLevel?: string }): Promise<void>;
  closeGame(): void;
  readonly settings: Settings;
  destroy(): void;
}

/**
 * The bundle app. It owns the one audio bus, the one profile store, the one
 * settings object, and the entitlement check, and hands them to whichever game
 * is running. Games own nothing global, so adding the next nine changes nothing
 * here but the catalog.
 */
export function createShell(root: HTMLElement, deps: ShellDeps = {}): Shell {
  const audio = deps.audio ?? createAudioBus();
  const profile = deps.profile ?? createProfileStore();
  const settings = createSettings(profile.namespace('shell'));
  // Everything is unlocked while there is nothing to buy. Replacing this line
  // with a real purchase check is the whole of the monetisation seam.
  const content = deps.content ?? createContentManifest('all');

  audio.muted = settings.values.muted;
  audio.volume = settings.values.volume;
  const unsubscribe = settings.subscribe((values) => {
    audio.muted = values.muted;
    audio.volume = values.volume;
  });

  let session: GameSession | null = null;
  let host: HTMLElement | null = null;

  const clear = (): void => {
    root.replaceChildren();
  };

  const openSettings = (): void => {
    if (root.querySelector('[data-panel="settings"]')) return;
    root.appendChild(
      createSettingsPanel({
        settings,
        audio,
        onClose: () => root.querySelector('[data-panel="settings"]')?.remove(),
      }),
    );
  };

  const shell: Shell = {
    settings,

    showLauncher() {
      shell.closeGame();
      clear();
      root.appendChild(
        createLauncher({
          content,
          onOpen: (tile) => void shell.openGame(tile.id),
          onSettings: openSettings,
        }),
      );
    },

    async openGame(id, gameOptions) {
      const tile: GameTile | undefined = CATALOG.find((entry) => entry.id === id);
      if (!tile?.module || !content.isUnlocked(tile.id)) return;

      // Any tap that opens a game is a user gesture, which is the only moment
      // iOS will let an audio context start.
      void audio.unlock();

      clear();
      host = document.createElement('div');
      host.className = 'game-host';
      host.dataset.screen = 'game';
      root.appendChild(host);

      const back = document.createElement('button');
      back.className = 'corner corner--back';
      back.textContent = '←';
      back.dataset.action = 'back';
      back.setAttribute('aria-label', 'Back to the games');
      back.addEventListener('click', () => shell.showLauncher());
      root.appendChild(back);

      const gameHost: GameHost = {
        audio,
        storage: profile.namespace(tile.id),
        settings,
        content: { isUnlocked: (contentId) => content.isUnlocked(contentId) },
        exit: () => shell.showLauncher(),
      };

      session = await tile.module.mount(host, gameHost, gameOptions);
    },

    closeGame() {
      session?.unmount();
      session = null;
      host = null;
    },

    destroy() {
      shell.closeGame();
      unsubscribe();
      clear();
    },
  };

  return shell;
}
