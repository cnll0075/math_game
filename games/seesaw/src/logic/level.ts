import type { AnimalId } from './animals.js';
import type { Objective } from './objectives.js';
import type { BalanceConfig } from './seesaw-state.js';
import { DEFAULT_BALANCE_CONFIG } from './seesaw-state.js';

/**
 * A level is data. Gameplay code never branches on a level id: everything a
 * level changes is expressed here.
 */
export interface LevelDef {
  id: string;
  mode: 'puzzle';
  title: string;
  objective: Objective;
  initial: { left: readonly AnimalId[]; right: readonly AnimalId[] };
  tray: readonly AnimalId[];
  balance?: Partial<BalanceConfig>;
  /** One short line shown once; the level should be readable without it. */
  hint?: string;
}

export const balanceConfigFor = (level: LevelDef): BalanceConfig => ({
  ...DEFAULT_BALANCE_CONFIG,
  ...level.balance,
});
