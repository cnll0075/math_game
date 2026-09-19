import {
  createAudioBus,
  createContentManifest,
  createProfileStore,
  createSettings,
  type GameHost,
  type Settings,
} from '@bundle/core';
import { fakeContext } from '../../../packages/core/src/audio/fake-context.js';

export interface TestHost extends GameHost {
  /** The writable settings, so tests can change them mid-session. */
  settings: Settings;
  playedSounds: string[];
  exited: number;
}

const memoryBackend = () => {
  const map = new Map<string, string>();
  return { getItem: (key: string) => map.get(key) ?? null, setItem: (key: string, value: string) => void map.set(key, value) };
};

/** A GameHost wired to fakes, plus a log of what the game tried to play. */
export function createTestHost(options: { unlocked?: 'all' | readonly string[] } = {}): TestHost {
  const store = createProfileStore(memoryBackend());
  const bus = createAudioBus(() => fakeContext() as unknown as AudioContext);
  const host: TestHost = {
    audio: bus,
    storage: store.namespace('sky'),
    settings: createSettings(store.namespace('shell')),
    content: createContentManifest(options.unlocked ?? 'all'),
    exit: () => {
      host.exited += 1;
    },
    playedSounds: [],
    exited: 0,
  };
  return host;
}
