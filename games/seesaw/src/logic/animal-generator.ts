import { createRng, type Rng } from '@bundle/core';
import { weightOf, type AnimalId } from './animals.js';
import { HEAVY_WEIGHT, isFairArrival } from './fairness.js';
import type { BalanceConfig } from './seesaw-state.js';

export interface GeneratorSettings {
  seed: number;
  pool: readonly AnimalId[];
  config: BalanceConfig;
  maxHeavyRun?: number;
}

export interface AnimalGenerator {
  /** The next arrival, given how the seesaw currently leans. */
  next(balanceDifference: number): AnimalId;
}

/** How many candidates to try before accepting whatever is lightest. */
const MAX_ATTEMPTS = 12;

const lightest = (pool: readonly AnimalId[]): AnimalId =>
  [...pool].sort((a, b) => weightOf(a) - weightOf(b))[0]!;

/**
 * Chooses what arrives next. It proposes a candidate from the pool; the
 * fairness validator decides whether the situation it would create is playable.
 * Keeping the two apart means difficulty can be tuned without touching the
 * random draw (source spec 34).
 */
export function createAnimalGenerator(settings: GeneratorSettings): AnimalGenerator {
  const rng: Rng = createRng(settings.seed);
  const fallback = lightest(settings.pool);
  let recentHeavy = 0;

  const record = (animal: AnimalId): AnimalId => {
    recentHeavy = weightOf(animal) >= HEAVY_WEIGHT ? recentHeavy + 1 : 0;
    return animal;
  };

  return {
    next(balanceDifference) {
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        const candidate = rng.pick(settings.pool);
        const fair = isFairArrival({
          weight: weightOf(candidate),
          balanceDifference,
          config: settings.config,
          recentHeavy,
          ...(settings.maxHeavyRun === undefined ? {} : { maxHeavyRun: settings.maxHeavyRun }),
        });
        if (fair) return record(candidate);
      }
      // Nothing passed: send the lightest animal in the pool, which is the
      // least bad option and always lets the round continue.
      return record(fallback);
    },
  };
}
