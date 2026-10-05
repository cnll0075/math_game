import { noiseBurst, tone, type AudioBus, type SoundPack } from '@bundle/core';

/**
 * Every sound the game can make, by name. A later pack backed by recorded
 * samples implements the same names and swaps in with one line of setup.
 */
export const SOUND_EVENTS: readonly string[] = ['flip', 'match', 'miss', 'cleared', 'star', 'board', 'pick', 'splash', 'croak'];

type Voice = (bus: AudioBus, delay: number, step: number) => void;

/** A pad turning over: a soft plip on the water. */
const flip: Voice = (bus, delay) => {
  tone(bus, { freq: 700, duration: 0.08, type: 'sine', gain: 0.1, sweepTo: 420, delay });
  noiseBurst(bus, { duration: 0.06, gain: 0.03, filterHz: 2200, delay });
};
/** Equal: a bright two-note chime. The reward. */
const match: Voice = (bus, delay) => {
  tone(bus, { freq: 659.25, duration: 0.18, type: 'triangle', gain: 0.15, delay });
  tone(bus, { freq: 987.77, duration: 0.3, type: 'triangle', gain: 0.14, delay: delay + 0.1 });
};
/** Not equal: a gentle bloop, never a buzzer. */
const miss: Voice = (bus, delay) => tone(bus, { freq: 330, duration: 0.2, type: 'sine', gain: 0.1, sweepTo: 240, delay });
const cleared: Voice = (bus, delay) => {
  [523.25, 659.25, 783.99, 1046.5].forEach((freq, index) => tone(bus, { freq, duration: 0.3, type: 'triangle', gain: 0.15, delay: delay + index * 0.09 }));
};
const star: Voice = (bus, delay, step) => tone(bus, { freq: 880 + step * 220, duration: 0.2, type: 'sine', gain: 0.14, delay });
/** A new board: three notes climbing, attention without alarm. */
const board: Voice = (bus, delay) => {
  [523.25, 659.25, 830.61].forEach((freq, index) => tone(bus, { freq, duration: 0.26, type: 'triangle', gain: 0.15, delay: delay + index * 0.11 }));
};
const pick: Voice = (bus, delay) => tone(bus, { freq: 520, duration: 0.08, type: 'sine', gain: 0.1, delay });

/** The frog leaving or meeting the water. */
const splash: Voice = (bus, delay) => {
  noiseBurst(bus, { duration: 0.35, gain: 0.08, filterHz: 1800, sweepTo: 500, delay });
  tone(bus, { freq: 520, duration: 0.12, type: 'sine', gain: 0.06, sweepTo: 900, delay });
};
/** "Ribbit!": two low, buzzy croaks. */
const croak: Voice = (bus, delay) => {
  tone(bus, { freq: 150, duration: 0.14, type: 'sawtooth', gain: 0.07, sweepTo: 120, delay });
  tone(bus, { freq: 170, duration: 0.16, type: 'sawtooth', gain: 0.07, sweepTo: 130, delay: delay + 0.18 });
};

const VOICES: Record<string, Voice> = { flip, match, miss, cleared, star, board, pick, splash, croak };

export function createPondSoundPack(bus: AudioBus): SoundPack {
  return {
    async preload() {
      // Synthesised on demand; nothing to fetch.
    },
    play(event, params) {
      VOICES[event]?.(bus, Math.max(0, params?.delay ?? 0), params?.step ?? 0);
    },
  };
}
