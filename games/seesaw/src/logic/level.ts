import type { AnimalId } from './animals.js';
import type { Objective } from './objectives.js';
import type { BalanceConfig } from './seesaw-state.js';
import { DEFAULT_BALANCE_CONFIG } from './seesaw-state.js';

/**
 * One problem. A level is several of these: the same idea met a few times with
 * different numbers, because a five-year-old meeting "2 and 3 make 5" once has
 * not met it.
 */
export interface LevelRound {
  /** What is already on the seesaw. */
  initial: { left: readonly AnimalId[]; right: readonly AnimalId[] };
  /** What the player has to work with. Choosing this is choosing the problem. */
  tray: readonly AnimalId[];
  /** Overrides the level's goal, for a level whose rounds ask different things. */
  objective?: Objective;
}

export interface LevelDef {
  id: string;
  title: string;
  /** The goal for every round that does not name its own. */
  objective: Objective;
  rounds: readonly LevelRound[];
  balance?: Partial<BalanceConfig>;
  /**
   * Lets the player lift animals the level started with, not only ones they
   * placed. Taking one off is subtraction, and it is the whole point of the
   * levels that turn it on.
   */
  allowRemoval?: boolean;
  /**
   * Every animal in the tray must be seated. Sharing a whole pile evenly is a
   * different problem from making two sides match with some left over.
   */
  requireEmptyTray?: boolean;
  /** One short line shown once; the level should be readable without it. */
  hint?: string;
}

export const balanceConfigFor = (level: LevelDef): BalanceConfig => ({
  ...DEFAULT_BALANCE_CONFIG,
  ...level.balance,
});

export const roundCount = (level: LevelDef): number => level.rounds.length;

export const roundAt = (level: LevelDef, index: number): LevelRound => {
  const round = level.rounds[Math.min(Math.max(index, 0), level.rounds.length - 1)];
  if (!round) throw new Error(`level ${level.id} has no rounds`);
  return round;
};

export const objectiveFor = (level: LevelDef, index: number): Objective =>
  roundAt(level, index).objective ?? level.objective;
