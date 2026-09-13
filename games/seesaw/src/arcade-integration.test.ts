// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { seesawGame } from './index.js';
import { ARCADE_LEVELS } from './logic/levels.data.js';
import { createTestHost } from './test-host.js';
import { installCanvasStub } from './canvas-stub.js';
import * as sounds from './audio/seesaw-sounds.js';
import { weightOf } from './logic/animals.js';

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

const mountArcade = async (startLevel: string, unlocked: 'all' | readonly string[] = [`seesaw:${startLevel}`]) => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const host = createTestHost({ unlocked });
  const session = await seesawGame.mount(container, host, { startLevel });
  return { container, host, session };
};

const FRAMES_PER_SECOND = 60;

type Session = Awaited<ReturnType<typeof mountArcade>>['session'];

/** One competent move: whichever side leaves the seesaw closest to level. */
const playOneMove = (session: Session): void => {
  const next = session.__test.queue()[0];
  if (!next) return;
  const difference = session.__test.balanceDifference();
  const weight = weightOf(next);
  session.__test.drop(Math.abs(difference + weight) <= Math.abs(difference - weight) ? 'left' : 'right');
};

/** Plays the mounted game competently, a frame at a time. */
const playFor = (session: Session, seconds: number) => {
  for (let frame = 0; frame < seconds * FRAMES_PER_SECOND; frame++) {
    session.__test.step(1);
    if (session.__test.status() !== 'playing') continue;
    playOneMove(session);
  }
};

describe('arcade levels through the real module', () => {
  it.each(ARCADE_LEVELS.map((level) => [level.id] as const))('%s mounts with a queue to plan against', async (id) => {
    const { session } = await mountArcade(id);
    expect(session.__test.queueLength()).toBeGreaterThan(1);
    expect(session.__test.status()).toBe('playing');
    session.unmount();
  });

  it('places the waiting animal when a side is tapped, with no picking up first', async () => {
    const { session } = await mountArcade('level-6');
    const before = session.__test.queueLength();
    session.__test.drop('left');
    expect(session.__test.queueLength()).toBe(before - 1);
    session.unmount();
  });

  it('survives a round played sensibly, then moves on', async () => {
    const played = recordSounds();
    const { session } = await mountArcade('level-6', 'all');
    playFor(session, 32);
    expect(played).toContain('success');
    session.__test.step(240);
    expect(session.__test.level()).toBe('level-7');
    session.unmount();
    vi.restoreAllMocks();
  });

  it('ends a round that is ignored, then offers it again', async () => {
    const played = recordSounds();
    const { session } = await mountArcade('level-6');
    // Do nothing at all: animals climb on by themselves and pile up.
    for (let i = 0; i < 60 * 40 && session.__test.status() === 'playing'; i++) session.__test.step(1);
    expect(session.__test.status()).toBe('lost');
    expect(played).toContain('tumble');

    // The same level starts again rather than ending the child's turn.
    session.__test.step(60 * 4);
    expect(session.__test.level()).toBe('level-6');
    expect(session.__test.status()).toBe('playing');
    session.unmount();
    vi.restoreAllMocks();
  });

  it('shows the danger meter filling before a round is lost', async () => {
    const { session } = await mountArcade('level-6');
    let peak = 0;
    for (let i = 0; i < 60 * 40 && session.__test.status() === 'playing'; i++) {
      session.__test.step(1);
      peak = Math.max(peak, session.__test.danger());
    }
    expect(peak).toBeGreaterThan(0.9);
    session.unmount();
  });

  it('does not offer a take-back in the arcade', async () => {
    const { session } = await mountArcade('level-6');
    session.__test.drop('left');
    const placedUid = 'arcade-0';
    session.__test.takeBack(placedUid);
    session.__test.step(1);
    // Nothing was removed: the arcade recovers by placing, not by undoing.
    expect(session.__test.status()).toBe('playing');
    session.unmount();
  });

  it('keeps rendering through a whole arcade round', async () => {
    const { container, session } = await mountArcade('level-6');
    const canvas = container.querySelector('canvas')!;
    const ctx = canvas.getContext('2d') as unknown as { __calls: string[] };
    playFor(session, 5);
    expect(ctx.__calls.length).toBeGreaterThan(1000);
    session.unmount();
  });
});

