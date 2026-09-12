import { createRng, type Rng } from '@bundle/core';
import type { Side } from './seesaw-state.js';

export interface WindSettings {
  seed: number;
  /** Seconds of calm between gusts, as [min, max]. */
  calmSeconds: readonly [number, number];
  /** How long the leaves blow before the push begins. */
  warningSeconds: number;
  /** How long a gust pushes, as [min, max] seconds. */
  gustSeconds: readonly [number, number];
  /** Push in weight units, as [min, max]; whole numbers. */
  strength: readonly [number, number];
}

export type WindPhase = 'calm' | 'warning' | 'blowing';

export interface WindState {
  phase: WindPhase;
  /** Which way the wind presses. Meaningless while calm. */
  side: Side;
  /** Weight units of push, zero unless blowing. */
  bias: number;
  /** 0..1 through the current phase, for the presentation to lean on. */
  through: number;
}

export interface Wind {
  readonly state: WindState;
  /** Advances the weather. Returns the phase it moved into, if it changed. */
  tick(dt: number): WindPhase | null;
  /** Positive presses the left side down, matching the balance convention. */
  readonly bias: number;
}

const pick = (rng: Rng, [min, max]: readonly [number, number]): number => min + rng.next() * (max - min);

/**
 * Weather for level 9 onwards. A gust announces itself before it arrives — the
 * child gets a beat to prepare rather than being shoved — then presses on one
 * side for a few seconds, then drops.
 */
export function createWind(settings: WindSettings): Wind {
  const rng = createRng(settings.seed);

  let phase: WindPhase = 'calm';
  let side: Side = 'left';
  let strength = 0;
  let remaining = pick(rng, settings.calmSeconds);
  let phaseLength = remaining;

  const enter = (next: WindPhase, seconds: number): void => {
    phase = next;
    remaining = seconds;
    phaseLength = seconds;
  };

  return {
    get state() {
      return {
        phase,
        side,
        bias: phase === 'blowing' ? (side === 'left' ? strength : -strength) : 0,
        through: phaseLength <= 0 ? 1 : Math.min(1, 1 - remaining / phaseLength),
      };
    },

    get bias() {
      if (phase !== 'blowing') return 0;
      return side === 'left' ? strength : -strength;
    },

    tick(dt) {
      if (!(dt > 0)) return null;
      remaining -= dt;
      if (remaining > 0) return null;

      if (phase === 'calm') {
        // Decide the gust now, so the warning can point the right way.
        side = rng.next() < 0.5 ? 'left' : 'right';
        strength = Math.max(1, Math.round(pick(rng, settings.strength)));
        enter('warning', settings.warningSeconds);
        return 'warning';
      }
      if (phase === 'warning') {
        enter('blowing', pick(rng, settings.gustSeconds));
        return 'blowing';
      }
      enter('calm', pick(rng, settings.calmSeconds));
      return 'calm';
    },
  };
}
