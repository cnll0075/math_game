// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { installCanvasStub } from '@bundle/core';
import { brambleGame } from './index.js';
import { createTestHost } from './test-host.js';
import * as sounds from './audio/bramble-sounds.js';

let restoreCanvas: () => void;
beforeAll(() => {
  restoreCanvas = installCanvasStub();
});
afterAll(() => restoreCanvas());

const mountGame = async (startLevel?: string) => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const host = createTestHost();
  const session = await brambleGame.mount(container, host, startLevel ? { startLevel } : undefined);
  return { container, host, session };
};

describe('a run played through the module', () => {
  it('opens with a sum to read and a full tank', async () => {
    const { session } = await mountGame();
    session.__test.step(10);
    expect(session.__test.sum()).toMatch(/\d/);
    expect(session.__test.health()).toBe(100);
    expect(session.__test.status()).toBe('running');
    session.unmount();
  });

  it('bursts twenty rows without losing a drop when the sums are read', async () => {
    const { session } = await mountGame();
    session.__test.step(10);
    for (let i = 0; i < 20; i += 1) session.__test.takeRightLane();
    expect(session.__test.score()).toBe(20);
    expect(session.__test.health()).toBe(100);
    session.unmount();
  });

  it('costs exactly a tenth for a wrong lane', async () => {
    const { session } = await mountGame();
    session.__test.step(10);
    session.__test.takeWrongLane();
    expect(session.__test.health()).toBe(90);
    expect(session.__test.score()).toBe(0);
    session.unmount();
  });

  it('plays the burst sound for a right lane and the bump for a wrong one', async () => {
    const played: string[] = [];
    vi.spyOn(sounds, 'createBrambleSoundPack').mockReturnValue({
      preload: async () => {},
      play: (event: string) => void played.push(event),
    });
    const { session } = await mountGame();
    session.__test.step(10);
    session.__test.takeRightLane();
    expect(played).toContain('burst');
    session.__test.takeWrongLane();
    expect(played).toContain('thump');
    session.unmount();
    vi.restoreAllMocks();
  });

  it('opens straight into a band for ?game=bramble&level=take-aways', async () => {
    const { session } = await mountGame('take-aways');
    session.__test.step(10);
    expect(session.__test.band()).toBe('take-aways');
    session.unmount();
  });

  it('ends after ten wrong lanes, and runs again', async () => {
    const { session } = await mountGame();
    session.__test.step(10);
    for (let i = 0; i < 12 && session.__test.status() === 'running'; i += 1) {
      session.__test.takeWrongLane();
    }
    expect(session.__test.status()).toBe('over');
    expect(session.__test.health()).toBe(0);

    session.__test.restart();
    session.__test.step(10);
    expect(session.__test.status()).toBe('running');
    expect(session.__test.health()).toBe(100);
    expect(session.__test.score()).toBe(0);
    session.unmount();
  });

  it('writes the best score where the next session will find it', async () => {
    const { session, host } = await mountGame();
    session.__test.step(10);
    for (let i = 0; i < 4; i += 1) session.__test.takeRightLane();
    const scored = session.__test.score();
    for (let i = 0; i < 12 && session.__test.status() === 'running'; i += 1) {
      session.__test.takeWrongLane();
    }
    expect(host.storage.get('best', 0)).toBeGreaterThanOrEqual(scored);
    session.unmount();
  });

  it('stops the clock when unmounted, leaving nothing behind', async () => {
    const { container, session } = await mountGame();
    session.__test.step(10);
    session.unmount();
    expect(container.querySelector('canvas')).toBeNull();
  });
});
