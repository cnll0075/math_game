import type { LevelDef } from './levels.data.js';
import { SPECIES } from './species.js';

/** Every weight swimming in a level. */
export const weightsIn = (def: LevelDef): number[] =>
  [...new Set(def.fish.map(({ species }) => SPECIES[species].weight))].sort((a, b) => a - b);

/**
 * Whether `amount` can be made from these weights, any number of each. A caught
 * fish is always replaced by its kind, so this is exactly what the bay can
 * still give.
 */
export function reachable(amount: number, weights: readonly number[]): boolean {
  if (amount < 0) return false;
  const can = [true];
  for (let value = 1; value <= amount; value += 1) {
    can[value] = weights.some((weight) => weight <= value && can[value - weight] === true);
  }
  return can[amount] === true;
}
