// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { seesawGame } from './index.js';
import { LEVELS, getLevel, solutionsFor } from './logic/levels.data.js';
import { roundCount } from './logic/level.js';
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

/** Plays one round using the solver's answer. */
const solveRound = (session: Session, levelId: string, round: number): void => {
  const solution = solutionsFor(getLevel(levelId)!, round)[0]!;
  for (const move of solution) {
    if (move.kind === 'place') session.__test.place(move.trayIndex, move.side);
    else session.__test.takeBack(move.uid);
    session.__test.step(20);
  }
};

const solveLevel = (session: Session, levelId: string): void => {
  for (let round = 0; round < roundCount(getLevel(levelId)!); round++) solveRound(session, levelId, round);
};

describe('playing a level', () => {
  it.each(LEVELS.map((level) => [level.id] as const))(
    'plays every round of %s to completion through the real module',
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

  it('moves from round to round inside a level', async () => {
    const { session } = await mountGame('level-2');
    expect(session.__test.round()).toBe(0);
    solveRound(session, 'level-2', 0);
    expect(session.__test.round()).toBe(1);
    expect(session.__test.status()).toBe('playing');
    session.unmount();
  });

  it('stamps each round and announces the next one', async () => {
    const played = recordSounds();
    const { session } = await mountGame('level-2');
    session.__test.step(2);
    const goalsAtStart = eventsOf(played).filter((event) => event === 'goal').length;
    solveRound(session, 'level-2', 0);
    session.__test.step(10);
    expect(eventsOf(played)).toContain('stamp');
    expect(eventsOf(played).filter((event) => event === 'goal').length).toBeGreaterThan(goalsAtStart);
    session.unmount();
    vi.restoreAllMocks();
  });

  it('rings the bell only after the plank settles', async () => {
    const played = recordSounds();
    const { session } = await mountGame('level-1');
    session.__test.place(0, 'right');
    session.__test.step(1);
    expect(eventsOf(played)).not.toContain('ding');
    session.__test.step(200);
    expect(eventsOf(played)).toContain('ding');
    session.unmount();
    vi.restoreAllMocks();
  });

  it('moves on to the next level after the dance', async () => {
    const { session } = await mountGame('level-1', 'all');
    solveLevel(session, 'level-1');
    session.__test.step(400);
    expect(session.__test.level()).toBe('level-2');
    expect(session.__test.status()).toBe('playing');
    session.unmount();
  });

  it('leaves the game when the last unlocked level is finished', async () => {
    const { host, session } = await mountGame('level-1');
    solveLevel(session, 'level-1');
    session.__test.step(400);
    expect(host.exited).toBeGreaterThan(0);
    session.unmount();
  });
});

describe('what the animals sound like', () => {
  it('speaks when an animal is picked up', async () => {
    const played = recordSounds();
    const { session } = await mountGame('level-4');
    session.__test.pick(0);
    // Touching the animal is enough: a child who cannot read the number can
    // still hear which one they are holding.
    expect(eventsOf(played).some((event) => event.startsWith('voice:'))).toBe(true);
    session.unmount();
    vi.restoreAllMocks();
  });

  it('speaks again as it lands', async () => {
    const played = recordSounds();
    const { session } = await mountGame('level-1');
    session.__test.place(0, 'right');
    expect(eventsOf(played)).toContain('voice:chicken');
    session.unmount();
    vi.restoreAllMocks();
  });
});

describe('taking animals off', () => {
  it('refuses to lift an animal the round started with, on most levels', async () => {
    const { session } = await mountGame('level-1');
    const before = session.__test.placedSpecies().length;
    session.__test.takeBack('init-left-0');
    expect(session.__test.placedSpecies()).toHaveLength(before);
    session.unmount();
  });

  it('allows it on the level built around subtraction', async () => {
    const { session } = await mountGame('level-11');
    expect(session.__test.round()).toBe(0);
    // The round starts 7 against 5; lifting the cat off balances it, which is
    // the only way through, so a cleared round proves the removal was allowed.
    session.__test.takeBack('init-left-1');
    expect(session.__test.round()).toBe(1);
    session.unmount();
  });
});
