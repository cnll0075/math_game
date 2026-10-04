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
  exited: number;
}

const memoryBackend = () => {
  const map = new Map<string, string>();
  return { getItem: (key: string) => map.get(key) ?? null, setItem: (key: string, value: string) => void map.set(key, value) };
};

/** A GameHost wired to fakes. */
export function createTestHost(): TestHost {
  const store = createProfileStore(memoryBackend());
  const host: TestHost = {
    audio: createAudioBus(() => fakeContext() as unknown as AudioContext),
    storage: store.namespace('pond'),
    settings: createSettings(store.namespace('shell')),
    content: createContentManifest('all'),
    exit: () => {
      host.exited += 1;
    },
    exited: 0,
  };
  return host;
}
