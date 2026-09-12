// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { seesawGame } from './index.js';
import { ARCADE_LEVELS } from './logic/levels.data.js';
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

const mountArcade = async (startLevel: string, unlocked: 'all' | readonly string[] = [`seesaw:${startLevel}`]) => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const host = createTestHost({ unlocked });
  const session = await seesawGame.mount(container, host, { startLevel });
  return { container, host, session };
};

const FRAMES_PER_SECOND = 60;

/** Plays the mounted game competently, a frame at a time. */
const playFor = (session: Awaited<ReturnType<typeof mountArcade>>['session'], seconds: number) => {
  for (let frame = 0; frame < seconds * FRAMES_PER_SECOND; frame++) {
    session.__test.step(1);
    if (session.__test.status() !== 'playing') continue;
    if (session.__test.queueLength() > 0) {
      // Nudge it towards level, which is all a competent child does.
      session.__test.drop(session.__test.zone() === 'green' ? 'left' : 'right');
    }
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
