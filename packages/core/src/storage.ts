export type StorageBackend = Pick<Storage, 'getItem' | 'setItem'>;

export interface GameStore {
  get<T>(key: string, fallback: T): T;
  set<T>(key: string, value: T): void;
}

export interface ProfileStore {
  namespace(gameId: string): GameStore;
}

const memoryBackend = (): StorageBackend => {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
  };
};

const resolveDefaultBackend = (): StorageBackend => {
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch {
    // Private browsing and blocked-cookie modes throw on access alone.
  }
  return memoryBackend();
};

/**
 * Per-game key/value storage. Storage is a convenience, never a dependency:
 * any backend failure silently degrades to an in-memory store for the session.
 */
export function createProfileStore(backend: StorageBackend = resolveDefaultBackend()): ProfileStore {
  const fallback = memoryBackend();

  const read = (key: string): string | null => {
    try {
      return backend.getItem(key) ?? fallback.getItem(key);
    } catch {
      return fallback.getItem(key);
    }
  };

  const write = (key: string, value: string): void => {
    fallback.setItem(key, value);
    try {
      backend.setItem(key, value);
    } catch {
      // Already mirrored in the fallback.
    }
  };

  return {
    namespace(gameId) {
      const keyFor = (key: string) => `bundle:${gameId}:${key}`;
      return {
        get(key, defaultValue) {
          const raw = read(keyFor(key));
          if (raw === null) return defaultValue;
          try {
            return JSON.parse(raw) as typeof defaultValue;
          } catch {
            return defaultValue;
          }
        },
        set(key, value) {
          try {
            write(keyFor(key), JSON.stringify(value));
          } catch {
            // Unserialisable values are dropped rather than crashing a game.
          }
        },
      };
    },
  };
}