describe('the windy day and the endless park', () => {
  it('warns before the wind pushes, and sounds it', async () => {
    const played = recordSounds();
    const { session } = await mountArcade('level-9');
    expect(session.__test.windPhase()).toBe('calm');

    let sawWarning = false;
    let sawBlowing = false;
    for (let i = 0; i < 60 * 20 && !sawBlowing; i++) {
      session.__test.step(1);
      if (session.__test.windPhase() === 'warning') sawWarning = true;
      if (session.__test.windPhase() === 'blowing') sawBlowing = true;
      playOneMove(session);
    }
    expect(sawWarning).toBe(true);
    expect(sawBlowing).toBe(true);
    // The warning is heard, not merely seen.
    expect(played).toContain('gust');
    session.unmount();
    vi.restoreAllMocks();
  });

  it('lets the wind tip a seesaw the animals had balanced', async () => {
    const { session } = await mountArcade('level-9');
    let tippedByWindAlone = false;
    for (let i = 0; i < 60 * 30 && !tippedByWindAlone; i++) {
      session.__test.step(1);
      // Play it properly, so any lean while the gust blows is the weather's
      // doing rather than a pile-up of the child's own making.
      playOneMove(session);
      if (session.__test.windPhase() === 'blowing' && session.__test.zone() !== 'green') {
        tippedByWindAlone = true;
      }
    }
    expect(tippedByWindAlone).toBe(true);
    session.unmount();
  });

  it('runs the park endlessly, with no progress to complete', async () => {
    const { session } = await mountArcade('level-10');
    expect(session.__test.survivalSeconds()).not.toBeNull();
    session.__test.step(120);
    expect(session.__test.survivalSeconds()).toBeGreaterThan(1);
    expect(session.__test.status()).toBe('playing');
    session.unmount();
  });

  it('remembers the best run and offers the park again', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const host = createTestHost({ unlocked: 'all' });

    const first = await seesawGame.mount(container, host, { startLevel: 'level-10' });
    expect(first.__test.bestSeconds()).toBeNull();
    // Ignore it until the round is lost, which records whatever it managed.
    for (let i = 0; i < 60 * 120 && first.__test.status() === 'playing'; i++) first.__test.step(1);
    expect(first.__test.status()).toBe('lost');
    first.__test.step(60 * 4);
    // The park comes round again rather than moving on: there is nowhere to go.
    expect(first.__test.level()).toBe('level-10');
    expect(first.__test.bestSeconds()).toBeGreaterThan(0);
    first.unmount();

    // And the record survives leaving the game and coming back.
    const second = await seesawGame.mount(container, host, { startLevel: 'level-10' });
    expect(second.__test.bestSeconds()).toBeGreaterThan(0);
    second.unmount();
  });
});

describe('making the arcade legible', () => {
  it('offers a placement hint until the player has got the idea', async () => {
    const { session } = await mountArcade('level-6');
    session.__test.step(2);
    expect(session.__test.showPlacementHint()).toBe(true);
    playOneMove(session);
    playOneMove(session);
    session.__test.step(2);
    // Two placements in, the arrows stand down.
    expect(session.__test.showPlacementHint()).toBe(false);
    session.unmount();
  });

  it('counts the round down rather than only filling a bar', async () => {
    const { session } = await mountArcade('level-6');
    const atStart = session.__test.secondsRemaining()!;
    session.__test.step(120);
    expect(atStart).toBeGreaterThan(25);
    expect(session.__test.secondsRemaining()!).toBeLessThan(atStart);
  });

  it('is forgiving enough that the first arcade level survives some fumbling', async () => {
    const { session } = await mountArcade('level-6', 'all');
    // A player who is slow and only half paying attention: acts every second.
    for (let frame = 0; frame < 60 * 31; frame++) {
      session.__test.step(1);
      if (session.__test.status() !== 'playing') break;
      if (frame % 60 === 0) playOneMove(session);
    }
    expect(session.__test.status()).toBe('won');
    session.unmount();
  });
});

