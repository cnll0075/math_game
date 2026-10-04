import { judge, type Outcome } from './outcome.js';
import { hooksOf, kitsOf, tiedOf, weightsOf, type RescueDef } from './rescue-def.js';

/** A balloon taken from the tray: where it came from, and which kit it is on. */
export interface Taken {
  value: number;
  from: number;
  kit: number;
}

export interface TiedBalloon {
  value: number;
  popped: boolean;
}

export interface RescueState {
  readonly def: RescueDef;
  /** Tied balloons are always on the left kit. */
  tied: TiedBalloon[];
  clipped: Taken[];
  tries: number;
  rescued: boolean;
}

export type RescueEvent =
  | { type: 'clipped'; value: number; kit: number }
  | { type: 'unclipped'; value: number }
  | { type: 'full' }
  | { type: 'popped'; index: number; value: number }
  | { type: 'reinflated'; index: number; value: number }
  | { type: 'reset' }
  | { type: 'released'; outcomes: Outcome[]; tries: number };

export interface Rescue {
  readonly state: RescueState;
  clip(trayIndex: number, kit?: number): RescueEvent[];
  unclip(kit: number, slot: number): RescueEvent[];
  togglePop(tiedIndex: number): RescueEvent[];
  startOver(): RescueEvent[];
  letGo(): RescueEvent[];
}

const MINUS = '−';
const total = (values: readonly number[]): number => values.reduce((sum, value) => sum + value, 0);

const tiedOn = (state: RescueState, kit: number): TiedBalloon[] => (kit === 0 ? state.tied : []);

/** The clipped balloons on one kit, in the order they hang. */
export const clippedOn = (state: RescueState, kit: number): Taken[] => state.clipped.filter((taken) => taken.kit === kit);

/** Every value still lifting one kit, tied first, in the order they hang on the harness. */
export const liftedValues = (state: RescueState, kit = 0): number[] => [
  ...tiedOn(state, kit).filter((balloon) => !balloon.popped).map((balloon) => balloon.value),
  ...clippedOn(state, kit).map((taken) => taken.value),
];

/** The bunch slots of those same balloons: tied first, then clipped. */
export const liftedSlots = (state: RescueState, kit = 0): number[] => {
  const tied = tiedOn(state, kit);
  return [
    ...tied.flatMap((balloon, index) => (balloon.popped ? [] : [index])),
    ...clippedOn(state, kit).map((_, index) => tied.length + index),
  ];
};

export const liftOf = (state: RescueState, kit = 0): number => total(liftedValues(state, kit));
/** A popped balloon still hangs on its hook. */
export const hooksUsed = (state: RescueState, kit = 0): number => tiedOn(state, kit).length + clippedOn(state, kit).length;
export const trayTaken = (state: RescueState, index: number): boolean => state.clipped.some((taken) => taken.from === index);
export const canLetGo = (state: RescueState): boolean =>
  !state.rescued && weightsOf(state.def).some((_, kit) => hooksUsed(state, kit) > 0);
/** Anything to undo: a popped balloon, or a clipped one. */
export const canStartOver = (state: RescueState): boolean =>
  !state.rescued && (state.clipped.length > 0 || state.tied.some((balloon) => balloon.popped));

export const outcomesOf = (state: RescueState): Outcome[] =>
  weightsOf(state.def).map((weight, kit) => judge(liftOf(state, kit), weight));

/**
 * The sums the rescue made, one per kit, written out for the moment it lands.
 * That beat is the teaching: the child sees their bunch turned into
 * arithmetic. A pop is written as taking away, because that is what it was.
 */
export function answerLines(state: RescueState): string[] {
  return weightsOf(state.def).map((weight, kit) => {
    const tied = tiedOn(state, kit);
    const popped = tied.filter((balloon) => balloon.popped).map((balloon) => balloon.value);
    const lifted = liftedValues(state, kit);
    if (popped.length > 0) {
      const whole = total(tied.map((balloon) => balloon.value));
      const terms = [String(whole), ...popped.map((value) => `${MINUS} ${value}`), ...clippedOn(state, kit).map((taken) => `+ ${taken.value}`)];
      return `${terms.join(' ')} = ${weight}`;
    }
    return lifted.length > 1 ? `${lifted.join(' + ')} = ${weight}` : String(weight);
  });
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

    clip(index, kit = 0) {
      const value = def.tray[index];
      if (state.rescued || value === undefined || trayTaken(state, index)) return [];
      if (kit < 0 || kit >= kitsOf(def)) return [];
      if (hooksUsed(state, kit) >= hooksOf(def)) return [{ type: 'full' }];
      state.clipped.push({ value, from: index, kit });
      return [{ type: 'clipped', value, kit }];
    },

    unclip(kit, slot) {
      const taken = clippedOn(state, kit)[slot];
      if (state.rescued || !taken) return [];
      state.clipped.splice(state.clipped.indexOf(taken), 1);
      return [{ type: 'unclipped', value: taken.value }];
    },

    togglePop(index) {
      const balloon = state.tied[index];
      if (state.rescued || !balloon) return [];
      balloon.popped = !balloon.popped;
      return [{ type: balloon.popped ? 'popped' : 'reinflated', index, value: balloon.value }];
    },

    startOver() {
      if (!canStartOver(state)) return [];
      for (const balloon of state.tied) balloon.popped = false;
      state.clipped.length = 0;
      return [{ type: 'reset' }];
    },

    letGo() {
      if (!canLetGo(state)) return [];
      state.tries += 1;
      const outcomes = outcomesOf(state);
      if (outcomes.every((outcome) => outcome.verdict === 'exact')) state.rescued = true;
      return [{ type: 'released', outcomes, tries: state.tries }];
    },
  };
}
