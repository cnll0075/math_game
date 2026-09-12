import { createGame, type Game, type GameEvent } from './logic/game.js';
import { createArcadeRun, type ArcadeEvent, type ArcadeRun } from './logic/arcade.js';
import { balanceConfigFor, isArcade, type LevelDef } from './logic/level.js';
import { currentChallenge, describeObjective, stageCount } from './logic/objectives.js';
import type { PlacedAnimal, SeesawSnapshot, Side } from './logic/seesaw-state.js';
import type { SceneModel } from './view/scene.js';

export type SessionEvent = GameEvent | ArcadeEvent;

/** What the session model needs from whichever mode is running. */
export type DriverModel = Omit<SceneModel, 'snapshot' | 'placed' | 'gateOpen' | 'celebrating' | 'dancing'>;

/**
 * The two modes behave differently enough to deserve separate rules, and alike
 * enough that everything around them — scene, sound, input, the frame loop —
 * should not care which is running. This is that seam.
 */
export interface Driver {
  readonly status: 'playing' | 'won' | 'lost';
  snapshot(): SeesawSnapshot;
  placed(): readonly PlacedAnimal[];
  model(): DriverModel;
  /** Advances any clock the mode has. Puzzles have none. */
  tick(dt: number): SessionEvent[];
  /** The player chose a side. */
  drop(side: Side): SessionEvent[];
  /** The player picked up a tray animal. Puzzle only. */
  pick(trayIndex: number): void;
  /** The player tapped a placed animal. Puzzle only. */
  takeBack(uid: string): SessionEvent[];
  /** Whether a side tap would place something right now. */
  readonly armed: boolean;
}

function puzzleDriver(game: Game): Driver {
  let selected: number | null = null;

  const stageLabel = (): string | null => {
    const total = stageCount(game.level.objective);
    return total > 1 ? `${Math.min(game.state.stage + 1, total)} of ${total}` : null;
  };

  const targetBalance = (): number | null => {
    const challenge = currentChallenge(game.level.objective, game.state.stage);
    if (challenge.kind !== 'tilt') return null;
    return challenge.target / balanceConfigFor(game.level).maxTiltDifference;
  };

  return {
    get status() {
      return game.state.status;
    },
    get armed() {
      return selected !== null;
    },
    snapshot: () => game.snapshot(),
    placed: () => game.state.placed,
    model: () => ({
      targetBalance: targetBalance(),
      tray: game.state.tray,
      selectedTrayIndex: selected,
      caption: describeObjective(currentChallenge(game.level.objective, game.state.stage)),
      stageLabel: stageLabel(),
      won: game.state.status === 'won',
      queue: [],
      progress: null,
      impatience: 0,
      danger: 0,
    }),
    tick: () => [],
    drop(side) {
      if (selected === null) return [];
      const events = game.place(selected, side);
      selected = null;
      return events;
    },
    pick(trayIndex) {
      selected = trayIndex;
    },
    takeBack: (uid) => game.takeBack(uid),
  };
}

function arcadeDriver(run: ArcadeRun): Driver {
  return {
    get status() {
      return run.state.status;
    },
    // In the arcade there is nothing to pick up: a tap on a side always places
    // the animal that is waiting.
    armed: true,
    snapshot: () => run.snapshot(),
    placed: () => run.state.placed,
    model: () => ({
      targetBalance: null,
      tray: [],
      selectedTrayIndex: null,
      caption: describeObjective(run.level.objective),
      stageLabel: null,
      won: run.state.status === 'won',
      queue: run.state.queue,
      progress: run.progress,
      impatience: run.state.impatience,
      danger: run.state.danger,
    }),
    tick: (dt) => run.tick(dt),
    drop: (side) => run.place(side),
    pick: () => {},
    takeBack: () => [],
  };
}

export function createDriver(level: LevelDef): Driver {
  return isArcade(level) ? arcadeDriver(createArcadeRun(level)) : puzzleDriver(createGame(level));
}
