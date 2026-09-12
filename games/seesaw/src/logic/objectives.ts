import type { SeesawSnapshot, Side } from './seesaw-state.js';

/**
 * What a level asks the player to make happen. New kinds can be added for the
 * arcade half without touching existing evaluators.
 */
export type Objective =
  | { kind: 'balance' }
  | { kind: 'sideDown'; side: Side }
  | { kind: 'tilt'; target: number }
  | { kind: 'sequence'; challenges: readonly Objective[] }
  | { kind: 'survive'; seconds: number };

export function stageCount(objective: Objective): number {
  return objective.kind === 'sequence' ? objective.challenges.length : 1;
}

/** The challenge the player is working on right now. */
export function currentChallenge(objective: Objective, stage: number): Objective {
  if (objective.kind !== 'sequence') return objective;
  const index = Math.min(Math.max(stage, 0), objective.challenges.length - 1);
  return objective.challenges[index] ?? objective;
}

/**
 * Whether a single challenge is met by the current mathematical state. A
 * sequence is never satisfied directly; the game advances it stage by stage.
 */
export function isSatisfied(objective: Objective, snapshot: SeesawSnapshot): boolean {
  switch (objective.kind) {
    case 'balance':
      return snapshot.isPerfectlyBalanced;
    case 'sideDown':
      return snapshot.heavySide === objective.side;
    case 'tilt':
      return snapshot.balanceDifference === objective.target;
    case 'sequence':
      return false;
    case 'survive':
      // Survival is a matter of the clock, not of the current weights; the
      // arcade run decides it.
      return false;
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
    case 'sequence':
      return describeObjective(currentChallenge(objective, 0));
    case 'survive':
      return 'Keep everyone safe';
    default: {
      const exhaustive: never = objective;
      return exhaustive;
    }
  }
}
