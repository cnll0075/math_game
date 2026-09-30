// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import { installCanvasStub } from '@bundle/core';
import { balloonGame } from './index.js';
import { createTestHost, type TestHost } from './test-host.js';
import { RESCUES } from './logic/levels.data.js';
import * as sounds from './audio/balloon-sounds.js';

let restoreCanvas: () => void;
beforeAll(() => {
  restoreCanvas = installCanvasStub();
});
afterAll(() => restoreCanvas());
afterEach(() => vi.restoreAllMocks());

const mountGame = async (startLevel?: string, host: TestHost = createTestHost()) => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const session = await balloonGame.mount(container, host, startLevel ? { startLevel } : undefined);
  return { container, host, session };
};

describe('a game played through the module', () => {
  it('opens at the first rescue and announces the chapter', async () => {
    const played: string[] = [];
    vi.spyOn(sounds, 'createBalloonSoundPack').mockReturnValue({
      preload: async () => {},
      play: (event: string) => void played.push(event),
    });
    const { session } = await mountGame();
    session.__test.step(2);
    expect(session.__test.rescueId()).toBe('first-flight-1');
    expect(played).toContain('chapter');
    session.unmount();
  });

  it('whooshes on too much, says how many too many, then rescues for two stars', async () => {
    const { session, host } = await mountGame();
    session.__test.act({ kind: 'tray', index: 1 }); // 5 for a weight of 3
    session.__test.act({ kind: 'letGo' });
    session.__test.settle();
    expect(session.__test.phase()).toBe('building');
    expect(session.__test.feedback()).toBe('2 too many!');

    session.__test.act({ kind: 'clipped', slot: 0 });
    session.__test.act({ kind: 'tray', index: 0 });
    session.__test.act({ kind: 'letGo' });
    session.__test.settle();
    expect(session.__test.phase()).toBe('rescued');
    expect(host.storage.get<Record<string, number>>('stars', {})['first-flight-1']).toBe(2);
    session.unmount();
  });

  it('ignores taps while the kit is in the air', async () => {
    const { session } = await mountGame();
    session.__test.act({ kind: 'tray', index: 1 });
    session.__test.act({ kind: 'letGo' });
    session.__test.step(1);
    session.__test.act({ kind: 'tray', index: 0 });
    session.__test.act({ kind: 'letGo' });
    expect(session.__test.tries()).toBe(1);
    session.unmount();
  });

  it('opens straight into a chapter for ?game=balloon&level=pop-1', async () => {
    const { session } = await mountGame('pop-1');
    expect(session.__test.rescueId()).toBe('pop-1');
    session.unmount();
  });

  it('picks up where the player left off', async () => {
    const host = createTestHost();
    host.storage.set('stars', { 'first-flight-1': 3, 'first-flight-2': 2 });
    const { session } = await mountGame(undefined, host);
    expect(session.__test.rescueId()).toBe('first-flight-3');
    session.unmount();
  });

  it('opens even when the saved stars are damaged', async () => {
    const host = createTestHost();
    host.storage.set('stars', 'not a book');
    const { session } = await mountGame(undefined, host);
    expect(session.__test.rescueId()).toBe('first-flight-1');
    session.unmount();
  });

  it('can be played from the first rescue to the last, three stars each', async () => {
    const { session, host } = await mountGame();
    for (let index = 0; index < RESCUES.length; index += 1) {
      expect(session.__test.rescueId()).toBe(RESCUES[index]!.id);
      session.__test.answer();
      expect(session.__test.phase()).toBe('rescued');
      session.__test.act({ kind: 'next' });
    }
    expect(session.__test.phase()).toBe('finished');
    const book = host.storage.get<Record<string, number>>('stars', {});
    for (const rescue of RESCUES) expect(book[rescue.id]).toBe(3);
    session.__test.act({ kind: 'next' });
    expect(session.__test.rescueId()).toBe('first-flight-1');
    session.unmount();
  });

  it('stops the clock when unmounted, leaving nothing behind', async () => {
    const { container, session } = await mountGame();
    session.__test.step(10);
    session.unmount();
    expect(container.querySelector('canvas')).toBeNull();
  });
});
