import { createGame, type Game, type GameEvent } from './logic/game.js';
import { createArcadeRun, type ArcadeEvent, type ArcadeRun, type ArcadeStats } from './logic/arcade.js';
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
  /** How the round went, for an endless level; null for a puzzle. */
  stats(): ArcadeStats | null;
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
      // Changes whenever the player is being asked for something new, which is
      // what makes the goal announce itself.
      goalToken: `${game.level.id}:${game.state.stage}`,
      stages: stageCount(game.level.objective),
      stagesCleared: game.state.status === 'won' ? stageCount(game.level.objective) : game.state.stage,
      secondsRemaining: null,
      showPlacementHint: false,
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
      wind: STILL_AIR,
      survivalSeconds: null,
      bestSeconds: null,
    }),
    tick: () => [],
    stats: () => null,
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

const STILL_AIR = { phase: 'calm', side: 'left', strength: 0, through: 0 } as const;

function arcadeDriver(run: ArcadeRun, best: number | null): Driver {
  /** The hint stays up until the player has seated an animal themselves. */
  let playerPlacements = 0;

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
      goalToken: `${run.level.id}`,
      stages: 1,
      stagesCleared: run.state.status === 'won' ? 1 : 0,
      secondsRemaining: run.target === null ? null : Math.max(0, run.target - run.state.elapsed),
      // The arcade has no "pick up" step, so without this there is nothing on
      // screen saying that tapping a side is what seats the animal.
      showPlacementHint: playerPlacements < 2 && run.state.queue.length > 0,
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
      wind: {
        phase: run.state.wind.phase,
        side: run.state.wind.side,
        strength: Math.abs(run.state.wind.bias),
        through: run.state.wind.through,
      },
      survivalSeconds: run.target === null ? run.state.elapsed : null,
      bestSeconds: run.target === null ? best : null,
    }),
    tick: (dt) => run.tick(dt),
    stats: () => run.state.stats,
    drop: (side) => {
      const events = run.place(side);
      if (events.length > 0) playerPlacements += 1;
      return events;
    },
    pick: () => {},
    takeBack: () => [],
  };
}

export function createDriver(level: LevelDef, best: number | null = null): Driver {
  return isArcade(level) ? arcadeDriver(createArcadeRun(level), best) : puzzleDriver(createGame(level));
}

/** The run just finished, for a session that wants to record it. */
export function statsOf(driver: Driver): ArcadeStats | null {
  return driver.stats();
}
