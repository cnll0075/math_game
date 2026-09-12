/**
 * Shared audio output for the whole bundle: one context, one master gain, one
 * mute. Games play through it and never own a context of their own.
 *
 * Audio is always best-effort. iOS refuses to start a context outside a user
 * gesture, some devices refuse entirely, and none of that may break a game, so
 * every failure degrades to silence rather than throwing.
 */
export interface AudioBus {
  readonly context: AudioContext | null;
  readonly destination: AudioNode | null;
  muted: boolean;
  volume: number;
  unlock(): Promise<void>;
}

type ContextFactory = () => AudioContext | null;

const defaultFactory: ContextFactory = () => {
  const Ctor =
    globalThis.AudioContext ?? (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  return Ctor ? new Ctor() : null;
};

export function createAudioBus(factory: ContextFactory = defaultFactory): AudioBus {
  let context: AudioContext | null = null;
  let master: GainNode | null = null;
  let muted = false;
  let volume = 0.8;

  const applyGain = (): void => {
    if (!master) return;
    try {
      master.gain.value = muted ? 0 : volume;
    } catch {
      // A closed context can throw on assignment.
    }
  };

  return {
    get context() {
      return context;
    },
    get destination() {
      return master;
    },
    get muted() {
      return muted;
    },
    set muted(value: boolean) {
      muted = value;
      applyGain();
    },
    get volume() {
      return volume;
    },
    set volume(value: number) {
      volume = Math.min(1, Math.max(0, value));
      applyGain();
    },
    async unlock() {
      if (context) {
        try {
          await context.resume();
        } catch {
          // Already running, or not resumable; nothing to do.
        }
        return;
      }
      try {
        const created = factory();
        if (!created) return;
        context = created;
        master = created.createGain();
        applyGain();
        master.connect(created.destination);
        await created.resume();
      } catch {
        context = null;
        master = null;
      }
    },
  };
}
