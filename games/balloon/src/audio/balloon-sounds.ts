import { noiseBurst, tone, type AudioBus, type SoundPack } from '@bundle/core';

/**
 * Every sound the game can make, by name. A later pack backed by recorded
 * samples implements the same names and swaps in with one line of setup.
 */
export const SOUND_EVENTS: readonly string[] = [
  'clip', 'unclip', 'full', 'pop', 'reinflate',
  'count', 'float', 'strain', 'whoosh', 'land', 'cheer', 'star', 'chapter',
];

type Voice = (bus: AudioBus, delay: number, step: number) => void;

/** A balloon clipped on: a little rising squeak. */
const clip: Voice = (bus, delay) => tone(bus, { freq: 620, duration: 0.1, type: 'triangle', gain: 0.1, sweepTo: 900, delay });
/** Sent back: the same squeak, falling. */
const unclip: Voice = (bus, delay) => tone(bus, { freq: 800, duration: 0.1, type: 'triangle', gain: 0.08, sweepTo: 520, delay });
/** No room on the harness: soft, never a buzzer. */
const full: Voice = (bus, delay) => tone(bus, { freq: 220, duration: 0.16, type: 'sine', gain: 0.12, delay });
const pop: Voice = (bus, delay) => noiseBurst(bus, { duration: 0.09, gain: 0.2, filterHz: 3200, sweepTo: 900, delay });
const reinflate: Voice = (bus, delay) => noiseBurst(bus, { duration: 0.3, gain: 0.06, filterHz: 500, sweepTo: 2200, delay });
/** One tick of the count, a step higher for each balloon: counting on, out loud. */
const count: Voice = (bus, delay, step) =>
  tone(bus, { freq: 440 * Math.pow(2, (step * 2) / 12), duration: 0.14, type: 'sine', gain: 0.14, delay });
const float: Voice = (bus, delay) => {
  [392, 523.25, 659.25].forEach((freq, index) => tone(bus, { freq, duration: 0.4, type: 'sine', gain: 0.12, delay: delay + index * 0.14 }));
};
/** Too little: a creak and an effort. */
const strain: Voice = (bus, delay) => {
  tone(bus, { freq: 180, duration: 0.5, type: 'sawtooth', gain: 0.05, sweepTo: 240, delay });
  noiseBurst(bus, { duration: 0.3, gain: 0.04, filterHz: 300, delay });
};
/** Too much: a comic whoosh up and away. It should be funny. */
const whoosh: Voice = (bus, delay) => {
  noiseBurst(bus, { duration: 0.7, gain: 0.1, filterHz: 600, sweepTo: 4000, delay });
  tone(bus, { freq: 400, duration: 0.6, type: 'triangle', gain: 0.1, sweepTo: 1400, delay });
};
const land: Voice = (bus, delay) => tone(bus, { freq: 160, duration: 0.2, type: 'sine', gain: 0.14, sweepTo: 110, delay });
const cheer: Voice = (bus, delay) => {
  [523.25, 659.25, 783.99, 1046.5].forEach((freq, index) => tone(bus, { freq, duration: 0.3, type: 'triangle', gain: 0.15, delay: delay + index * 0.09 }));
};
const star: Voice = (bus, delay, step) => tone(bus, { freq: 880 + step * 220, duration: 0.2, type: 'sine', gain: 0.14, delay });
/** A new chapter: three notes climbing, attention without alarm. */
const chapter: Voice = (bus, delay) => {
  [523.25, 659.25, 830.61].forEach((freq, index) => tone(bus, { freq, duration: 0.26, type: 'triangle', gain: 0.15, delay: delay + index * 0.11 }));
};

const VOICES: Record<string, Voice> = { clip, unclip, full, pop, reinflate, count, float, strain, whoosh, land, cheer, star, chapter };

export function createBalloonSoundPack(bus: AudioBus): SoundPack {
  return {
    async preload() {
      // Synthesised on demand; nothing to fetch.
    },
    play(event, params) {
      VOICES[event]?.(bus, Math.max(0, params?.delay ?? 0), params?.step ?? 0);
    },
  };
}
