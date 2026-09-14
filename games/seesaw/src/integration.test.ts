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
  const played: Array<{ event: string; delay: number }> = [];
  vi.spyOn(sounds, 'createSynthSoundPack').mockReturnValue({
    preload: async () => {},
    play: (event: string, params?: Record<string, number>) =>
      void played.push({ event, delay: params?.delay ?? 0 }),
  });
  return played;
};

const eventsOf = (played: Array<{ event: string }>) => played.map((entry) => entry.event);

const mountGame = async (startLevel: string, unlocked: 'all' | readonly string[] = [`seesaw:${startLevel}`]) => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const host = createTestHost({ unlocked });
  const session = await seesawGame.mount(container, host, { startLevel });
  return { container, host, session };
};

type Session = Awaited<ReturnType<typeof mountGame>>['session'];

/** Answers a level using the solver's answer. */
const solveLevel = (session: Session, levelId: string): void => {
  const solution = solutionsFor(getLevel(levelId)!)[0]!;
  for (const move of solution) {
    if (move.kind === 'place') session.__test.place(move.trayIndex, move.side);
    else session.__test.takeBack(move.uid);
    session.__test.step(20);
  }
};

describe('playing a level', () => {
  it.each(LEVELS.map((level) => [level.id] as const))(
    'answers %s through the real module',
    async (id) => {
      const played = recordSounds();
      const { session } = await mountGame(id);
      solveLevel(session, id);
      expect(session.__test.status()).toBe('won');
      expect(eventsOf(played)).toContain('success');
      session.unmount();
      vi.restoreAllMocks();
    },
  );

  it('announces each new question', async () => {
    const played = recordSounds();
    const { session } = await mountGame('l2', 'all');
    session.__test.step(2);
    const atStart = eventsOf(played).filter((event) => event === 'goal' || event === 'stamp').length;
    solveLevel(session, 'l2');
    session.__test.step(400);
    expect(session.__test.level()).toBe('l3');
    expect(eventsOf(played).filter((event) => event === 'goal' || event === 'stamp').length).toBeGreaterThan(atStart);
    session.unmount();
    vi.restoreAllMocks();
  });

  it('announces a new chapter differently from a new question', async () => {
    const played = recordSounds();
    // l5 ends the first section, so l6 opens a new one.
    const { session } = await mountGame('l5', 'all');
    solveLevel(session, 'l5');
    session.__test.step(400);
    expect(session.__test.section()).toBe('Make the Number');
    expect(eventsOf(played)).toContain('stamp');
    session.unmount();
    vi.restoreAllMocks();
  });

  it('rings the bell only after the plank settles', async () => {
    const played = recordSounds();
    const { session } = await mountGame('l1');
    session.__test.place(0, 'right');
    session.__test.step(1);
    expect(eventsOf(played)).not.toContain('ding');
    session.__test.step(200);
    expect(eventsOf(played)).toContain('ding');
    session.unmount();
    vi.restoreAllMocks();
  });

  it('moves on to the next level after the dance', async () => {
    const { session } = await mountGame('l1', 'all');
    solveLevel(session, 'l1');
    session.__test.step(400);
    expect(session.__test.level()).toBe('l2');
    expect(session.__test.status()).toBe('playing');
    session.unmount();
  });

  it('leaves the game when the last unlocked level is finished', async () => {
    const { host, session } = await mountGame('l1');
    solveLevel(session, 'l1');
    session.__test.step(400);
    expect(host.exited).toBeGreaterThan(0);
    session.unmount();
  });
});

describe('what the animals sound like', () => {
  it('speaks when an animal is picked up', async () => {
    const played = recordSounds();
    const { session } = await mountGame('l5');
    session.__test.pick(0);
    // Touching the animal is enough: a child who cannot read the number can
    // still hear which one they are holding.
    expect(eventsOf(played).some((event) => event.startsWith('voice:'))).toBe(true);
    session.unmount();
    vi.restoreAllMocks();
  });

  it('speaks again as it lands', async () => {
    const played = recordSounds();
    const { session } = await mountGame('l1');
    session.__test.place(0, 'right');
    expect(eventsOf(played)).toContain('voice:chicken');
    session.unmount();
    vi.restoreAllMocks();
  });
});

describe('taking animals off', () => {
  it('refuses to lift an animal the level started with, on most levels', async () => {
    const { session } = await mountGame('l1');
    const before = session.__test.placedSpecies().length;
    session.__test.takeBack('init-left-0');
    expect(session.__test.placedSpecies()).toHaveLength(before);
    session.unmount();
  });

  it('allows it in the section built around subtraction', async () => {
    const { session } = await mountGame('l22');
    // 7 against 5: lifting the cat off balances it, which is the only way
    // through, so a cleared level proves the removal was allowed.
    session.__test.takeBack('init-left-1');
    expect(session.__test.status()).toBe('won');
    session.unmount();
  });

  it('takes a whole group back, since it was picked up as one', async () => {
    const { session } = await mountGame('l16');
    session.__test.place(0, 'right');
    const placed = session.__test.placedSpecies().length;
    expect(placed).toBeGreaterThan(2);
    session.__test.takeBack('tray-0#0');
    // The whole group left together, back to the tray.
    expect(session.__test.placedSpecies()).toHaveLength(2);
    session.unmount();
  });
});
