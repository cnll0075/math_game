// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import { installCanvasStub } from '@bundle/core';
import { pondGame } from './index.js';
import { createTestHost, type TestHost } from './test-host.js';
import { BOARDS } from './logic/boards.data.js';
import * as sounds from './audio/pond-sounds.js';

let restoreCanvas: () => void;
beforeAll(() => {
  restoreCanvas = installCanvasStub();
});
afterAll(() => restoreCanvas());
afterEach(() => vi.restoreAllMocks());

const mountGame = async (startLevel?: string, host: TestHost = createTestHost()) => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const session = await pondGame.mount(container, host, startLevel ? { startLevel } : undefined);
  return { container, host, session };
};

describe('boards played through the module', () => {
  it('opens a new player on the 2×2 board and announces it', async () => {
    const played: string[] = [];
    vi.spyOn(sounds, 'createPondSoundPack').mockReturnValue({ preload: async () => {}, play: (event: string) => void played.push(event) });
    const { session } = await mountGame();
    session.__test.step(2);
    expect(session.__test.boardId()).toBe('board-2');
    expect(played).toContain('board');
    session.unmount();
  });

  it('keeps an equal pair up, and puts an unequal one back after the hold', async () => {
    const { session } = await mountGame('board-4');
    const [a, b] = session.__test.pair(true);
    session.__test.flip(a);
    session.__test.flip(b);
    expect(session.__test.state().pads[a]!.matched).toBe(true);
    const [c, d] = session.__test.pair(false);
    session.__test.flip(c);
    session.__test.flip(d);
    expect(session.__test.state().misses).toBe(1);
    session.__test.step(120);
    expect(session.__test.state().pads[c]!.up).toBe(false);
    session.unmount();
  });

  it('clears every board in turn for three stars each, and keeps them', async () => {
    const { session, host } = await mountGame();
    for (const board of BOARDS) {
      expect(session.__test.boardId()).toBe(board.id);
      session.__test.solve();
      expect(session.__test.phase()).toBe('cleared');
      session.__test.next();
    }
    const book = host.storage.get<Record<string, number>>('stars', {});
    for (const board of BOARDS) expect(book[board.id]).toBe(3);
    expect(session.__test.boardId()).toBe('board-9');
    session.unmount();
  });

  it('opens straight onto a board for ?game=pond&level=board-5', async () => {
    const { session } = await mountGame('board-5');
    expect(session.__test.boardId()).toBe('board-5');
    session.unmount();
  });

  it('picks up where the player left off', async () => {
    const host = createTestHost();
    host.storage.set('stars', { 'board-2': 3 });
    const { session } = await mountGame(undefined, host);
    expect(session.__test.boardId()).toBe('board-3');
    session.unmount();
  });

  it('opens even when the saved stars are damaged', async () => {
    const host = createTestHost();
    host.storage.set('stars', 'not a book');
    const { session } = await mountGame(undefined, host);
    expect(session.__test.boardId()).toBe('board-2');
    session.unmount();
  });

  it('stops the clock when unmounted, leaving nothing behind', async () => {
    const { container, session } = await mountGame();
    session.__test.step(10);
    session.unmount();
    expect(container.querySelector('canvas')).toBeNull();
  });

  it('lets a tap on the frog change nothing on the board', async () => {
    const { session } = await mountGame('board-4');
    const [a, b] = session.__test.pair(false);
    session.__test.flip(a);
    session.__test.flip(b);
    const before = JSON.stringify(session.__test.state());
    session.__test.act({ kind: 'frog', point: { x: 100, y: 400 } });
    expect(JSON.stringify(session.__test.state())).toBe(before);
    session.unmount();
  });

  it('croaks when the frog is poked while it sits', async () => {
    const played: string[] = [];
    vi.spyOn(sounds, 'createPondSoundPack').mockReturnValue({ preload: async () => {}, play: (event: string) => void played.push(event) });
    const { session } = await mountGame('board-2');
    let on: { x: number; y: number } | null = null;
    for (let frame = 0; frame < 60 * 30 && !on; frame += 1) {
      session.__test.step(1);
      const spot = session.__test.frogSpot();
      if (spot && session.__test.frogAt({ x: spot.x, y: spot.y - 40 })) on = { x: spot.x, y: spot.y - 40 };
    }
    expect(played).toContain('splash');
    expect(on).not.toBeNull();
    session.__test.act({ kind: 'frog', point: on! });
    expect(played).toContain('croak');
    session.unmount();
  });
});
