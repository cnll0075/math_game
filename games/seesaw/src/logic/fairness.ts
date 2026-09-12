import type { BalanceConfig } from './seesaw-state.js';

/** A weight at or above this counts as heavy for pacing purposes. */
export const HEAVY_WEIGHT = 3;

export interface ArrivalContext {
  weight: number;
  balanceDifference: number;
  config: BalanceConfig;
  /** How many heavy animals have arrived in a row already. */
  recentHeavy: number;
  maxHeavyRun?: number;
}

/**
 * The smallest imbalance the player could be left with, having placed this
 * animal on whichever side suits them best.
 */
export function bestOutcome(balanceDifference: number, weight: number): number {
  return Math.min(Math.abs(balanceDifference + weight), Math.abs(balanceDifference - weight));
}

/**
 * Whether sending this animal now is fair. The generator proposes; this
 * disposes, so difficulty is tuned in one place rather than smeared through the
 * random draw (source spec 34).
 *
 * The rule that matters: after placing it on their better side, the player must
 * still be out of the red. An animal that dooms them whichever side they choose
 * is not a challenge, it is a trap.
 */
export function isFairArrival(context: ArrivalContext): boolean {
  const { weight, balanceDifference, config, recentHeavy } = context;

  // The lightest animal is always allowed: without this the generator could run
  // out of acceptable candidates and stall the round.
  if (weight <= 1) return true;

  const maxHeavyRun = context.maxHeavyRun ?? 2;
  if (weight >= HEAVY_WEIGHT && recentHeavy >= maxHeavyRun) return false;

  return bestOutcome(balanceDifference, weight) <= config.yellow;
}
