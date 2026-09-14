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
  'cheer',
  'goal',
  'stamp',
  ...ANIMAL_IDS.map((id) => `voice:${id}`),
];

type Voice = (bus: AudioBus, delay: number) => void;

/**
 * The signature sound: a struck bell. Two partials a fifth apart with a long
 * exponential tail, which reads as "that was right" without saying so.
 */
const ding: Voice = (bus, delay) => {
  tone(bus, { freq: 1318.5, duration: 1.3, type: 'sine', gain: 0.26, delay });
  tone(bus, { freq: 1975.5, duration: 0.9, type: 'sine', gain: 0.1, delay });
  tone(bus, { freq: 2637, duration: 0.45, type: 'sine', gain: 0.05, delay });
};

const creak: Voice = (bus, delay) => {
  noiseBurst(bus, { duration: 0.28, gain: 0.09, filterHz: 620, sweepTo: 380, delay });
};

const land: Voice = (bus, delay) => {
  tone(bus, { freq: 150, duration: 0.16, type: 'sine', gain: 0.22, sweepTo: 70, delay });
  noiseBurst(bus, { duration: 0.1, gain: 0.06, filterHz: 300, delay });
};

const danger: Voice = (bus, delay) => {
  tone(bus, { freq: 190, duration: 0.14, type: 'square', gain: 0.14, delay });
  tone(bus, { freq: 160, duration: 0.18, type: 'square', gain: 0.14, delay: delay + 0.17 });
};

const success: Voice = (bus, delay) => {
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((freq, index) => {
    tone(bus, { freq, duration: 0.34, type: 'triangle', gain: 0.18, delay: delay + index * 0.1 });
  });
};

/** A little rising whoop under the dancing animals. */
const cheer: Voice = (bus, delay) => {
  tone(bus, { freq: 392, duration: 0.5, type: 'triangle', gain: 0.12, sweepTo: 784, delay });
  tone(bus, { freq: 587.33, duration: 0.4, type: 'sine', gain: 0.07, sweepTo: 880, delay: delay + 0.06 });
};

/** A new goal arriving: two rising notes, attention without alarm. */
const goal: Voice = (bus, delay) => {
  tone(bus, { freq: 587.33, duration: 0.22, type: 'triangle', gain: 0.14, delay });
  tone(bus, { freq: 880, duration: 0.34, type: 'triangle', gain: 0.13, delay: delay + 0.12 });
};

/** A challenge ticked off: a short, satisfying thunk. */
const stamp: Voice = (bus, delay) => {
  tone(bus, { freq: 330, duration: 0.16, type: 'square', gain: 0.12, sweepTo: 220, delay });
  tone(bus, { freq: 990, duration: 0.22, type: 'sine', gain: 0.09, delay: delay + 0.04 });
};

const VOICES: Record<string, Voice> = {
  ding,
  creak,
  land,
  danger,
  success,
  cheer,
  goal,
  stamp,
};

/**
 * An animal's cry, built from the description in the catalogue: a pitch that
 * slides, repeated a few times, roughened to taste. A cluck is three clipped
 * squares; a growl is one long rough slide down. Nobody will mistake the bear
 * for the chicken.
 */
for (const id of ANIMAL_IDS) {
  const { voice } = ANIMALS[id];
  VOICES[`voice:${id}`] = (bus, delay) => {
    for (let repeat = 0; repeat < voice.repeats; repeat++) {
      const at = delay + repeat * voice.gap;
      tone(bus, {
        freq: voice.from,
        sweepTo: voice.to,
        duration: voice.seconds,
        type: voice.type,
        gain: 0.16,
        attack: voice.seconds * 0.18,
        delay: at,
      });
      // Grit is a second voice a little out of tune with the first, which is
      // what turns a clean note into an animal.
      if (voice.grit > 0) {
        tone(bus, {
          freq: voice.from * (1 - 0.06 * voice.grit),
          sweepTo: voice.to * (1 - 0.06 * voice.grit),
          duration: voice.seconds,
          type: 'square',
          gain: 0.09 * voice.grit,
          delay: at,
        });
        noiseBurst(bus, {
          duration: voice.seconds * 0.8,
          gain: 0.05 * voice.grit,
          filterHz: voice.from * 1.4,
          sweepTo: voice.to,
          delay: at,
        });
      }
    }
  };
}

export function createSynthSoundPack(bus: AudioBus): SoundPack {
  return {
    async preload() {
      // Synthesised on demand; nothing to fetch.
    },
    play(event, params) {
      VOICES[event]?.(bus, Math.max(0, params?.delay ?? 0));
    },
  };
}
