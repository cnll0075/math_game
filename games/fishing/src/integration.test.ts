// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import { installCanvasStub } from '@bundle/core';
import { fishingGame } from './index.js';
import { createTestHost, type TestHost } from './test-host.js';
import * as sounds from './audio/fishing-sounds.js';

let restoreCanvas: () => void;
beforeAll(() => {
  restoreCanvas = installCanvasStub();
});
afterAll(() => restoreCanvas());
afterEach(() => vi.restoreAllMocks());

const mountGame = async (startLevel?: string, host: TestHost = createTestHost()) => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let seed = 0;
  const session = await fishingGame.mount(container, host, { startLevel, seed: () => (seed += 1) });
  return { container, host, session };
};

describe('a game played through the module', () => {
  it('names itself for the catalog, and mounts and unmounts a canvas', async () => {
    expect(fishingGame.id).toBe('fishing');
    expect(fishingGame.title).toBe('Bucket Bay');
    const { container, session } = await mountGame();
    expect(container.querySelector('canvas')).not.toBeNull();
    session.unmount();
    expect(container.querySelector('canvas')).toBeNull();
  });

  it('opens on the first level with a fanfare, fills the bucket, keeps the stars and moves on', async () => {
    const played: string[] = [];
    vi.spyOn(sounds, 'createFishingSoundPack').mockReturnValue({
      preload: async () => {},
      play: (event: string) => void played.push(event),
    });
    const { session, host } = await mountGame();
    session.__test.step(2);
    expect(session.__test.levelId()).toBe('first-catch');
    expect(played).toContain('level');
    session.__test.step(60 * 3);
    session.__test.play();
    expect(session.__test.phase()).toBe('won');
    expect(played).toEqual(expect.arrayContaining(['hooked', 'reel', 'caught', 'full', 'star']));
    expect(host.storage.get('stars', {})).toHaveProperty('first-catch');
    session.__test.settle();
    session.__test.act({ kind: 'next' });
    expect(session.__test.levelId()).toBe('just-right');
    session.unmount();
  });

  it('opens any level from the URL, and remembers stars across visits', async () => {
    const host = createTestHost();
    host.storage.set('stars', { 'first-catch': 3 });
    const first = await mountGame(undefined, host);
    expect(first.session.__test.levelId()).toBe('just-right');
    first.session.unmount();
    const second = await mountGame('jellyfish', host);
    expect(second.session.__test.levelId()).toBe('jellyfish');
    second.session.unmount();
  });

  it('follows the mute setting', async () => {
    const host = createTestHost();
    const { session } = await mountGame(undefined, host);
    host.settings.set('muted', true);
    expect(host.audio.muted).toBe(true);
    session.unmount();
  });
});

describe('the sound pack', () => {
  it('knows every event the game plays', () => {
    for (const name of ['level', 'cast', 'plop', 'hooked', 'empty', 'reel', 'caught', 'speed', 'health', 'item', 'bonus', 'treasure', 'saved', 'full', 'capsize', 'timeout', 'stuck', 'tick', 'star']) {
      expect(sounds.SOUND_EVENTS).toContain(name);
    }
  });
});
