import { describe, it, expect } from 'vitest';
import { createSettings } from './settings.js';
import { createProfileStore, type StorageBackend } from './storage.js';

const memoryProfile = () => {
  const map = new Map<string, string>();
  const backend: StorageBackend = {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
  };
  return createProfileStore(backend);
};

describe('createSettings', () => {
  it('defaults music to off and sound on', () => {
    const settings = createSettings(memoryProfile().namespace('shell'));
    expect(settings.values.music).toBe(false);
    expect(settings.values.muted).toBe(false);
    expect(settings.values.volume).toBeGreaterThan(0);
  });

  it('notifies subscribers of a change', () => {
    const settings = createSettings(memoryProfile().namespace('shell'));
    const seen: boolean[] = [];
    settings.subscribe((values) => seen.push(values.muted));
    settings.set('muted', true);
    expect(seen).toEqual([true]);
  });

  it('persists across instances', () => {
    const profile = memoryProfile();
    createSettings(profile.namespace('shell')).set('muted', true);
    expect(createSettings(profile.namespace('shell')).values.muted).toBe(true);
  });

  it('stops notifying after unsubscribe', () => {
    const settings = createSettings(memoryProfile().namespace('shell'));
    let count = 0;
    const unsubscribe = settings.subscribe(() => (count += 1));
    settings.set('muted', true);
    unsubscribe();
    settings.set('muted', false);
    expect(count).toBe(1);
  });

  it('clamps volume into range', () => {
    const settings = createSettings(memoryProfile().namespace('shell'));
    settings.set('volume', 5);
    expect(settings.values.volume).toBe(1);
    settings.set('volume', -1);
    expect(settings.values.volume).toBe(0);
  });
});
