import type { AnimalId } from './animals.js';
import { balanceConfigFor, specCount, specOf, type LevelDef } from './level.js';
import { isSatisfied } from './objectives.js';
import { describeSeesaw, type PlacedAnimal, type SeesawSnapshot, type Side, type Zone } from './seesaw-state.js';

export interface TrayItem {
  uid: string;
  species: AnimalId;
  /** How many animals this is: one, or a ready-made group of them. */
  count: number;
  used: boolean;
}

export interface GameState {
  placed: readonly PlacedAnimal[];
  tray: readonly TrayItem[];
  status: 'playing' | 'won';
}

export type GameEvent =
  | { type: 'placed'; animal: PlacedAnimal }
  | { type: 'takenBack'; animal: PlacedAnimal }
  | { type: 'perfectBalance' }
  | { type: 'zoneChanged'; from: Zone; to: Zone }
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

const buildInitial = (level: LevelDef): PlacedAnimal[] => [
  // Each is its own source: a group goes back as a group, but the animals a
  // level starts with are individuals, and lifting one must not take the rest.
  ...level.initial.left.map((species, index) => ({
    uid: `${INITIAL_PREFIX}left-${index}`,
    source: `${INITIAL_PREFIX}left-${index}`,
    species,
    side: 'left' as const,
  })),
  ...level.initial.right.map((species, index) => ({
    uid: `${INITIAL_PREFIX}right-${index}`,
    source: `${INITIAL_PREFIX}right-${index}`,
    species,
    side: 'right' as const,
  })),
];

const buildTray = (level: LevelDef): TrayItem[] =>
  level.tray.map((spec, index) => ({
    uid: `tray-${index}`,
    species: specOf(spec),
    count: specCount(spec),
    used: false,
  }));

/**
 * The rules. Pure: no DOM, no timers, no audio. Everything the presentation
 * layer needs to react to comes back as an event, and the events that matter —
 * perfect balance, zone changes — are edge-triggered, so the bell rings on the
 * move that achieved balance and not on every frame.
 */
export function createGame(level: LevelDef): Game {
  const config = balanceConfigFor(level);

  let placed: PlacedAnimal[] = buildInitial(level);
  let tray: TrayItem[] = buildTray(level);
  let status: GameState['status'] = 'playing';
  /** Numbers the animals lifted off, so each gets its own place in the tray. */
  let freed = 0;

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
    previousSnapshot = next;

    const trayEmptied = !level.requireEmptyTray || tray.every((item) => item.used);
    if (status === 'playing' && trayEmptied && isSatisfied(level.objective, next)) {
      status = 'won';
      events.push({ type: 'levelCleared' });
    }

    return events;
  };

  return {
    get state() {
      return { placed, tray, status };
    },
    level,
    snapshot,

    place(trayIndex, side) {
      if (status === 'won') return [];
      const item = tray[trayIndex];
      if (!item || item.used) return [];

      tray = tray.map((entry, index) => (index === trayIndex ? { ...entry, used: true } : entry));
      // A group lands as its members, so they can be counted where they sit.
      const arrivals: PlacedAnimal[] = Array.from({ length: item.count }, (_, member) => ({
        uid: `${item.uid}#${member}`,
        source: item.uid,
        species: item.species,
        side,
      }));
      placed = [...placed, ...arrivals];

      return [...arrivals.map((animal) => ({ type: 'placed' as const, animal })), ...settle()];
    },

    takeBack(uid) {
      if (status === 'won') return [];
      const animal = placed.find((entry) => entry.uid === uid);
      if (!animal) return [];
      // Lifting an animal the level started with is subtraction, and only the
      // levels built around it allow it.
      if (animal.uid.startsWith(INITIAL_PREFIX) && !level.allowRemoval) return [];

      // A group goes back as a group: it was picked up as one thing.
      const leaving = placed.filter((entry) => entry.source === animal.source);
      placed = placed.filter((entry) => entry.source !== animal.source);

      if (animal.uid.startsWith(INITIAL_PREFIX)) {
        // An animal lifted off the seesaw waits in the tray rather than
        // vanishing. Taking the wrong one off must never be the end of the
        // question: everything that comes off can go back on, either side.
        tray = [
          ...tray,
          ...leaving.map((entry) => ({ uid: `freed-${freed++}`, species: entry.species, count: 1, used: false })),
        ];
      } else {
        tray = tray.map((entry) => (entry.uid === animal.source ? { ...entry, used: false } : entry));
      }

      return [...leaving.map((entry) => ({ type: 'takenBack' as const, animal: entry })), ...settle()];
    },

    reset() {
      placed = buildInitial(level);
      tray = buildTray(level);
      freed = 0;
      status = 'playing';
      previousSnapshot = snapshot();
      return [{ type: 'reset' }];
    },
  };
}
