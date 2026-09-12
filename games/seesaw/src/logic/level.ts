import type { AnimalId } from './animals.js';
import type { Objective } from './objectives.js';
import type { BalanceConfig } from './seesaw-state.js';
import { DEFAULT_BALANCE_CONFIG } from './seesaw-state.js';

interface LevelCommon {
  id: string;
  title: string;
  initial: { left: readonly AnimalId[]; right: readonly AnimalId[] };
  balance?: Partial<BalanceConfig>;
  /** One short line shown once; the level should be readable without it. */
  hint?: string;
}

/**
 * A puzzle level: a fixed set of animals and one outcome to produce. Nothing
 * moves unless the player moves it.
 */
export interface PuzzleLevelDef extends LevelCommon {
  mode: 'puzzle';
  objective: Objective;
  tray: readonly AnimalId[];
}

/** How an arcade round generates and paces itself. */
export interface ArcadeSettings {
  /** Fixed seed: a level plays out the same way every time it is opened. */
  seed: number;
  /** Species that can arrive. */
  pool: readonly AnimalId[];
  /** Seconds between arrivals at the start of the round. */
  arrivalSeconds: number;
  /** Seconds between arrivals by the end of the round, if it should quicken. */
  finalArrivalSeconds?: number;
  /** How many animals wait to be placed, the current one included. */
  queueLength: number;
  /** How long an animal stays before wandering off, as [min, max] seconds. */
  staySeconds: readonly [number, number];
  /**
   * How long the animal at the head of the queue waits to be placed before it
   * climbs on by itself, picking a side at random. This is what makes ignoring
   * the game dangerous rather than safe.
   */
  patienceSeconds: number;
  /** Seconds in the red before the round ends. */
  dangerFillSeconds: number;
  /** Seconds of safety needed to clear a full danger meter. */
  dangerDrainSeconds: number;
  /** Most heavy animals the generator will send in a row. */
  maxHeavyRun?: number;
}

/**
 * An arcade level: animals keep arriving, animals keep leaving, and the player
 * keeps the seesaw out of trouble for a while.
 */
export interface ArcadeLevelDef extends LevelCommon {
  mode: 'arcade';
  objective: { kind: 'survive'; seconds: number };
  arcade: ArcadeSettings;
}

export type LevelDef = PuzzleLevelDef | ArcadeLevelDef;

export const isArcade = (level: LevelDef): level is ArcadeLevelDef => level.mode === 'arcade';
export const isPuzzle = (level: LevelDef): level is PuzzleLevelDef => level.mode === 'puzzle';

export const balanceConfigFor = (level: LevelDef): BalanceConfig => ({
  ...DEFAULT_BALANCE_CONFIG,
  ...level.balance,
});
