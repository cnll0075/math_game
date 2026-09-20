import { noiseBurst, tone, type AudioBus, type SoundPack } from '@bundle/core';

/**
 * Every sound the game can make, by name. A later pack backed by recorded
 * samples implements the same names and swaps in with one line of setup.
 */
export const SOUND_EVENTS: readonly string[] = ['hop', 'burst', 'thump', 'berry', 'band', 'over', 'best'];

type Voice = (bus: AudioBus, delay: number) => void;

/** A lane change: a short soft note, quiet enough to hear a hundred of. */
const hop: Voice = (bus, delay) => {
  tone(bus, { freq: 520, duration: 0.07, type: 'sine', gain: 0.06, sweepTo: 700, delay });
};

/** The right lane: leaves and a bright lift. This is the reward. */
const burst: Voice = (bus, delay) => {
  noiseBurst(bus, { duration: 0.2, gain: 0.09, filterHz: 2000, sweepTo: 500, delay });
  tone(bus, { freq: 659.25, duration: 0.16, type: 'triangle', gain: 0.15, delay });
  tone(bus, { freq: 987.77, duration: 0.24, type: 'triangle', gain: 0.13, delay: delay + 0.08 });
};

/**
 * The wrong lane: a soft bump, not a buzzer. A wrong answer is a mistake to
 * shrug at and keep running, not a telling-off.
 */
const thump: Voice = (bus, delay) => {
  tone(bus, { freq: 150, duration: 0.18, type: 'sine', gain: 0.16, sweepTo: 80, delay });
  noiseBurst(bus, { duration: 0.16, gain: 0.07, filterHz: 380, sweepTo: 160, delay });
};

/** A berry: a small round chime, unmistakably good news. */
const berry: Voice = (bus, delay) => {
  [659.25, 880, 1174.66].forEach((freq, index) => {
    tone(bus, { freq, duration: 0.2, type: 'sine', gain: 0.13, delay: delay + index * 0.06 });
  });
};

/** A new band: three notes climbing, attention without alarm. */
const band: Voice = (bus, delay) => {
  [523.25, 659.25, 830.61].forEach((freq, index) => {
    tone(bus, { freq, duration: 0.26, type: 'triangle', gain: 0.15, delay: delay + index * 0.11 });
  });
};

/** The run ending: settling, not scolding. */
const over: Voice = (bus, delay) => {
  [587.33, 493.88, 392].forEach((freq, index) => {
    tone(bus, { freq, duration: 0.4, type: 'sine', gain: 0.14, delay: delay + index * 0.16 });
  });
};

/** A new best. */
const best: Voice = (bus, delay) => {
  [523.25, 659.25, 783.99, 1046.5].forEach((freq, index) => {
    tone(bus, { freq, duration: 0.34, type: 'triangle', gain: 0.17, delay: delay + index * 0.1 });
  });
};

const VOICES: Record<string, Voice> = { hop, burst, thump, berry, band, over, best };

export function createBrambleSoundPack(bus: AudioBus): SoundPack {
  return {
    async preload() {
      // Synthesised on demand; nothing to fetch.
    },
    play(event, params) {
      VOICES[event]?.(bus, Math.max(0, params?.delay ?? 0));
    },
  };
}
