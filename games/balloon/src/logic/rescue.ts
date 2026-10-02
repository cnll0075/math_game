import { judge, type Outcome } from './outcome.js';
import { hooksOf, layerOf, targetOf, tiedOf, type RescueDef } from './rescue-def.js';

/** A balloon taken from the tray, remembering where it came from. */
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
  tries: number;
  rescued: boolean;
}

export type RescueEvent =
  | { type: 'clipped'; value: number }
  | { type: 'unclipped'; value: number }
  | { type: 'full' }
  | { type: 'popped'; index: number; value: number }
  | { type: 'reinflated'; index: number; value: number }
  | { type: 'released'; outcome: Outcome; tries: number };

export interface Rescue {
  readonly state: RescueState;
  clip(trayIndex: number): RescueEvent[];
  unclip(slot: number): RescueEvent[];
  togglePop(tiedIndex: number): RescueEvent[];
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
/** A popped balloon still hangs on its hook. */
export const hooksUsed = (state: RescueState): number => state.tied.length + state.clipped.length;
export const trayTaken = (state: RescueState, index: number): boolean =>
  state.clipped.some((taken) => taken.from === index);
export const canLetGo = (state: RescueState): boolean => !state.rescued && hooksUsed(state) > 0;

export const outcomeOf = (state: RescueState): Outcome =>
  judge(liftOf(state), state.def.weight, layerOf(state.def));

/**
 * The sum the rescue made, written out for the moment it lands. That beat is
 * the teaching: the child sees their bunch turned into arithmetic. A pop is
 * written as taking away, and a climb into the wind as the weight plus layers.
 */
export function answerLines(state: RescueState): string[] {
  const popped = state.tied.filter((balloon) => balloon.popped).map((balloon) => balloon.value);
  const lifted = liftedValues(state);
  const target = targetOf(state.def);
  const lines: string[] = [];

  if (popped.length > 0) {
    const whole = total(state.tied.map((balloon) => balloon.value));
    const terms = [String(whole), ...popped.map((value) => `${MINUS} ${value}`), ...state.clipped.map((taken) => `+ ${taken.value}`)];
    lines.push(`${terms.join(' ')} = ${target}`);
  } else if (lifted.length > 1) {
    lines.push(`${lifted.join(' + ')} = ${target}`);
  } else {
    lines.push(String(target));
  }

  const layer = layerOf(state.def);
  if (layer > 0) lines.push(`${state.def.weight} + ${layer} = ${target}`);
  return lines;
}

export function createRescue(def: RescueDef): Rescue {
  const state: RescueState = {
    def,
    tied: tiedOf(def).map((value) => ({ value, popped: false })),
    clipped: [],
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

    letGo() {
      if (!canLetGo(state)) return [];
      state.tries += 1;
      const outcome = outcomeOf(state);
      if (outcome.verdict === 'exact') state.rescued = true;
      return [{ type: 'released', outcome, tries: state.tries }];
    },
  };
}
