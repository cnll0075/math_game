import { noiseBurst, tone, type AudioBus, type SoundPack } from '@bundle/core';

/**
 * Every sound the picnic can make, by name. A later pack backed by recorded
 * samples implements the same names and swaps in with one line of setup.
 */
export const SOUND_EVENTS: readonly string[] = ['level', 'pop', 'whoosh', 'nope', 'woof', 'chop', 'munch', 'cheer', 'star'];

type Voice = (bus: AudioBus, delay: number, step: number) => void;

/** A round begins: a little rising fanfare. */
const level: Voice = (bus, delay) => {
  [523.25, 659.25, 783.99].forEach((freq, index) => tone(bus, { freq, duration: 0.24, type: 'triangle', gain: 0.14, delay: delay + index * 0.1 }));
};
/** A treat lands on a plate; a little higher for each one on it. */
const pop: Voice = (bus, delay, step) =>
  tone(bus, { freq: 520 * Math.pow(2, Math.min(12, step) / 12), duration: 0.08, type: 'sine', gain: 0.12, sweepTo: 760, delay });
/** A share flies. */
const whoosh: Voice = (bus, delay) => noiseBurst(bus, { duration: 0.3, gain: 0.06, filterHz: 1400, sweepTo: 3200, delay });
/** Uh-uh: not that one, or not enough. Soft, never a buzzer. */
const nope: Voice = (bus, delay) => {
  tone(bus, { freq: 392, duration: 0.12, type: 'sine', gain: 0.1, delay });
  tone(bus, { freq: 330, duration: 0.16, type: 'sine', gain: 0.1, delay: delay + 0.14 });
};
/** Biscuit. */
const woof: Voice = (bus, delay) => {
  tone(bus, { freq: 300, duration: 0.09, type: 'sawtooth', gain: 0.07, sweepTo: 180, delay });
  tone(bus, { freq: 320, duration: 0.11, type: 'sawtooth', gain: 0.07, sweepTo: 170, delay: delay + 0.16 });
};
/** A knife through pizza or cake. */
const chop: Voice = (bus, delay) => noiseBurst(bus, { duration: 0.14, gain: 0.1, filterHz: 2600, sweepTo: 900, delay });
/** Everyone eating. */
const munch: Voice = (bus, delay) => {
  [0, 0.18, 0.36, 0.6, 0.78].forEach((at) => noiseBurst(bus, { duration: 0.06, gain: 0.06, filterHz: 900, delay: delay + at }));
};
/** Everyone has the same! */
const cheer: Voice = (bus, delay) => {
  [523.25, 659.25, 783.99, 1046.5].forEach((freq, index) => tone(bus, { freq, duration: 0.3, type: 'triangle', gain: 0.15, delay: delay + index * 0.09 }));
};
const star: Voice = (bus, delay, step) => tone(bus, { freq: 880 + step * 220, duration: 0.2, type: 'sine', gain: 0.14, delay });

const VOICES: Record<string, Voice> = { level, pop, whoosh, nope, woof, chop, munch, cheer, star };

export function createPicnicSoundPack(bus: AudioBus): SoundPack {
  return {
    async preload() {
      // Synthesised on demand; nothing to fetch.
    },
    play(event, params) {
      VOICES[event]?.(bus, Math.max(0, params?.delay ?? 0), params?.step ?? 0);
    },
  };
}
