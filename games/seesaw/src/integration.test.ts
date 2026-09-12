// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { seesawGame } from './index.js';
import { LEVELS, getLevel, solutionsFor } from './logic/levels.data.js';
import { createTestHost } from './test-host.js';
import { installCanvasStub } from './canvas-stub.js';
import * as sounds from './audio/seesaw-sounds.js';

let restoreCanvas: () => void;
beforeAll(() => {
  restoreCanvas = installCanvasStub();
});
afterAll(() => restoreCanvas());

const recordSounds = () => {
  const played: string[] = [];
  vi.spyOn(sounds, 'createSynthSoundPack').mockReturnValue({
    preload: async () => {},
    play: (event: string) => void played.push(event),
  });
  return played;
};

const mountGame = async (startLevel: string) => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const host = createTestHost({ unlocked: [`seesaw:${startLevel}`] });
  const session = await seesawGame.mount(container, host, { startLevel });
  return { container, host, session };
};

describe('playing the game', () => {
  it.each(LEVELS.map((level) => [level.id] as const))(
    '%s can be played to completion through the real module',
    async (id) => {
      const played = recordSounds();
      const { session } = await mountGame(id);

      for (const move of solutionsFor(getLevel(id)!)[0]!) {
        session.__test.place(move.trayIndex, move.side);
        session.__test.step(40);
      }

      expect(session.__test.status()).toBe('won');
      expect(played).toContain('success');
      session.unmount();
      vi.restoreAllMocks();
    },
  );

  it('leaves the level unfinished when the objective is not met', async () => {
    const { session } = await mountGame('level-1');
    session.__test.place(0, 'right');
    session.__test.step(60);
    expect(session.__test.status()).toBe('playing');
    session.unmount();
  });

  it('rings the bell on the way through, once per balance', async () => {
    const played = recordSounds();
    const { session } = await mountGame('level-1');
    session.__test.place(0, 'right');
    session.__test.step(120);
    expect(played.filter((event) => event === 'ding')).toHaveLength(0);
    session.__test.place(1, 'right');
    session.__test.step(200);
    expect(played.filter((event) => event === 'ding')).toHaveLength(1);
    session.unmount();
    vi.restoreAllMocks();
  });

  it('raises the danger flag in the red and lowers it on recovery', async () => {
    const { session } = await mountGame('level-3');
    session.__test.place(2, 'left');
    session.__test.step(30);
    expect(session.__test.flagRaised()).toBe(true);
    session.__test.takeBack('tray-2');
    session.__test.step(30);
    expect(session.__test.flagRaised()).toBe(false);
    session.unmount();
  });

  it('lets a child undo a move and try the other side', async () => {
    const { session } = await mountGame('level-2');
    session.__test.place(0, 'left');
    session.__test.step(20);
    session.__test.takeBack('tray-0');
    session.__test.place(0, 'right');
    session.__test.step(20);
    session.__test.place(1, 'right');
    session.__test.step(60);
    expect(session.__test.status()).toBe('won');
    session.unmount();
  });

  it('moves on to the next level after the gate opens', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const host = createTestHost({ unlocked: 'all' });
    const session = await seesawGame.mount(container, host, { startLevel: 'level-1' });
    for (const move of solutionsFor(getLevel('level-1')!)[0]!) session.__test.place(move.trayIndex, move.side);
    session.__test.step(400);
    expect(session.__test.level()).toBe('level-2');
    expect(session.__test.status()).toBe('playing');
    session.unmount();
  });

  it('leaves the game when the last unlocked level is finished', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const host = createTestHost({ unlocked: ['seesaw:level-1'] });
    const session = await seesawGame.mount(container, host, { startLevel: 'level-1' });
    for (const move of solutionsFor(getLevel('level-1')!)[0]!) session.__test.place(move.trayIndex, move.side);
    session.__test.step(400);
    expect(host.exited).toBeGreaterThan(0);
    session.unmount();
  });

  it('mutes through the shared settings', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const host = createTestHost();
    const session = await seesawGame.mount(container, host);
    host.settings.set('muted', true);
    expect(host.audio.muted).toBe(true);
    session.unmount();
  });
});
