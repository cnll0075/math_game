import { judge, type Outcome } from './outcome.js';
import { hooksOf, tiedOf, type RescueDef } from './rescue-def.js';

/** A balloon or puff taken from a tray, remembering where it came from. */
export interface Taken {
  value: number;
  from: number;
}

export interface TiedBalloon {
  value: number;
  popped: boolean;
}

export interface RescueState {
  readonly def: RescueDef;
  tied: TiedBalloon[];
  clipped: Taken[];
  puffs: Taken[];
  tries: number;
  rescued: boolean;
}

export type RescueEvent =
  | { type: 'clipped'; value: number }
  | { type: 'unclipped'; value: number }
  | { type: 'full' }
  | { type: 'popped'; index: number; value: number }
  | { type: 'reinflated'; index: number; value: number }
  | { type: 'puffed'; value: number }
  | { type: 'unpuffed'; value: number }
  | { type: 'released'; outcome: Outcome; tries: number };

export interface Rescue {
  readonly state: RescueState;
  clip(trayIndex: number): RescueEvent[];
  unclip(slot: number): RescueEvent[];
  togglePop(tiedIndex: number): RescueEvent[];
  puff(puffIndex: number): RescueEvent[];
  unpuff(slot: number): RescueEvent[];
  letGo(): RescueEvent[];
}

const MINUS = '−';
const total = (values: readonly number[]): number => values.reduce((sum, value) => sum + value, 0);

/** Every value still lifting, tied first, in the order they hang on the harness. */
export const liftedValues = (state: RescueState): number[] => [
  ...state.tied.filter((balloon) => !balloon.popped).map((balloon) => balloon.value),
  ...state.clipped.map((taken) => taken.value),
];

/** The bunch slots of those same balloons: tied first, then clipped. */
export const liftedSlots = (state: RescueState): number[] => [
  ...state.tied.flatMap((balloon, index) => (balloon.popped ? [] : [index])),
  ...state.clipped.map((_, index) => state.tied.length + index),
];

export const liftOf = (state: RescueState): number => total(liftedValues(state));
export const puffTotal = (state: RescueState): number => total(state.puffs.map((taken) => taken.value));
/** A popped balloon still hangs on its hook. */
export const hooksUsed = (state: RescueState): number => state.tied.length + state.clipped.length;
export const trayTaken = (state: RescueState, index: number): boolean =>
  state.clipped.some((taken) => taken.from === index);
export const puffTaken = (state: RescueState, index: number): boolean =>
  state.puffs.some((taken) => taken.from === index);
export const canLetGo = (state: RescueState): boolean => !state.rescued && hooksUsed(state) > 0;

export function outcomeOf(state: RescueState): Outcome {
  const wind = state.def.wind;
  return judge(
    liftOf(state),
    state.def.weight,
    wind ? { have: wind.wind + puffTotal(state), need: wind.ledge } : undefined,
  );
}

/**
 * The sum the rescue made, written out for the moment it lands. That beat is
 * the teaching: the child sees their bunch turned into arithmetic. A pop is
 * written as taking away, because that is what it was.
 */
export function answerLines(state: RescueState): string[] {
  const popped = state.tied.filter((balloon) => balloon.popped).map((balloon) => balloon.value);
  const lifted = liftedValues(state);
  const lines: string[] = [];

  if (popped.length > 0) {
    const whole = total(state.tied.map((balloon) => balloon.value));
    const terms = [String(whole), ...popped.map((value) => `${MINUS} ${value}`), ...state.clipped.map((taken) => `+ ${taken.value}`)];
    lines.push(`${terms.join(' ')} = ${state.def.weight}`);
  } else if (lifted.length > 1) {
    lines.push(`${lifted.join(' + ')} = ${state.def.weight}`);
  } else {
    lines.push(String(state.def.weight));
  }

  const wind = state.def.wind;
  if (wind) {
    const puffs = state.puffs.map((taken) => taken.value);
    const terms =
      wind.wind > 0
        ? [String(wind.wind), ...puffs.map((value) => `+ ${value}`)]
        : wind.wind < 0
          ? [puffs.join(' + '), `${MINUS} ${-wind.wind}`]
          : [puffs.join(' + ')];
    lines.push(`${terms.join(' ')} = ${wind.ledge}`);
  }
  return lines;
}

export function createRescue(def: RescueDef): Rescue {
  const state: RescueState = {
    def,
    tied: tiedOf(def).map((value) => ({ value, popped: false })),
    clipped: [],
    puffs: [],
    tries: 0,
    rescued: false,
  };

  return {
    state,

    clip(index) {
      const value = def.tray[index];
      if (state.rescued || value === undefined || trayTaken(state, index)) return [];
      if (hooksUsed(state) >= hooksOf(def)) return [{ type: 'full' }];
      state.clipped.push({ value, from: index });
      return [{ type: 'clipped', value }];
    },

    unclip(slot) {
      const taken = state.clipped[slot];
      if (state.rescued || !taken) return [];
      state.clipped.splice(slot, 1);
      return [{ type: 'unclipped', value: taken.value }];
    },

    togglePop(index) {
      const balloon = state.tied[index];
      if (state.rescued || !balloon) return [];
      balloon.popped = !balloon.popped;
      return [{ type: balloon.popped ? 'popped' : 'reinflated', index, value: balloon.value }];
    },

    puff(index) {
      const value = def.wind?.puffs[index];
      if (state.rescued || value === undefined || puffTaken(state, index)) return [];
      state.puffs.push({ value, from: index });
      return [{ type: 'puffed', value }];
    },

    unpuff(slot) {
      const taken = state.puffs[slot];
      if (state.rescued || !taken) return [];
      state.puffs.splice(slot, 1);
      return [{ type: 'unpuffed', value: taken.value }];
    },

    letGo() {
      if (!canLetGo(state)) return [];
      state.tries += 1;
      const outcome = outcomeOf(state);
      if (outcome.verdict === 'exact') state.rescued = true;
      return [{ type: 'released', outcome, tries: state.tries }];
    },
  };
}
