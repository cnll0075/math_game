import type { AudioBus } from './audio-bus.js';

export interface ToneOptions {
  freq: number;
  duration: number;
  type?: OscillatorType;
  gain?: number;
  attack?: number;
  delay?: number;
  detune?: number;
  sweepTo?: number;
}

export interface NoiseOptions {
  duration: number;
  gain?: number;
  filterHz?: number;
  sweepTo?: number;
  delay?: number;
}

/** Smallest gain the exponential ramp can target; zero is undefined for it. */
const NEAR_SILENCE = 0.0001;

/** One shaped oscillator voice: attack, then exponential decay to silence. */
export function tone(bus: AudioBus, options: ToneOptions): void {
  const context = bus.context;
  const destination = bus.destination;
  if (!context || !destination) return;

  try {
    const start = context.currentTime + (options.delay ?? 0);
    const peak = options.gain ?? 0.3;
    const attack = options.attack ?? 0.005;

    const oscillator = context.createOscillator();
    oscillator.type = options.type ?? 'sine';
    oscillator.frequency.setValueAtTime(options.freq, start);
    if (options.detune) oscillator.detune.setValueAtTime(options.detune, start);
    if (options.sweepTo) {
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(options.sweepTo, 1), start + options.duration);
    }

    const envelope = context.createGain();
    envelope.gain.setValueAtTime(NEAR_SILENCE, start);
    envelope.gain.linearRampToValueAtTime(peak, start + attack);
    envelope.gain.exponentialRampToValueAtTime(NEAR_SILENCE, start + options.duration);

    oscillator.connect(envelope);
    envelope.connect(destination);
    oscillator.start(start);
    oscillator.stop(start + options.duration + 0.02);
  } catch {
    // Silence beats a crash mid-game.
  }
}

/** Filtered white noise: creaks, thumps, and other non-pitched textures. */
export function noiseBurst(bus: AudioBus, options: NoiseOptions): void {
  const context = bus.context;
  const destination = bus.destination;
  if (!context || !destination) return;

  try {
    const start = context.currentTime + (options.delay ?? 0);
    const frames = Math.max(1, Math.floor(context.sampleRate * options.duration));
    const buffer = context.createBuffer(1, frames, context.sampleRate);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) channel[i] = Math.random() * 2 - 1;

    const source = context.createBufferSource();
    source.buffer = buffer;

    const filter = context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(options.filterHz ?? 900, start);
    if (options.sweepTo) {
      filter.frequency.exponentialRampToValueAtTime(Math.max(options.sweepTo, 1), start + options.duration);
    }

    const envelope = context.createGain();
    envelope.gain.setValueAtTime(options.gain ?? 0.2, start);
    envelope.gain.exponentialRampToValueAtTime(NEAR_SILENCE, start + options.duration);

    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(destination);
    source.start(start);
    source.stop(start + options.duration + 0.02);
  } catch {
    // As above.
  }
}
