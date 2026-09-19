import { noiseBurst, tone, type AudioBus, type SoundPack } from '@bundle/core';

/**
 * Every sound the game can make, by name. A later pack backed by recorded
 * samples implements the same names and swaps in with one line of setup — the
 * arrangement Seesaw's animals already use.
 */
export const SOUND_EVENTS: readonly string[] = [
  'fire',
  'damage',
  'destroy',
  'jam',
  'escape',
  'heart',
  'band',
  'over',
  'best',
];

type Voice = (bus: AudioBus, delay: number) => void;

/** A shell leaving the gun: short, dry, and quiet enough to hear a hundred of. */
const fire: Voice = (bus, delay) => {
  tone(bus, { freq: 720, duration: 0.07, type: 'square', gain: 0.07, sweepTo: 420, delay });
};

/** A hit that did not finish the job. */
const damage: Voice = (bus, delay) => {
  tone(bus, { freq: 240, duration: 0.1, type: 'square', gain: 0.12, sweepTo: 180, delay });
  noiseBurst(bus, { duration: 0.08, gain: 0.05, filterHz: 900, delay });
};

/** The right answer: a bright two-note lift over a thump. This is the reward. */
const destroy: Voice = (bus, delay) => {
  noiseBurst(bus, { duration: 0.22, gain: 0.1, filterHz: 1600, sweepTo: 300, delay });
  tone(bus, { freq: 659.25, duration: 0.18, type: 'triangle', gain: 0.16, delay });
  tone(bus, { freq: 987.77, duration: 0.26, type: 'triangle', gain: 0.14, delay: delay + 0.09 });
};

/**
 * The gun overheating. A cough rather than a buzzer: the wrong plane is a
 * mistake to shrug at and try again, not a telling-off.
 */
const jam: Voice = (bus, delay) => {
  noiseBurst(bus, { duration: 0.18, gain: 0.09, filterHz: 420, sweepTo: 180, delay });
  tone(bus, { freq: 150, duration: 0.14, type: 'square', gain: 0.1, sweepTo: 96, delay: delay + 0.05 });
};

/** One got away: a low horn falling. */
const escape: Voice = (bus, delay) => {
  tone(bus, { freq: 330, duration: 0.42, type: 'sawtooth', gain: 0.12, sweepTo: 165, delay });
};

/** A heart going. */
const heart: Voice = (bus, delay) => {
  tone(bus, { freq: 196, duration: 0.3, type: 'triangle', gain: 0.14, sweepTo: 130, delay });
  noiseBurst(bus, { duration: 0.14, gain: 0.05, filterHz: 260, delay: delay + 0.04 });
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

const VOICES: Record<string, Voice> = { fire, damage, destroy, jam, escape, heart, band, over, best };

export function createSkySoundPack(bus: AudioBus): SoundPack {
  return {
    async preload() {
      // Synthesised on demand; nothing to fetch.
    },
    play(event, params) {
      VOICES[event]?.(bus, Math.max(0, params?.delay ?? 0));
    },
  };
}
