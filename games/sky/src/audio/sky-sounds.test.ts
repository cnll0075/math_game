import { describe, it, expect } from 'vitest';
import { createAudioBus } from '@bundle/core';
import { fakeContext } from '../../../../packages/core/src/audio/fake-context.js';
import { createSkySoundPack, SOUND_EVENTS } from './sky-sounds.js';

const packOnFakes = async () => {
  const bus = createAudioBus(() => fakeContext() as unknown as AudioContext);
  await bus.unlock();
  return { bus, pack: createSkySoundPack(bus) };
};

describe('the sky sound pack', () => {
  it('has a voice for every sound the game asks for', async () => {
    const { pack } = await packOnFakes();
    for (const event of SOUND_EVENTS) expect(() => pack.play(event)).not.toThrow();
  });

  it('names the moments the design cares about', () => {
    for (const event of ['fire', 'destroy', 'damage', 'jam', 'escape', 'band', 'over', 'split', 'healed']) {
      expect(SOUND_EVENTS).toContain(event);
    }
  });

  it('shrugs off an event it has never heard of', async () => {
    const { pack } = await packOnFakes();
    expect(() => pack.play('nonsense')).not.toThrow();
  });

  it('stays silent rather than throwing before the context is unlocked', () => {
    const bus = createAudioBus(() => null);
    const pack = createSkySoundPack(bus);
    expect(() => pack.play('destroy')).not.toThrow();
  });

  it('needs nothing fetched', async () => {
    const { pack } = await packOnFakes();
    await expect(pack.preload()).resolves.toBeUndefined();
  });
});
