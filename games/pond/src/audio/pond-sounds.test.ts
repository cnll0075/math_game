import { describe, it, expect } from 'vitest';
import { createAudioBus } from '@bundle/core';
import { fakeContext } from '../../../../packages/core/src/audio/fake-context.js';
import { createPondSoundPack, SOUND_EVENTS } from './pond-sounds.js';

describe('the pond sound pack', () => {
  it('has a voice for every sound the game asks for', async () => {
    const bus = createAudioBus(() => fakeContext() as unknown as AudioContext);
    await bus.unlock();
    const pack = createPondSoundPack(bus);
    for (const event of SOUND_EVENTS) expect(() => pack.play(event, { step: 1 })).not.toThrow();
    expect(() => pack.play('nonsense')).not.toThrow();
  });

  it('names the moments the design cares about', () => {
    for (const event of ['flip', 'match', 'miss', 'cleared', 'board']) expect(SOUND_EVENTS).toContain(event);
  });

  it('stays silent rather than throwing before the context is unlocked', () => {
    expect(() => createPondSoundPack(createAudioBus(() => null)).play('match')).not.toThrow();
  });
});
