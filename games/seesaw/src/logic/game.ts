import type { AnimalId } from './animals.js';
import { balanceConfigFor, type LevelDef } from './level.js';
import { currentChallenge, isSatisfied, stageCount } from './objectives.js';
import { describeSeesaw, type PlacedAnimal, type SeesawSnapshot, type Side, type Zone } from './seesaw-state.js';

export interface TrayItem {
  uid: string;
  species: AnimalId;
  used: boolean;
}

export interface GameState {
  placed: readonly PlacedAnimal[];
  tray: readonly TrayItem[];
  stage: number;
  status: 'playing' | 'won';
}

export type GameEvent =
  | { type: 'placed'; animal: PlacedAnimal }
  | { type: 'takenBack'; animal: PlacedAnimal }
  | { type: 'perfectBalance' }
  | { type: 'zoneChanged'; from: Zone; to: Zone }
  | { type: 'stageCleared'; stage: number }
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

/** Animals the level starts with cannot be taken back; this marks them. */
const INITIAL_PREFIX = 'init-';

const buildInitial = (level: LevelDef): PlacedAnimal[] => [
  ...level.initial.left.map((species, index) => ({ uid: `${INITIAL_PREFIX}left-${index}`, species, side: 'left' as const })),
  ...level.initial.right.map((species, index) => ({ uid: `${INITIAL_PREFIX}right-${index}`, species, side: 'right' as const })),
];

const buildTray = (level: LevelDef): TrayItem[] =>
  level.tray.map((species, index) => ({ uid: `tray-${index}`, species, used: false }));

/**
 * The rules of the seesaw game. Pure: no DOM, no timers, no audio. Everything
 * the presentation layer needs to react to comes back as an event, and the
 * events that matter — perfect balance, zone changes — are edge-triggered, so
 * the bell rings on the move that achieved balance and not on every frame.
 */
export function createGame(level: LevelDef): Game {
  const config = balanceConfigFor(level);
  const totalStages = stageCount(level.objective);

  let placed: PlacedAnimal[] = buildInitial(level);
  let tray: TrayItem[] = buildTray(level);
  let stage = 0;
  let status: GameState['status'] = 'playing';

  let previousSnapshot = describeSeesaw(placed, config);

  const snapshot = (): SeesawSnapshot => describeSeesaw(placed, config);

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

    if (status === 'playing' && isSatisfied(currentChallenge(level.objective, stage), next)) {
      events.push({ type: 'stageCleared', stage });
      if (stage + 1 >= totalStages) {
        status = 'won';
        events.push({ type: 'levelCleared' });
      } else {
        stage += 1;
      }
    }

    previousSnapshot = next;
    return events;
  };

  return {
    get state() {
      return { placed, tray, stage, status };
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
      if (uid.startsWith(INITIAL_PREFIX)) return [];
      const animal = placed.find((entry) => entry.uid === uid);
      if (!animal) return [];

      placed = placed.filter((entry) => entry.uid !== uid);
      tray = tray.map((entry) => (entry.uid === uid ? { ...entry, used: false } : entry));

      return [{ type: 'takenBack', animal }, ...settle()];
    },

    reset() {
      placed = buildInitial(level);
      tray = buildTray(level);
      stage = 0;
      status = 'playing';
      previousSnapshot = snapshot();
      return [{ type: 'reset' }];
    },
  };
}
