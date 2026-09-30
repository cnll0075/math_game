import { describe, it, expect } from 'vitest';
import { createAudioBus } from '@bundle/core';
import { fakeContext } from '../../../../packages/core/src/audio/fake-context.js';
import { createBalloonSoundPack, SOUND_EVENTS } from './balloon-sounds.js';

const packOnFakes = async () => {
  const bus = createAudioBus(() => fakeContext() as unknown as AudioContext);
  await bus.unlock();
  return createBalloonSoundPack(bus);
};

describe('the balloon sound pack', () => {
  it('has a voice for every sound the game asks for', async () => {
    const pack = await packOnFakes();
    for (const event of SOUND_EVENTS) expect(() => pack.play(event, { step: 2 })).not.toThrow();
  });

  it('names the moments the design cares about', () => {
    for (const event of ['clip', 'pop', 'count', 'float', 'strain', 'whoosh', 'cheer', 'chapter']) {
      expect(SOUND_EVENTS).toContain(event);
    }
  });

  it('shrugs off an event it has never heard of', async () => {
    const pack = await packOnFakes();
    expect(() => pack.play('nonsense')).not.toThrow();
  });

  it('stays silent rather than throwing before the context is unlocked', () => {
    expect(() => createBalloonSoundPack(createAudioBus(() => null)).play('pop')).not.toThrow();
  });
});
