// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { seesawGame } from './index.js';
import { PUZZLE_LEVELS, getLevel, solutionsFor } from './logic/levels.data.js';
import { createTestHost } from './test-host.js';
import { installCanvasStub } from './canvas-stub.js';
import * as sounds from './audio/seesaw-sounds.js';

let restoreCanvas: () => void;
beforeAll(() => {
  restoreCanvas = installCanvasStub();
});
afterAll(() => restoreCanvas());

const recordSounds = () => {
  const played: Array<{ event: string; delay: number }> = [];
  vi.spyOn(sounds, 'createSynthSoundPack').mockReturnValue({
    preload: async () => {},
    play: (event: string, params?: Record<string, number>) =>
      void played.push({ event, delay: params?.delay ?? 0 }),
  });
  return played;
};

const eventsOf = (played: Array<{ event: string }>) => played.map((entry) => entry.event);

/** Narrows a level id to the puzzle level it names, for the solver. */
const puzzle = (id: string) => {
  const level = getLevel(id);
  if (!level || level.mode !== 'puzzle') throw new Error(`${id} is not a puzzle level`);
  return level;
};

const mountGame = async (startLevel: string) => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const host = createTestHost({ unlocked: [`seesaw:${startLevel}`] });
  const session = await seesawGame.mount(container, host, { startLevel });
  return { container, host, session };
};

describe('playing the game', () => {
  it.each(PUZZLE_LEVELS.map((level) => [level.id] as const))(
    '%s can be played to completion through the real module',
    async (id) => {
      const played = recordSounds();
      const { session } = await mountGame(id);

      for (const move of solutionsFor(puzzle(id))[0]!) {
        session.__test.place(move.trayIndex, move.side);
        session.__test.step(40);
      }

      expect(session.__test.status()).toBe('won');
      expect(eventsOf(played)).toContain('success');
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
    expect(eventsOf(played).filter((event) => event === 'ding')).toHaveLength(0);
    session.__test.place(1, 'right');
    session.__test.step(200);
    expect(eventsOf(played).filter((event) => event === 'ding')).toHaveLength(1);
    session.unmount();
    vi.restoreAllMocks();
  });

  it('cheers with one chirp per animal, staggered into a wave', async () => {
    const played = recordSounds();
    const { session } = await mountGame('level-1');
    for (const move of solutionsFor(puzzle('level-1'))[0]!) session.__test.place(move.trayIndex, move.side);

    const events = eventsOf(played);
    expect(events).toContain('cheer');
    const chirps = played.filter((entry) => entry.event.startsWith('chirp:') && entry.delay > 0);
    // Six rabbits on the plank once level 1 is solved: three a side.
    expect(chirps).toHaveLength(6);
    const delays = chirps.map((entry) => entry.delay);
    expect(new Set(delays).size).toBe(delays.length);
    expect(delays).toEqual([...delays].sort((a, b) => a - b));
    session.unmount();
    vi.restoreAllMocks();
  });

  it('no longer plays a gate sound', async () => {
    const played = recordSounds();
    const { session } = await mountGame('level-1');
    for (const move of solutionsFor(puzzle('level-1'))[0]!) session.__test.place(move.trayIndex, move.side);
    session.__test.step(240);
    expect(eventsOf(played)).not.toContain('gate');
    session.unmount();
    vi.restoreAllMocks();
  });

  it('dances before moving on, then starts the next level clean', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const host = createTestHost({ unlocked: 'all' });
    const session = await seesawGame.mount(container, host, { startLevel: 'level-1' });
    for (const move of solutionsFor(puzzle('level-1'))[0]!) session.__test.place(move.trayIndex, move.side);

    session.__test.step(60);
    expect(session.__test.danceProgress()).toBeGreaterThan(0);
    expect(session.__test.level()).toBe('level-1');

    session.__test.step(240);
    expect(session.__test.level()).toBe('level-2');
    expect(session.__test.danceProgress()).toBe(0);
    session.unmount();
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
    for (const move of solutionsFor(puzzle('level-1'))[0]!) session.__test.place(move.trayIndex, move.side);
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
    for (const move of solutionsFor(puzzle('level-1'))[0]!) session.__test.place(move.trayIndex, move.side);
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

describe('making the goal noticeable', () => {
  it('sounds a new goal when a level opens', async () => {
    const played = recordSounds();
    const { session } = await mountGame('level-1');
    session.__test.step(2);
    expect(eventsOf(played)).toContain('goal');
    session.unmount();
    vi.restoreAllMocks();
  });

  it('sounds it again for each challenge of a three-part level', async () => {
    const played = recordSounds();
    const { session } = await mountGame('level-5');
    session.__test.step(2);
    const atStart = eventsOf(played).filter((event) => event === 'goal').length;

    // Clear the first challenge; the next goal should announce itself.
    for (const move of solutionsFor(puzzle('level-5'))[0]!.slice(0, 1)) {
      session.__test.place(move.trayIndex, move.side);
    }
    session.__test.step(10);
    expect(eventsOf(played).filter((event) => event === 'goal').length).toBeGreaterThan(atStart);
    // And clearing one is stamped, so the progress is felt.
    expect(eventsOf(played)).toContain('stamp');
    session.unmount();
    vi.restoreAllMocks();
  });
});