describe('Balance Rush', () => {
  /** Picks the queued animal and side that lands closest to level. */
  const playWithArithmetic = (session: Session): void => {
    const queue = session.__test.queue();
    if (queue.length === 0) return;
    const difference = session.__test.balanceDifference();
    const choices = session.__test.groupSize() > 0 ? Math.min(session.__test.groupSize(), queue.length) : queue.length;

    let best = { index: 0, side: 'left' as 'left' | 'right', outcome: Number.POSITIVE_INFINITY };
    for (let index = 0; index < choices; index++) {
      const weight = weightOf(queue[index]!);
      for (const side of ['left', 'right'] as const) {
        const outcome = Math.abs(difference + (side === 'left' ? weight : -weight));
        if (outcome < best.outcome) best = { index, side, outcome };
      }
    }
    session.__test.pick(best.index);
    session.__test.drop(best.side);
  };

  const playRush = (session: Session, seconds: number) => {
    for (let frame = 0; frame < seconds * FRAMES_PER_SECOND; frame++) {
      session.__test.step(1);
      if (session.__test.status() !== 'playing') break;
      if (frame % 96 === 0) playWithArithmetic(session);
    }
  };

  it('offers a hand of animals to choose from, not just the next one', async () => {
    const { session } = await mountArcade('level-7');
    session.__test.step(60 * 4);
    expect(session.__test.queue().length).toBeGreaterThan(1);
    session.unmount();
  });

  it('places the animal the player chose, not the first one', async () => {
    const { session } = await mountArcade('level-7');
    session.__test.step(60 * 4);
    // Copy it: the hand is live state, and it changes under the assertion.
    const queue = [...session.__test.queue()];
    const wanted = queue[queue.length - 1]!;
    session.__test.pick(queue.length - 1);
    session.__test.drop('right');
    // The chosen one is on the plank and gone from the hand.
    expect(session.__test.queue()).toHaveLength(queue.length - 1);
    expect(session.__test.placedSpecies()).toContain(wanted);
    session.unmount();
  });

  it('rings the bell, clears the plank and sets a fresh gap', async () => {
    const played = recordSounds();
    const { session } = await mountArcade('level-7');
    let rang = false;
    for (let frame = 0; frame < 60 * 40 && !rang; frame++) {
      session.__test.step(1);
      if (frame % 96 === 0) playWithArithmetic(session);
      if (session.__test.bells() > 0) rang = true;
    }
    expect(rang).toBe(true);
    // The bell waits for the plank to settle, as it always has.
    session.__test.step(120);
    expect(played).toContain('ding');

    // The animals hop off and a new gap is waiting to be closed.
    session.__test.step(120);
    expect(session.__test.balanceDifference()).not.toBe(0);
    session.unmount();
    vi.restoreAllMocks();
  });

  it('is won by ringing the bell the asked-for number of times', async () => {
    const { session } = await mountArcade('level-7', 'all');
    playRush(session, 44);
    expect(session.__test.bells()).toBeGreaterThanOrEqual(5);
    expect(session.__test.status()).toBe('won');
    session.unmount();
  });

  it('keeps a family together until every one of them is seated', async () => {
    const { session } = await mountArcade('level-8');
    let sawFamily = false;
    for (let frame = 0; frame < 60 * 30 && !sawFamily; frame++) {
      session.__test.step(1);
      if (session.__test.groupSize() > 1) sawFamily = true;
      else if (frame % 96 === 0) playWithArithmetic(session);
    }
    expect(sawFamily).toBe(true);

    // While a family waits, only its members can be chosen.
    const size = session.__test.groupSize();
    session.__test.pick(size + 1);
    expect(session.__test.selectedQueueIndex()).toBeLessThan(size);
    session.unmount();
  });
});
