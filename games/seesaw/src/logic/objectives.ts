import type { SeesawSnapshot, Side } from './seesaw-state.js';

/**
 * What a round asks for. Levels are made of rounds, so there is no longer a
 * "several things in a row" objective: a level whose rounds ask different
 * things is simply a level whose rounds ask different things.
 */
export type Objective =
  | { kind: 'balance' }
  | { kind: 'sideDown'; side: Side }
  | { kind: 'tilt'; target: number };

/** Whether a round's goal is met by the current mathematical state. */
export function isSatisfied(objective: Objective, snapshot: SeesawSnapshot): boolean {
  switch (objective.kind) {
    case 'balance':
      return snapshot.isPerfectlyBalanced;
    case 'sideDown':
      return snapshot.heavySide === objective.side;
    case 'tilt':
      return snapshot.balanceDifference === objective.target;
    default: {
      const exhaustive: never = objective;
      return exhaustive;
    }
  }
}

/** A short caption a five-year-old can be read once and then ignore. */
export function describeObjective(objective: Objective): string {
  switch (objective.kind) {
    case 'balance':
      return 'Make it level';
    case 'sideDown':
      return `Make the ${objective.side} side go down`;
    case 'tilt':
      return 'Reach the star';
    default: {
      const exhaustive: never = objective;
      return exhaustive;
    }
  }
}
