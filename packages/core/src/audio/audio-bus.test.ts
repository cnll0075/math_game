import { describe, it, expect } from 'vitest';
import { createAudioBus } from './audio-bus.js';
import { tone, noiseBurst } from './synth.js';
import { fakeContext } from './fake-context.js';

const busWith = async (context = fakeContext()) => {
  const bus = createAudioBus(() => context as unknown as AudioContext);
  await bus.unlock();
  return { bus, context };
};

describe('createAudioBus', () => {
  it('creates no context until unlocked', () => {
    const bus = createAudioBus(() => fakeContext() as unknown as AudioContext);
    expect(bus.context).toBeNull();
  });

  it('creates the context exactly once', async () => {
    let created = 0;
    const bus = createAudioBus(() => {
      created += 1;
      return fakeContext() as unknown as AudioContext;
    });
    await bus.unlock();
    await bus.unlock();
    expect(created).toBe(1);
  });

  it('routes through a master gain at the set volume', async () => {
    const { bus, context } = await busWith();
    bus.volume = 0.5;
    expect(context.createdGains[0]!.gain.value).toBeCloseTo(0.5);
  });

  it('drops output to zero when muted', async () => {
    const { bus, context } = await busWith();
    bus.muted = true;
    expect(context.createdGains[0]!.gain.value).toBe(0);
    bus.muted = false;
    expect(context.createdGains[0]!.gain.value).toBeCloseTo(bus.volume);
  });

  it('never throws when the context cannot be created', async () => {
    const bus = createAudioBus(() => null);
    await expect(bus.unlock()).resolves.toBeUndefined();
    expect(bus.context).toBeNull();
    expect(() => tone(bus, { freq: 440, duration: 0.1 })).not.toThrow();
    expect(() => noiseBurst(bus, { duration: 0.1 })).not.toThrow();
  });

  it('survives a factory that throws', async () => {
    const bus = createAudioBus(() => {
      throw new Error('no audio on this device');
    });
    await expect(bus.unlock()).resolves.toBeUndefined();
    expect(bus.context).toBeNull();
  });
});

describe('synth voices', () => {
  it('tone schedules one oscillator with an envelope', async () => {
    const { bus, context } = await busWith();
    tone(bus, { freq: 880, duration: 0.2 });
    expect(context.createdOscillators).toHaveLength(1);
    expect(context.createdOscillators[0]!.frequency.value).toBe(880);
    expect(context.createdOscillators[0]!.started).toBe(true);
    expect(context.createdOscillators[0]!.stopped).toBe(true);
  });

  it('tone sweeps the frequency when asked', async () => {
    const { bus, context } = await busWith();
    tone(bus, { freq: 400, duration: 0.2, sweepTo: 200 });
    expect(context.createdOscillators[0]!.frequency.calls).toContain('exponentialRampToValueAtTime');
  });

  it('noiseBurst builds a buffer source through a filter', async () => {
    const { bus, context } = await busWith();
    noiseBurst(bus, { duration: 0.2, filterHz: 800 });
    expect(context.createdBufferSources).toHaveLength(1);
    expect(context.createdFilters).toHaveLength(1);
  });

  it('plays nothing before unlock', () => {
    const bus = createAudioBus(() => fakeContext() as unknown as AudioContext);
    expect(() => tone(bus, { freq: 440, duration: 0.1 })).not.toThrow();
    expect(bus.context).toBeNull();
  });
});
