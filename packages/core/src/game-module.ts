import type { AudioBus } from './audio/audio-bus.js';
import type { ContentManifest } from './entitlements.js';
import type { GameStore } from './storage.js';
import type { SettingsValues } from './settings.js';

/** The read-only view of settings handed to a game. */
export interface SettingsView {
  readonly values: SettingsValues;
  subscribe(listener: (values: SettingsValues) => void): () => void;
}

/** Everything the shell provides to a game. Games own nothing global. */
export interface GameHost {
  audio: AudioBus;
  storage: GameStore;
  settings: SettingsView;
  content: ContentManifest;
  exit(): void;
}

export interface GameSession {
  pause(): void;
  resume(): void;
  unmount(): void;
}

export interface GameModule<Options = unknown> {
  id: string;
  title: string;
  mount(container: HTMLElement, host: GameHost, options?: Options): Promise<GameSession>;
}
