import type { GameStore } from './storage.js';

export interface SettingsValues {
  muted: boolean;
  music: boolean;
  volume: number;
}

export interface Settings {
  readonly values: SettingsValues;
  set<K extends keyof SettingsValues>(key: K, value: SettingsValues[K]): void;
  subscribe(listener: (values: SettingsValues) => void): () => void;
}

/** Music defaults off: the game must feel complete without it. */
export const DEFAULT_SETTINGS: SettingsValues = { muted: false, music: false, volume: 0.8 };

const STORE_KEY = 'settings';

export function createSettings(store: GameStore): Settings {
  let values: SettingsValues = { ...DEFAULT_SETTINGS, ...store.get(STORE_KEY, {}) };
  const listeners = new Set<(values: SettingsValues) => void>();

  return {
    get values() {
      return values;
    },
    set(key, value) {
      const next = key === 'volume' ? (Math.min(1, Math.max(0, value as number)) as SettingsValues[typeof key]) : value;
      if (values[key] === next) return;
      values = { ...values, [key]: next };
      store.set(STORE_KEY, values);
      for (const listener of listeners) listener(values);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}
