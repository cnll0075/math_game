import type { AnimalId } from './animals.js';
import type { Objective } from './objectives.js';
import type { BalanceConfig } from './seesaw-state.js';
import { DEFAULT_BALANCE_CONFIG } from './seesaw-state.js';

/**
 * Something the player can pick up: one animal, or a ready-made group of them.
 * A group is placed as a whole, which is what makes "three cats" a single idea
 * rather than three drags.
 */
export type TraySpec = AnimalId | { of: AnimalId; count: number };

export const specOf = (spec: TraySpec): AnimalId => (typeof spec === 'string' ? spec : spec.of);
export const specCount = (spec: TraySpec): number => (typeof spec === 'string' ? 1 : spec.count);

/** The chapters of the game. A new one announces itself when it begins. */
export type SectionId = 'same' | 'make' | 'build' | 'groups' | 'takeoff' | 'share' | 'mixed';

/** Chapter names, written for a six-year-old rather than for a spreadsheet. */
export const SECTION_TITLES: Record<SectionId, string> = {
  same: 'Make It Flat',
  make: 'Who Else Can Come?',
  build: 'Tricky Numbers',
  groups: 'Everybody Together',
  takeoff: 'Time to Go Home',
  share: 'Share and Share Alike',
  mixed: 'A Day at the Park',
};

/** One level is one question. */
export interface LevelDef {
  id: string;
  section: SectionId;
  objective: Objective;
  initial: { left: readonly AnimalId[]; right: readonly AnimalId[] };
  tray: readonly TraySpec[];
  balance?: Partial<BalanceConfig>;
  /**
   * Lets the player lift animals the level started with, not only ones they
   * placed. Taking one off is subtraction, and it is the whole point of the
   * section that turns it on.
   */
  allowRemoval?: boolean;
  /**
   * Every animal in the tray must be seated. Sharing a whole pile evenly is a
   * different problem from making two sides match with some left over.
   */
  requireEmptyTray?: boolean;
  /** The little story this question tells. */
  hint?: string;
  /**
   * Shows a ghost of the plank where it should end up. The opening questions
   * use it to say what "level" means without a word of explanation.
   */
  showTarget?: boolean;
}

export const balanceConfigFor = (level: LevelDef): BalanceConfig => ({
  ...DEFAULT_BALANCE_CONFIG,
  ...level.balance,
});
