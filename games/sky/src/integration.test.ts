// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { installCanvasStub } from '@bundle/core';
import { skyGame } from './index.js';
import { createTestHost } from './test-host.js';
import * as sounds from './audio/sky-sounds.js';

let restoreCanvas: () => void;
beforeAll(() => {
  restoreCanvas = installCanvasStub();
});
afterAll(() => restoreCanvas());

const recordSounds = () => {
  const played: string[] = [];
  vi.spyOn(sounds, 'createSkySoundPack').mockReturnValue({
    preload: async () => {},
    play: (event: string) => void played.push(event),
  });
  return played;
};

const mountGame = async (startLevel?: string) => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const host = createTestHost();
  const session = await skyGame.mount(container, host, startLevel ? { startLevel } : undefined);
  return { container, host, session };
};

describe('a run played through the module', () => {
  it('opens with a question and a sky that can answer it', async () => {
    const { session } = await mountGame();
    session.__test.step();
    expect(session.__test.sum()).toMatch(/\d/);
    expect(session.__test.numbers()).toContain(session.__test.answer());
    expect(session.__test.hearts()).toBe(3);
    session.unmount();
  });

  it('scores planes without losing a heart when the sums are read', async () => {
    const { session } = await mountGame();
    session.__test.step(30);
    for (let i = 0; i < 20; i += 1) {
      session.__test.shootAnswer();
      session.__test.step(2);
    }
    expect(session.__test.score()).toBeGreaterThanOrEqual(15);
    expect(session.__test.hearts()).toBe(3);
    expect(session.__test.status()).toBe('flying');
    session.unmount();
  });

  it('jams on the wrong plane without costing a heart', async () => {
    const { session } = await mountGame();
    session.__test.step(30);
    session.__test.shootWrong();
    expect(session.__test.jammed()).toBe(true);
    expect(session.__test.score()).toBe(0);
    expect(session.__test.hearts()).toBe(3);
    session.unmount();
  });

  it('plays the reward sound for a right answer and the cough for a wrong one', async () => {
    const played = recordSounds();
    const { session } = await mountGame();
    session.__test.step(30);
    session.__test.shootAnswer();
    expect(played).toContain('destroy');
    session.__test.shootWrong();
    expect(played).toContain('jam');
    session.unmount();
    vi.restoreAllMocks();
  });

  it('opens straight into a band for ?game=sky&level=take-aways', async () => {
    const { session } = await mountGame('take-aways');
    session.__test.step();
    expect(session.__test.band()).toBe('take-aways');
    session.unmount();
  });

  it('loses the run when the sums are ignored, then flies again', async () => {
    const { session } = await mountGame();
    for (let i = 0; i < 60 * 120 && session.__test.status() === 'flying'; i += 1) session.__test.step();
    expect(session.__test.status()).toBe('over');
    expect(session.__test.hearts()).toBe(0);

    session.__test.restart();
    session.__test.step();
    expect(session.__test.status()).toBe('flying');
    expect(session.__test.hearts()).toBe(3);
    expect(session.__test.score()).toBe(0);
    session.unmount();
  });

  it('writes the best score down where the next session will find it', async () => {
    const { session, host } = await mountGame();
    session.__test.step(30);
    for (let i = 0; i < 3; i += 1) {
      session.__test.shootAnswer();
      session.__test.step(2);
    }
    const scored = session.__test.score();
    for (let i = 0; i < 60 * 180 && session.__test.status() === 'flying'; i += 1) session.__test.step();
    expect(host.storage.get('best', 0)).toBeGreaterThanOrEqual(scored);
    session.unmount();
  });

  it('keeps every number in the sky answerable, played or not', async () => {
    const { session } = await mountGame('over-ten');
    for (let i = 0; i < 60 * 40 && session.__test.status() === 'flying'; i += 1) {
      session.__test.step();
      for (const number of session.__test.numbers()) {
        expect(number).toBeGreaterThanOrEqual(1);
        expect(number).toBeLessThanOrEqual(20);
      }
    }
    session.unmount();
  });

  it('stops the clock when unmounted, leaving nothing behind', async () => {
    const { container, session } = await mountGame();
    session.__test.step(10);
    session.unmount();
    expect(container.querySelector('canvas')).toBeNull();
  });
});
