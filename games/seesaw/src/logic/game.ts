import type { AnimalId } from './animals.js';
import { balanceConfigFor, objectiveFor, roundAt, roundCount, type LevelDef } from './level.js';
import { isSatisfied } from './objectives.js';
import { describeSeesaw, type PlacedAnimal, type SeesawSnapshot, type Side, type Zone } from './seesaw-state.js';

export interface TrayItem {
  uid: string;
  species: AnimalId;
  used: boolean;
}

export interface GameState {
  placed: readonly PlacedAnimal[];
  tray: readonly TrayItem[];
  /** Which round of the level is being played. */
  round: number;
  status: 'playing' | 'won';
}

export type GameEvent =
  | { type: 'placed'; animal: PlacedAnimal }
  | { type: 'takenBack'; animal: PlacedAnimal }
  | { type: 'perfectBalance' }
  | { type: 'zoneChanged'; from: Zone; to: Zone }
  | { type: 'roundCleared'; round: number }
  | { type: 'levelCleared' }
  | { type: 'reset' };

export interface Game {
  readonly state: GameState;
  readonly level: LevelDef;
  place(trayIndex: number, side: Side): GameEvent[];
  takeBack(uid: string): GameEvent[];
  reset(): GameEvent[];
  snapshot(): SeesawSnapshot;
}

/** Animals a round starts with. Whether they can be lifted is a level's choice. */
const INITIAL_PREFIX = 'init-';

const buildInitial = (level: LevelDef, round: number): PlacedAnimal[] => {
  const { initial } = roundAt(level, round);
  return [
    ...initial.left.map((species, index) => ({ uid: `${INITIAL_PREFIX}left-${index}`, species, side: 'left' as const })),
    ...initial.right.map((species, index) => ({ uid: `${INITIAL_PREFIX}right-${index}`, species, side: 'right' as const })),
  ];
};

const buildTray = (level: LevelDef, round: number): TrayItem[] =>
  roundAt(level, round).tray.map((species, index) => ({ uid: `tray-${index}`, species, used: false }));

/**
 * The rules. Pure: no DOM, no timers, no audio. Everything the presentation
 * layer needs to react to comes back as an event, and the events that matter —
 * perfect balance, zone changes — are edge-triggered, so the bell rings on the
 * move that achieved balance and not on every frame.
 */
export function createGame(level: LevelDef): Game {
  const config = balanceConfigFor(level);
  const rounds = roundCount(level);

  let round = 0;
  let placed: PlacedAnimal[] = buildInitial(level, round);
  let tray: TrayItem[] = buildTray(level, round);
  let status: GameState['status'] = 'playing';

  let previousSnapshot = describeSeesaw(placed, config);

  const snapshot = (): SeesawSnapshot => describeSeesaw(placed, config);

  const startRound = (index: number): void => {
    round = index;
    placed = buildInitial(level, index);
    tray = buildTray(level, index);
    previousSnapshot = snapshot();
  };

  /** Compares the new state against the previous one and reports what changed. */
  const settle = (): GameEvent[] => {
    const events: GameEvent[] = [];
    const next = snapshot();

    if (next.zone !== previousSnapshot.zone) {
      events.push({ type: 'zoneChanged', from: previousSnapshot.zone, to: next.zone });
    }
    if (next.isPerfectlyBalanced && !previousSnapshot.isPerfectlyBalanced) {
      events.push({ type: 'perfectBalance' });
    }
    previousSnapshot = next;

    const trayEmptied = !level.requireEmptyTray || tray.every((item) => item.used);
    if (status === 'playing' && trayEmptied && isSatisfied(objectiveFor(level, round), next)) {
      events.push({ type: 'roundCleared', round });
      if (round + 1 >= rounds) {
        status = 'won';
        events.push({ type: 'levelCleared' });
      } else {
        startRound(round + 1);
      }
    }

    return events;
  };

  return {
    get state() {
      return { placed, tray, round, status };
    },
    level,
    snapshot,

    place(trayIndex, side) {
      if (status === 'won') return [];
      const item = tray[trayIndex];
      if (!item || item.used) return [];

      tray = tray.map((entry, index) => (index === trayIndex ? { ...entry, used: true } : entry));
      const animal: PlacedAnimal = { uid: item.uid, species: item.species, side };
      placed = [...placed, animal];

      return [{ type: 'placed', animal }, ...settle()];
    },

    takeBack(uid) {
      if (status === 'won') return [];
      // Lifting an animal the round started with is subtraction, and only the
      // levels built around it allow it.
      if (uid.startsWith(INITIAL_PREFIX) && !level.allowRemoval) return [];
      const animal = placed.find((entry) => entry.uid === uid);
      if (!animal) return [];

      placed = placed.filter((entry) => entry.uid !== uid);
      tray = tray.map((entry) => (entry.uid === uid ? { ...entry, used: false } : entry));

      return [{ type: 'takenBack', animal }, ...settle()];
    },

    reset() {
      startRound(0);
      status = 'playing';
      return [{ type: 'reset' }];
    },
  };
}
