import { describe, it, expect, vi, afterEach } from 'vitest';
import { createAudioBus } from './audio-bus.js';
import { fakeContext, type FakeContext } from './fake-context.js';
import { createSampleSoundPack } from './samples.js';
import type { SoundPack } from './sound-pack.js';

const recorder = (): SoundPack & { played: string[] } => {
  const played: string[] = [];
  return {
    played,
    async preload() {},
    play: (event: string) => void played.push(event),
  };
};

const serving = (): void => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(64) })),
  );
};

/** A bus with sound already switched on, as it is after the first tap. */
const setup = async (): Promise<{ context: FakeContext; bus: ReturnType<typeof createAudioBus> }> => {
  const context = fakeContext();
  const bus = createAudioBus(() => context as unknown as AudioContext);
  await bus.unlock();
  return { context, bus };
};

/** Lets the pack's background decoding finish. */
const settle = async (): Promise<void> => {
  for (let i = 0; i < 4; i += 1) await Promise.resolve();
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the sample sound pack', () => {
  it('plays a recording for an event it has one for', async () => {
    serving();
    const { context, bus } = await setup();
    const pack = createSampleSoundPack(bus, { sources: { moo: '/moo.wav' }, fallback: recorder() });
    await pack.preload();
    pack.play('moo');
    expect(context.createdBufferSources).toHaveLength(1);
  });

  it('hands every other event to the pack underneath', async () => {
    serving();
    const { context, bus } = await setup();
    const fallback = recorder();
    const pack = createSampleSoundPack(bus, { sources: { moo: '/moo.wav' }, fallback });
    await pack.preload();
    pack.play('ding');
    expect(fallback.played).toEqual(['ding']);
    expect(context.createdBufferSources).toHaveLength(0);
  });

  it('stands in with the pack underneath until the recordings have loaded', async () => {
    serving();
    const { bus } = await setup();
    const fallback = recorder();
    const pack = createSampleSoundPack(bus, { sources: { moo: '/moo.wav' }, fallback });
    // No preload: the game is playable from the first frame either way.
    pack.play('moo');
    expect(fallback.played).toEqual(['moo']);
  });

  it('keeps using the pack underneath when a file cannot be fetched', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, arrayBuffer: async () => new ArrayBuffer(0) })));
    const { bus } = await setup();
    const fallback = recorder();
    const pack = createSampleSoundPack(bus, { sources: { moo: '/moo.wav' }, fallback });
    await pack.preload();
    pack.play('moo');
    expect(fallback.played).toEqual(['moo']);
  });

  it('survives a fetch that throws', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    const { bus } = await setup();
    const fallback = recorder();
    const pack = createSampleSoundPack(bus, { sources: { moo: '/moo.wav' }, fallback });
    await expect(pack.preload()).resolves.toBeUndefined();
    pack.play('moo');
    expect(fallback.played).toEqual(['moo']);
  });

  it('schedules a delayed cry into the future, never into the past', async () => {
    serving();
    const { context, bus } = await setup();
    context.currentTime = 4;
    const pack = createSampleSoundPack(bus, { sources: { moo: '/moo.wav' }, fallback: recorder() });
    await pack.preload();
    pack.play('moo', { delay: 0.25 });
    pack.play('moo', { delay: -3 });
    const [delayed, backwards] = context.createdBufferSources as Array<{ startedAt: number }>;
    expect(delayed!.startedAt).toBeCloseTo(4.25);
    expect(backwards!.startedAt).toBeCloseTo(4);
  });

  it('plays a recording at the level asked for', async () => {
    serving();
    const { context, bus } = await setup();
    const pack = createSampleSoundPack(bus, {
      sources: { moo: '/moo.wav' },
      gain: { moo: 0.4 },
      fallback: recorder(),
    });
    await pack.preload();
    pack.play('moo');
    expect(context.createdGains.at(-1)!.gain.value).toBeCloseTo(0.4);
  });

  it('falls back rather than throwing when there is no audio at all', async () => {
    serving();
    const bus = createAudioBus(() => null);
    await bus.unlock();
    const fallback = recorder();
    const pack = createSampleSoundPack(bus, { sources: { moo: '/moo.wav' }, fallback });
    await pack.preload();
    expect(() => pack.play('moo')).not.toThrow();
    expect(fallback.played).toEqual(['moo']);
  });

  it('loads before the first tap, and plays once there is a context to play through', async () => {
    // Preloading happens at startup; a browser will not start an audio context
    // until the user asks for sound. The recordings have to survive that gap.
    serving();
    const context = fakeContext();
    const bus = createAudioBus(() => context as unknown as AudioContext);
    const fallback = recorder();
    const pack = createSampleSoundPack(bus, { sources: { moo: '/moo.wav' }, fallback });

    await pack.preload();
    expect(bus.context).toBeNull();
    pack.play('moo');
    expect(fallback.played).toEqual(['moo']);

    await bus.unlock();
    pack.play('moo');
    await settle();
    pack.play('moo');
    expect(context.createdBufferSources).toHaveLength(1);
  });
});
