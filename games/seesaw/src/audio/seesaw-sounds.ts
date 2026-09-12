import { noiseBurst, tone, type AudioBus, type SoundPack } from '@bundle/core';
import { ANIMALS, ANIMAL_IDS } from '../logic/animals.js';

/**
 * Every sound the game can make, by name. A later pack backed by recorded
 * samples implements the same names and swaps in with one line of setup.
 */
export const SOUND_EVENTS: readonly string[] = [
  'ding',
  'creak',
  'land',
  'danger',
  'success',
  'gate',
  ...ANIMAL_IDS.map((id) => `chirp:${id}`),
];

type Voice = (bus: AudioBus) => void;

/**
 * The signature sound: a struck bell. Two partials a fifth apart with a long
 * exponential tail, which reads as "that was right" without saying so.
 */
const ding: Voice = (bus) => {
  tone(bus, { freq: 1318.5, duration: 1.3, type: 'sine', gain: 0.26 });
  tone(bus, { freq: 1975.5, duration: 0.9, type: 'sine', gain: 0.1 });
  tone(bus, { freq: 2637, duration: 0.45, type: 'sine', gain: 0.05 });
};

const creak: Voice = (bus) => {
  noiseBurst(bus, { duration: 0.28, gain: 0.09, filterHz: 620, sweepTo: 380 });
};

const land: Voice = (bus) => {
  tone(bus, { freq: 150, duration: 0.16, type: 'sine', gain: 0.22, sweepTo: 70 });
  noiseBurst(bus, { duration: 0.1, gain: 0.06, filterHz: 300 });
};

const danger: Voice = (bus) => {
  tone(bus, { freq: 190, duration: 0.14, type: 'square', gain: 0.14 });
  tone(bus, { freq: 160, duration: 0.18, type: 'square', gain: 0.14, delay: 0.17 });
};

const success: Voice = (bus) => {
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((freq, index) => {
    tone(bus, { freq, duration: 0.34, type: 'triangle', gain: 0.18, delay: index * 0.1 });
  });
};

const gate: Voice = (bus) => {
  tone(bus, { freq: 420, duration: 0.06, type: 'square', gain: 0.1 });
  noiseBurst(bus, { duration: 0.5, gain: 0.08, filterHz: 500, sweepTo: 900, delay: 0.08 });
};

const VOICES: Record<string, Voice> = {
  ding,
  creak,
  land,
  danger,
  success,
  gate,
};

for (const id of ANIMAL_IDS) {
  const { voice } = ANIMALS[id];
  VOICES[`chirp:${id}`] = (bus) => {
    tone(bus, { freq: voice.freq, duration: voice.duration, type: 'triangle', gain: 0.12 });
    tone(bus, { freq: voice.freq * 1.5, duration: voice.duration * 0.7, type: 'sine', gain: 0.05, delay: 0.04 });
  };
}

export function createSynthSoundPack(bus: AudioBus): SoundPack {
  return {
    async preload() {
      // Synthesised on demand; nothing to fetch.
    },
    play(event) {
      VOICES[event]?.(bus);
    },
  };
}
