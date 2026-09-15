import type { AudioBus } from './audio-bus.js';
import type { SoundPack } from './sound-pack.js';

/**
 * How long the game waits for sound files before starting without them. It
 * starts either way: a slow or missing file must never hold up a child, and the
 * pack it falls back to covers every event in the meantime.
 */
const PATIENCE_MS = 1200;

const afterAtMost = <T>(work: Promise<T>, ms: number): Promise<T | null> =>
  Promise.race([work, new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))]);

export interface SampleOptions {
  /** Event name to file URL. Events with no file fall through to `fallback`. */
  sources: Record<string, string>;
  /** Plays anything the samples do not cover, and stands in until they load. */
  fallback: SoundPack;
  /** Per-event level, 0..1. Recordings arrive at whatever level they arrive at. */
  gain?: Record<string, number>;
}

/**
 * A pack that plays recorded sound, falling back to another pack for every
 * event it has no recording for - and for all of them until the recordings have
 * loaded, or if they never do.
 *
 * This is the other half of the swap the SoundPack seam exists for: a game asks
 * for an event by name and never learns whether the answer was a recording or
 * a synthesiser.
 */
export function createSampleSoundPack(bus: AudioBus, options: SampleOptions): SoundPack {
  const { sources, fallback, gain = {} } = options;
  const buffers = new Map<string, AudioBuffer>();
  /** Files that have been fetched but not yet turned into playable audio. */
  const undecoded = new Map<string, ArrayBuffer>();
  let offline: BaseAudioContext | null = null;
  let decoding = false;

  /**
   * Something that can turn bytes into audio.
   *
   * The bus has no context until the first tap, because a browser will not let
   * one start before the user asks for sound - and preloading happens long
   * before that. An offline context can be built at any time and the audio it
   * decodes plays through any context, so the recordings are ready before the
   * first tap rather than after it.
   */
  const decoder = (): BaseAudioContext | null => {
    if (bus.context) return bus.context;
    if (offline) return offline;
    try {
      const Ctor =
        globalThis.OfflineAudioContext ??
        (globalThis as { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext;
      offline = Ctor ? new Ctor(1, 1, 44100) : null;
    } catch {
      offline = null;
    }
    return offline;
  };

  const fetchBytes = async (url: string): Promise<ArrayBuffer | null> => {
    if (typeof fetch !== 'function') return null;
    try {
      const response = await fetch(url);
      if (!response.ok) return null;
      return await response.arrayBuffer();
    } catch {
      // A missing file is not worth failing over: the fallback pack already
      // covers every event.
      return null;
    }
  };

  /** Turns whatever has been fetched into audio, as soon as anything can. */
  const decodePending = async (): Promise<void> => {
    if (decoding || undecoded.size === 0) return;
    const context = decoder();
    if (!context) return;
    decoding = true;
    try {
      await Promise.all(
        [...undecoded].map(async ([event, bytes]) => {
          try {
            // decodeAudioData detaches the buffer it is given, so each attempt
            // gets its own copy and a failure can be retried later.
            const buffer = await context.decodeAudioData(bytes.slice(0));
            buffers.set(event, buffer);
            undecoded.delete(event);
          } catch {
            undecoded.delete(event);
          }
        }),
      );
    } finally {
      decoding = false;
    }
  };

  return {
    async preload() {
      await Promise.all([
        fallback.preload(),
        afterAtMost(
          (async () => {
            await Promise.all(
              Object.entries(sources).map(async ([event, url]) => {
                const bytes = await fetchBytes(url);
                if (bytes) undecoded.set(event, bytes);
              }),
            );
            await decodePending();
          })(),
          PATIENCE_MS,
        ),
      ]);
    },

    play(event, params) {
      const buffer = buffers.get(event);
      const { context, destination } = bus;
      if (!buffer || !context || !destination) {
        // Anything not ready is the fallback pack's, and a tap that finds a
        // context where preloading found none is the moment to catch up.
        if (context) void decodePending();
        fallback.play(event, params);
        return;
      }
      const source = context.createBufferSource();
      source.buffer = buffer;
      const level = context.createGain();
      level.gain.value = gain[event] ?? 1;
      source.connect(level);
      level.connect(destination);
      source.start(context.currentTime + Math.max(0, params?.delay ?? 0));
    },
  };
}
