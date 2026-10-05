import { noiseBurst, tone, type AudioBus, type SoundPack } from '@bundle/core';

/**
 * Every sound the game can make, by name. A later pack backed by recorded
 * samples implements the same names and swaps in with one line of setup.
 */
export const SOUND_EVENTS: readonly string[] = [
  'cast', 'plop', 'hooked', 'empty', 'reel', 'caught', 'item', 'speed', 'health', 'bonus', 'treasure', 'saved',
  'full', 'capsize', 'timeout', 'stuck', 'tick', 'star', 'level',
];

type Voice = (bus: AudioBus, delay: number, step: number) => void;

/** The line whipping out. */
const cast: Voice = (bus, delay) => noiseBurst(bus, { duration: 0.22, gain: 0.08, filterHz: 2400, sweepTo: 900, delay });
/** The hook going in. */
const plop: Voice = (bus, delay) => tone(bus, { freq: 520, duration: 0.12, type: 'sine', gain: 0.16, sweepTo: 180, delay });
/** Something bit: a quick tug, lower for something heavier. */
const hooked: Voice = (bus, delay, step) => {
  tone(bus, { freq: 700 - step * 35, duration: 0.09, type: 'triangle', gain: 0.14, delay });
  tone(bus, { freq: 900 - step * 35, duration: 0.09, type: 'triangle', gain: 0.12, delay: delay + 0.08 });
};
/** Nothing there: a soft shrug. */
const empty: Voice = (bus, delay) => tone(bus, { freq: 330, duration: 0.2, type: 'sine', gain: 0.08, sweepTo: 260, delay });
/** One click of the reel. Heavier catches click lower, and come slower because they reel slower. */
const reel: Voice = (bus, delay, step) =>
  noiseBurst(bus, { duration: 0.03, gain: 0.07, filterHz: 3400 - Math.min(10, step) * 160, delay });
/** A fish in the bucket: a splash and a note that climbs with the fish's weight. */
const caught: Voice = (bus, delay, step) => {
  noiseBurst(bus, { duration: 0.18, gain: 0.08, filterHz: 900, sweepTo: 300, delay });
  tone(bus, { freq: 392 * Math.pow(2, Math.min(12, step) / 12), duration: 0.22, type: 'triangle', gain: 0.14, delay: delay + 0.05 });
};
const item: Voice = (bus, delay) => {
  [880, 1174.66, 1567.98].forEach((freq, index) => tone(bus, { freq, duration: 0.16, type: 'sine', gain: 0.1, delay: delay + index * 0.06 }));
};
/** Glug glug, then whizzing. */
const speed: Voice = (bus, delay) => {
  [0, 0.14, 0.28].forEach((at) => tone(bus, { freq: 240, duration: 0.1, type: 'sine', gain: 0.14, sweepTo: 160, delay: delay + at }));
  tone(bus, { freq: 330, duration: 0.4, type: 'sawtooth', gain: 0.05, sweepTo: 660, delay: delay + 0.45 });
};
/** A warm rising chord: something to keep. */
const health: Voice = (bus, delay) => {
  [392, 493.88, 587.33].forEach((freq, index) => tone(bus, { freq, duration: 0.35, type: 'sine', gain: 0.1, delay: delay + index * 0.08 }));
};
const bonus: Voice = (bus, delay) => {
  [0, 0.16].forEach((at) => tone(bus, { freq: 1318.5, duration: 0.14, type: 'sine', gain: 0.12, delay: delay + at }));
};
/** Treasure: coins, bright and quick. Lovely, and worth nothing in the bucket. */
const treasure: Voice = (bus, delay) => {
  [1318.5, 1567.98, 1975.53, 1567.98, 2093].forEach((freq, index) =>
    tone(bus, { freq, duration: 0.09, type: 'square', gain: 0.04, delay: delay + index * 0.05 }),
  );
};
/** The health potion throws a fish back: a boing and a splash. */
const saved: Voice = (bus, delay) => {
  tone(bus, { freq: 220, duration: 0.3, type: 'triangle', gain: 0.12, sweepTo: 660, delay });
  noiseBurst(bus, { duration: 0.25, gain: 0.1, filterHz: 1000, sweepTo: 300, delay: delay + 0.25 });
};
const full: Voice = (bus, delay) => {
  [523.25, 659.25, 783.99, 1046.5].forEach((freq, index) => tone(bus, { freq, duration: 0.3, type: 'triangle', gain: 0.15, delay: delay + index * 0.09 }));
};
/** Over she goes: a big splash and a slide down. Funny, never harsh. */
const capsize: Voice = (bus, delay) => {
  tone(bus, { freq: 520, duration: 0.8, type: 'triangle', gain: 0.1, sweepTo: 130, delay });
  noiseBurst(bus, { duration: 0.6, gain: 0.16, filterHz: 1200, sweepTo: 250, delay: delay + 0.5 });
};
const timeout: Voice = (bus, delay) => {
  [523.25, 392].forEach((freq, index) => tone(bus, { freq, duration: 0.35, type: 'sine', gain: 0.12, delay: delay + index * 0.25 }));
};
const stuck: Voice = (bus, delay) => tone(bus, { freq: 392, duration: 0.4, type: 'sine', gain: 0.1, sweepTo: 330, delay });
/** The last seconds, ticking out loud. */
const tick: Voice = (bus, delay) => tone(bus, { freq: 1046.5, duration: 0.06, type: 'square', gain: 0.05, delay });
const star: Voice = (bus, delay, step) => tone(bus, { freq: 880 + step * 220, duration: 0.2, type: 'sine', gain: 0.14, delay });
const level: Voice = (bus, delay) => {
  [523.25, 659.25, 830.61].forEach((freq, index) => tone(bus, { freq, duration: 0.26, type: 'triangle', gain: 0.15, delay: delay + index * 0.11 }));
};

const VOICES: Record<string, Voice> = {
  cast, plop, hooked, empty, reel, caught, item, speed, health, bonus, treasure, saved, full, capsize, timeout, stuck, tick, star, level,
};

export function createFishingSoundPack(bus: AudioBus): SoundPack {
  return {
    async preload() {
      // Synthesised on demand; nothing to fetch.
    },
    play(event, params) {
      VOICES[event]?.(bus, Math.max(0, params?.delay ?? 0), params?.step ?? 0);
    },
  };
}
