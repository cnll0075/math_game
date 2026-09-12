import { describe, it, expect } from 'vitest';
import { createAudioBus } from '@bundle/core';
import { fakeContext } from '../../../../packages/core/src/audio/fake-context.js';
import { createSynthSoundPack, SOUND_EVENTS } from './seesaw-sounds.js';

const unlockedBus = async () => {
  const context = fakeContext();
  const bus = createAudioBus(() => context as unknown as AudioContext);
  await bus.unlock();
  return { bus, context };
};

describe('synth sound pack', () => {
  it('catalogues an event for every game moment', () => {
    expect(SOUND_EVENTS).toContain('ding');
    expect(SOUND_EVENTS).toContain('creak');
    expect(SOUND_EVENTS).toContain('danger');
    expect(SOUND_EVENTS).toContain('success');
    expect(SOUND_EVENTS).toContain('cheer');
    expect(SOUND_EVENTS).toContain('chirp:rabbit');
    expect(new Set(SOUND_EVENTS).size).toBe(SOUND_EVENTS.length);
  });

  it('plays every catalogued event without throwing', async () => {
    const { bus, context } = await unlockedBus();
    const pack = createSynthSoundPack(bus);
    for (const event of SOUND_EVENTS) expect(() => pack.play(event), event).not.toThrow();
    expect(context.createdOscillators.length).toBeGreaterThanOrEqual(SOUND_EVENTS.length);
  });

  it('gives the ding at least two partials', async () => {
    const { bus, context } = await unlockedBus();
    createSynthSoundPack(bus).play('ding');
    expect(context.createdOscillators.length).toBeGreaterThanOrEqual(2);
  });

  it('gives each animal its own pitch', async () => {
    const { bus, context } = await unlockedBus();
    const pack = createSynthSoundPack(bus);
    pack.play('chirp:rabbit');
    const rabbitFundamental = context.createdOscillators[0]!.frequency.value;
    const afterRabbit = context.createdOscillators.length;
    pack.play('chirp:bear');
    const bearFundamental = context.createdOscillators[afterRabbit]!.frequency.value;
    expect(rabbitFundamental).toBeGreaterThan(bearFundamental);
  });

  it('stays silent and safe before unlock', () => {
    const pack = createSynthSoundPack(createAudioBus(() => null));
    for (const event of SOUND_EVENTS) expect(() => pack.play(event), event).not.toThrow();
  });

  it('ignores an unknown event', async () => {
    const { bus, context } = await unlockedBus();
    expect(() => createSynthSoundPack(bus).play('nope')).not.toThrow();
    expect(context.createdOscillators).toHaveLength(0);
  });

  it('schedules a delayed sound into the future', async () => {
    const { bus, context } = await unlockedBus();
    const pack = createSynthSoundPack(bus);
    context.currentTime = 10;
    pack.play('chirp:cat', { delay: 0.5 });
    // A delayed voice is scheduled ahead of the clock rather than played now,
    // which is what lets the dance stagger without timers.
    expect(context.createdOscillators[0]!.startedAt).toBeCloseTo(10.5, 3);
  });

  it('treats a negative delay as immediate', async () => {
    const { bus, context } = await unlockedBus();
    context.currentTime = 4;
    createSynthSoundPack(bus).play('ding', { delay: -3 });
    expect(context.createdOscillators[0]!.startedAt).toBeCloseTo(4, 3);
  });

  it('preloads immediately', async () => {
    const { bus } = await unlockedBus();
    await expect(createSynthSoundPack(bus).preload()).resolves.toBeUndefined();
  });
});
