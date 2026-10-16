import { noiseBurst, tone, type AudioBus, type SoundPack } from '@bundle/core';

/**
 * Every sound the yard can make, by name. A later pack backed by recorded
 * samples implements the same names and swaps in with one line of setup.
 */
export const SOUND_EVENTS: readonly string[] = [
  'start', 'band', 'speed', 'crate', 'pick', 'thunk', 'whistle', 'crunch', 'hammer', 'horn', 'tick', 'bonus', 'danger', 'over', 'best',
];

type Voice = (bus: AudioBus, delay: number, step: number) => void;

/** A rising three-note fanfare: a run, or a band, begins. */
const start: Voice = (bus, delay) => {
  [523.25, 659.25, 783.99].forEach((freq, index) => tone(bus, { freq, duration: 0.24, type: 'triangle', gain: 0.14, delay: delay + index * 0.1 }));
};
const band: Voice = start;
/** Whoosh up: faster now. */
const speed: Voice = (bus, delay) => tone(bus, { freq: 300, duration: 0.35, type: 'sawtooth', gain: 0.05, sweepTo: 900, delay });
/** A crate out of the port onto the belt: a soft clunk. */
const crate: Voice = (bus, delay) => noiseBurst(bus, { duration: 0.08, gain: 0.06, filterHz: 700, delay });
/** Picked up. */
const pick: Voice = (bus, delay) => tone(bus, { freq: 660, duration: 0.06, type: 'sine', gain: 0.08, delay });
/** Into the wagon, lower for a heavier crate. */
const thunk: Voice = (bus, delay, step) => {
  noiseBurst(bus, { duration: 0.12, gain: 0.1, filterHz: 900 - Math.min(9, step) * 50, delay });
  tone(bus, { freq: 220 - Math.min(9, step) * 8, duration: 0.12, type: 'sine', gain: 0.12, delay });
};
/** Away she goes. */
const whistle: Voice = (bus, delay) => {
  tone(bus, { freq: 880, duration: 0.5, type: 'triangle', gain: 0.1, delay });
  tone(bus, { freq: 1108.73, duration: 0.5, type: 'triangle', gain: 0.08, delay });
};
/** Too heavy: a crunch and a slide down. Funny, never harsh. */
const crunch: Voice = (bus, delay) => {
  noiseBurst(bus, { duration: 0.35, gain: 0.16, filterHz: 1400, sweepTo: 300, delay });
  tone(bus, { freq: 330, duration: 0.5, type: 'triangle', gain: 0.1, sweepTo: 110, delay: delay + 0.1 });
};
/** The crew at work. */
const hammer: Voice = (bus, delay) => noiseBurst(bus, { duration: 0.05, gain: 0.08, filterHz: 2600, delay });
/** A star train pulls in. */
const horn: Voice = (bus, delay) => {
  tone(bus, { freq: 392, duration: 0.45, type: 'square', gain: 0.05, delay });
  tone(bus, { freq: 493.88, duration: 0.45, type: 'square', gain: 0.04, delay });
};
const tick: Voice = (bus, delay) => tone(bus, { freq: 1046.5, duration: 0.06, type: 'square', gain: 0.05, delay });
const bonus: Voice = (bus, delay) => {
  [783.99, 987.77, 1174.66, 1567.98].forEach((freq, index) => tone(bus, { freq, duration: 0.18, type: 'sine', gain: 0.12, delay: delay + index * 0.07 }));
};
/** The queue nears the marker: a low two-note nudge. */
const danger: Voice = (bus, delay) => {
  [392, 330].forEach((freq, index) => tone(bus, { freq, duration: 0.14, type: 'sine', gain: 0.08, delay: delay + index * 0.14 }));
};
const over: Voice = (bus, delay) => {
  [523.25, 392, 329.63].forEach((freq, index) => tone(bus, { freq, duration: 0.3, type: 'sine', gain: 0.12, delay: delay + index * 0.2 }));
};
const best: Voice = bonus;

const VOICES: Record<string, Voice> = {
  start, band, speed, crate, pick, thunk, whistle, crunch, hammer, horn, tick, bonus, danger, over, best,
};

export function createTrainSoundPack(bus: AudioBus): SoundPack {
  return {
    async preload() {
      // Synthesised on demand; nothing to fetch.
    },
    play(event, params) {
      VOICES[event]?.(bus, Math.max(0, params?.delay ?? 0), params?.step ?? 0);
    },
  };
}
