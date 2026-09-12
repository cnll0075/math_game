import { describe, it, expect } from 'vitest';
import { createProfileStore, type StorageBackend } from './storage.js';

const memoryBackend = (): StorageBackend => {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
  };
};

describe('createProfileStore', () => {
  it('round-trips values', () => {
    const store = createProfileStore(memoryBackend()).namespace('seesaw');
    store.set('level', 3);
    expect(store.get('level', 0)).toBe(3);
  });

  it('round-trips objects', () => {
    const store = createProfileStore(memoryBackend()).namespace('seesaw');
    store.set('progress', { cleared: ['level-1'] });
    expect(store.get('progress', { cleared: [] as string[] })).toEqual({ cleared: ['level-1'] });
  });

  it('namespaces games apart', () => {
    const profile = createProfileStore(memoryBackend());
    profile.namespace('seesaw').set('level', 3);
    expect(profile.namespace('counting').get('level', 0)).toBe(0);
  });

  it('returns the fallback for a missing key', () => {
    expect(createProfileStore(memoryBackend()).namespace('seesaw').get('nope', 'fallback')).toBe('fallback');
  });

  it('returns the fallback for corrupt json', () => {
    const backend: StorageBackend = { getItem: () => '{{{', setItem: () => {} };
    expect(createProfileStore(backend).namespace('seesaw').get('level', 7)).toBe(7);
  });

  it('falls back to memory when the backend throws', () => {
    const hostile: StorageBackend = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    const store = createProfileStore(hostile).namespace('seesaw');
    store.set('level', 2);
    expect(store.get('level', 0)).toBe(2);
  });
});
