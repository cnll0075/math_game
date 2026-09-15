// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { seesawGame } from './index.js';
import { createTestHost } from './test-host.js';
import { installCanvasStub } from './canvas-stub.js';
import * as sounds from './audio/seesaw-sounds.js';

let restoreCanvas: () => void;
beforeAll(() => {
  restoreCanvas = installCanvasStub();
});
afterAll(() => restoreCanvas());

/** Records what the game plays, without touching the audio bus. */
const spyOnSounds = () => {
  const played: string[] = [];
  vi.spyOn(sounds, 'createSeesawSoundPack').mockReturnValue({
    preload: async () => {},
    play: (event: string) => void played.push(event),
  });
  return played;
};

const mountGame = async (options?: { startLevel?: string; unlocked?: 'all' | readonly string[] }) => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const host = createTestHost({ unlocked: options?.unlocked });
  const session = await seesawGame.mount(container, host, { startLevel: options?.startLevel });
  return { container, host, session };
};

describe('seesaw game module', () => {
  it('declares itself to the shell', () => {
    expect(seesawGame.id).toBe('seesaw');
    expect(seesawGame.title).toBeTruthy();
  });

  it('mounts a canvas and unmounts cleanly', async () => {
    const { container, session } = await mountGame();
    expect(container.querySelector('canvas')).not.toBeNull();
    session.unmount();
    expect(container.childElementCount).toBe(0);
  });

  it('removes every listener it added', async () => {
    // Count real registrations by calling through, so unmount is genuinely
    // balanced rather than merely symmetrical against a stub.
    const live = new Map<string, number>();
    const originalAdd = EventTarget.prototype.addEventListener;
    const originalRemove = EventTarget.prototype.removeEventListener;
    const bump = (type: string, delta: number) => live.set(type, (live.get(type) ?? 0) + delta);

    const addSpy = vi
      .spyOn(EventTarget.prototype, 'addEventListener')
      .mockImplementation(function (this: EventTarget, type: string, listener: never, options: never) {
        bump(type, 1);
        return originalAdd.call(this, type, listener, options);
      } as never);
    const removeSpy = vi
      .spyOn(EventTarget.prototype, 'removeEventListener')
      .mockImplementation(function (this: EventTarget, type: string, listener: never, options: never) {
        bump(type, -1);
        return originalRemove.call(this, type, listener, options);
      } as never);

    const { session } = await mountGame();
    expect([...live.values()].some((count) => count > 0)).toBe(true);
    session.unmount();
    addSpy.mockRestore();
    removeSpy.mockRestore();

    expect([...live.entries()].filter(([, count]) => count !== 0)).toEqual([]);
  });

  it('opens the first level by default and the requested one when asked', async () => {
    const first = await mountGame();
    expect(first.session.__test.level()).toBe('l1');
    first.session.unmount();

    const requested = await mountGame({ startLevel: 'l3' });
    expect(requested.session.__test.level()).toBe('l3');
    requested.session.unmount();
  });

  it('opens the first unlocked level when earlier ones are locked', async () => {
    const { session } = await mountGame({ unlocked: ['seesaw:l3'] });
    expect(session.__test.level()).toBe('l3');
    session.unmount();
  });

  it('rings the bell only after the plank settles', async () => {
    const played = spyOnSounds();
    const { session } = await mountGame({ startLevel: 'l3' });
    session.__test.place(0, 'right');
    session.__test.place(1, 'right');
    session.__test.step(1);
    expect(played).not.toContain('ding');
    session.__test.step(200);
    expect(played).toContain('ding');
    session.unmount();
    vi.restoreAllMocks();
  });

  it('a group of animals lands as one animal, not as a pile-up', async () => {
    // l16's tray offers ready-made groups. Four cats arriving at once used to
    // be four meows, four thuds and four creaks on top of each other.
    const played = spyOnSounds();
    const { session } = await mountGame({ startLevel: 'l16' });
    session.__test.place(2, 'right');
    expect(played.filter((event) => event === 'land')).toHaveLength(1);
    expect(played.filter((event) => event === 'creak')).toHaveLength(1);
    session.unmount();
    vi.restoreAllMocks();
  });

  it('speaks when an animal is touched, and lets it land quietly', async () => {
    // Picking one up says which animal it is, for a child who cannot read the
    // number. Landing has a thud and a creak already; a second cry on top of
    // them was the same animal saying the same thing twice in a second.
    const played = spyOnSounds();
    const { session } = await mountGame({ startLevel: 'l16' });
    session.__test.place(2, 'right');
    expect(played.filter((event) => event === 'voice:cat')).toHaveLength(1);
    session.unmount();
    vi.restoreAllMocks();
  });

  it('cheers once per kind of animal on the plank, not once per animal', async () => {
    const played = spyOnSounds();
    const { session } = await mountGame({ startLevel: 'l16' });
    // Two dogs already sitting there, and a group of three cats answers it.
    session.__test.place(1, 'right');
    session.__test.step(200);
    // One cat and one dog in the chorus, not three cats and two dogs.
    expect(played.filter((event) => event === 'voice:cat')).toHaveLength(2);
    expect(played.filter((event) => event === 'voice:dog')).toHaveLength(1);
    expect(played).toContain('success');
    session.unmount();
    vi.restoreAllMocks();
  });

  it('warns when the seesaw enters the red zone', async () => {
    const played = spyOnSounds();
    // This one starts level, so piling one side up is a real transition into
    // trouble rather than a state it began in.
    const { session } = await mountGame({ startLevel: 'l26' });
    session.__test.place(0, 'left');
    session.__test.place(1, 'left');
    expect(session.__test.zone()).toBe('red');
    expect(played).toContain('danger');
    expect(session.__test.inDanger()).toBe(true);
    session.unmount();
    vi.restoreAllMocks();
  });

  it('pauses and resumes the frame loop', async () => {
    const { session } = await mountGame();
    session.pause();
    session.resume();
    session.unmount();
  });

  it('actually renders frames', async () => {
    const { container, session } = await mountGame();
    const canvas = container.querySelector('canvas')!;
    const ctx = canvas.getContext('2d') as unknown as { __calls?: string[] };
    expect(() => session.__test.step(120)).not.toThrow();
    expect(ctx.__calls!.length).toBeGreaterThan(100);
    session.unmount();
  });
});
