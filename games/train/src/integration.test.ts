// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import { installCanvasStub } from '@bundle/core';
import { trainGame } from './index.js';
import { createTestHost, type TestHost } from './test-host.js';
import * as sounds from './audio/train-sounds.js';

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
  const session = await trainGame.mount(container, host, { startLevel, seed: () => (seed += 1) });
  return { container, host, session };
};

describe('a game played through the module', () => {
  it('names itself for the catalog, and mounts and unmounts a canvas', async () => {
    expect(trainGame.id).toBe('train');
    expect(trainGame.title).toBe('Cargo Yard');
    const { container, session } = await mountGame();
    expect(container.querySelector('canvas')).not.toBeNull();
    session.unmount();
    expect(container.querySelector('canvas')).toBeNull();
  });

  it('plays a run to its end, keeps the best, and starts again on a tap', async () => {
    const played: string[] = [];
    vi.spyOn(sounds, 'createTrainSoundPack').mockReturnValue({
      preload: async () => {},
      play: (event: string) => void played.push(event),
    });
    const { session, host } = await mountGame();
    session.__test.play('careful', 600);
    expect(session.__test.phase()).toBe('over');
    expect(played).toEqual(expect.arrayContaining(['start', 'crate', 'thunk', 'whistle', 'over']));
    const sent = session.__test.summary()!.sent;
    expect(sent).toBeGreaterThan(0);
    expect(host.storage.get('best', 0)).toBe(sent);
    session.__test.step(120);
    session.__test.act({ kind: 'next' });
    expect(session.__test.phase()).toBe('playing');
    session.unmount();
  });

  it('opens in a band from the URL', async () => {
    const { session } = await mountGame('heavy');
    expect(session.__test.state().band).toBe('heavy');
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
    for (const name of ['start', 'band', 'speed', 'crate', 'pick', 'thunk', 'whistle', 'crunch', 'hammer', 'horn', 'tick', 'bonus', 'danger', 'over', 'best']) {
      expect(sounds.SOUND_EVENTS).toContain(name);
    }
  });
});
