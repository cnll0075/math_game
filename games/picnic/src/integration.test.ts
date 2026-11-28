// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import { installCanvasStub } from '@bundle/core';
import { picnicGame } from './index.js';
import { createTestHost, type TestHost } from './test-host.js';
import * as sounds from './audio/picnic-sounds.js';

let restoreCanvas: () => void;
beforeAll(() => {
  restoreCanvas = installCanvasStub();
});
afterAll(() => restoreCanvas());
afterEach(() => vi.restoreAllMocks());

const mountGame = async (startLevel?: string, host: TestHost = createTestHost()) => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const session = await picnicGame.mount(container, host, { startLevel });
  return { container, host, session };
};

describe('a game played through the module', () => {
  it('names itself for the catalog, and mounts and unmounts a canvas', async () => {
    expect(picnicGame.id).toBe('picnic');
    expect(picnicGame.title).toBe('Picnic Pals');
    const { container, session } = await mountGame();
    expect(container.querySelector('canvas')).not.toBeNull();
    session.unmount();
    expect(container.querySelector('canvas')).toBeNull();
  });

  it('plays the first round to the end, keeps the stars and moves on', async () => {
    const played: string[] = [];
    vi.spyOn(sounds, 'createPicnicSoundPack').mockReturnValue({
      preload: async () => {},
      play: (event: string) => void played.push(event),
    });
    const { session, host } = await mountGame();
    session.__test.step(2);
    expect(session.__test.levelId()).toBe('two-friends');
    session.__test.play('best');
    expect(session.__test.phase()).toBe('done');
    expect(played).toEqual(expect.arrayContaining(['level', 'pop', 'cheer']));
    expect(host.storage.get('stars', {})).toEqual({ 'two-friends': 3 });
    session.__test.settle();
    session.__test.act({ kind: 'next' });
    expect(session.__test.levelId()).toBe('strawberry-share');
    session.unmount();
  });

  it('opens a round from the URL', async () => {
    const { session } = await mountGame('cake-quarters');
    expect(session.__test.levelId()).toBe('cake-quarters');
    session.unmount();
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
    for (const name of ['level', 'pop', 'whoosh', 'nope', 'woof', 'chop', 'munch', 'cheer', 'star']) {
      expect(sounds.SOUND_EVENTS).toContain(name);
    }
  });
});
