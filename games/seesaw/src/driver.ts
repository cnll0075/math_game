import { createGame, type Game, type GameEvent } from './logic/game.js';
import { balanceConfigFor, SECTION_TITLES, type LevelDef } from './logic/level.js';
import { levelsInSection } from './logic/levels.data.js';
import { describeObjective } from './logic/objectives.js';
import type { PlacedAnimal, SeesawSnapshot, Side } from './logic/seesaw-state.js';
import type { SceneModel } from './view/scene.js';

export type SessionEvent = GameEvent;

/** What the scene needs from the level being played. */
export type DriverModel = Omit<SceneModel, 'snapshot' | 'placed' | 'celebrating' | 'dancing'>;

/**
 * Everything around the rules — scene, sound, input, the frame loop — talks to
 * the level through this, so none of them need to know how a level is built.
 */
export interface Driver {
  readonly status: 'playing' | 'won';
  snapshot(): SeesawSnapshot;
  placed(): readonly PlacedAnimal[];
  model(): DriverModel;
  /** The player chose a side for the animal they are holding. */
  drop(side: Side): SessionEvent[];
  /** The player picked up a tray animal; -1 puts it back down. */
  pick(trayIndex: number): void;
  /** The player tapped an animal on the seesaw. */
  takeBack(uid: string): SessionEvent[];
  /** Whether a side tap would place something right now. */
  readonly armed: boolean;
  /** The animal being held, for the sound a touch makes. */
  readonly holding: PlacedAnimal['species'] | null;
}

export function createDriver(level: LevelDef): Driver {
  const game: Game = createGame(level);
  let selected: number | null = null;

  const targetBalance = (): number | null => {
    if (level.objective.kind !== 'tilt') return null;
    return level.objective.target / balanceConfigFor(level).maxTiltDifference;
  };

  // Progress through the chapter, so a level does not feel like an island.
  const siblings = levelsInSection(level.section);
  const placeInSection = siblings.findIndex((entry) => entry.id === level.id);

  return {
    get status() {
      return game.state.status;
    },
    get armed() {
      return selected !== null;
    },
    get holding() {
      if (selected === null) return null;
      return game.state.tray[selected]?.species ?? null;
    },
    snapshot: () => game.snapshot(),
    placed: () => game.state.placed,
    model: () => ({
      // Changes whenever the player is being asked for something new, which is
      // what makes the goal announce itself.
      goalToken: level.id,
      // Only the first question of a chapter announces the chapter's name.
      chapter: placeInSection === 0 ? SECTION_TITLES[level.section] : null,
      targetBalance: targetBalance(),
      tray: game.state.tray,
      selectedTrayIndex: selected,
      caption: level.hint ?? describeObjective(level.objective),
      won: game.state.status === 'won',
    }),
    drop(side) {
      if (selected === null) return [];
      const events = game.place(selected, side);
      selected = null;
      return events;
    },
    pick(trayIndex) {
      selected = trayIndex < 0 ? null : trayIndex;
    },
    takeBack: (uid) => game.takeBack(uid),
  };
}
