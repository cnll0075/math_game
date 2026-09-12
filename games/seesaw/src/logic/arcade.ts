import { createRng } from '@bundle/core';
import type { AnimalId } from './animals.js';
import { createAnimalGenerator } from './animal-generator.js';
import { balanceConfigFor, type ArcadeLevelDef } from './level.js';
import { describeSeesaw, type PlacedAnimal, type SeesawSnapshot, type Side, type Zone } from './seesaw-state.js';
import { createWind, type Wind, type WindPhase, type WindState } from './wind.js';

export interface ArcadeAnimal extends PlacedAnimal {
  /** Seconds of stay remaining before this animal wanders off. */
  leavesIn: number;
}

/** What a round is worth remembering by, for the endless park. */
export interface ArcadeStats {
  secondsSurvived: number;
  animalsHandled: number;
  perfectBalances: number;
  longestStreak: number;
  /** Times the seesaw reached the red and was pulled back out of it. */
  nearMisses: number;
}

export interface ArcadeState {
  placed: readonly ArcadeAnimal[];
  /** Waiting animals; the first is the one the player is placing. */
  queue: readonly AnimalId[];
  elapsed: number;
  /** 0..1 how close the waiting animal is to climbing on by itself. */
  impatience: number;
  /** 0..1. Fills in the red, drains in safety, ends the round when full. */
  danger: number;
  status: 'playing' | 'won' | 'lost';
  wind: WindState;
  stats: ArcadeStats;
}

export type ArcadeEvent =
  | { type: 'placed'; animal: PlacedAnimal; chosenByPlayer: boolean }
  | { type: 'arrived'; species: AnimalId }
  | { type: 'left'; animal: PlacedAnimal }
  | { type: 'perfectBalance' }
  | { type: 'zoneChanged'; from: Zone; to: Zone }
  | { type: 'levelCleared' }
  | { type: 'roundLost' }
  | { type: 'windChanged'; phase: WindPhase };

export interface ArcadeRun {
  readonly state: ArcadeState;
  readonly level: ArcadeLevelDef;
  /** Advances the clock. Returns everything that happened in this slice. */
  tick(dt: number): ArcadeEvent[];
  /** Puts the animal at the head of the queue onto a side. */
  place(side: Side): ArcadeEvent[];
  snapshot(): SeesawSnapshot;
  /** 0..1 progress towards surviving the round, or null when endless. */
  readonly progress: number | null;
  /** Seconds this round must last, or null when endless. */
  readonly target: number | null;
}

/** Longest slice the run will simulate at once, so a stall cannot skip events. */
const MAX_SLICE = 1 / 30;

/** How quickly help arrives when the player is stuck in the red with nothing to place. */
const RESCUE_SECONDS = 0.4;

/**
 * An arcade round. Animals arrive on a timer and wander off after a while, so
 * the balance drifts even when the player does nothing — standing still is not
 * safe, which is what gives the mode its pressure.
 */
export function createArcadeRun(level: ArcadeLevelDef): ArcadeRun {
  const config = balanceConfigFor(level);
  const settings = level.arcade;
  /** Seconds the round must last, or null when it simply goes on. */
  const target = level.objective.kind === 'survive' ? level.objective.seconds : null;
  const wind: Wind | null = settings.wind
    ? createWind({ ...settings.wind, seed: settings.seed * 7 + 3 })
    : null;
  const generator = createAnimalGenerator({
    seed: settings.seed,
    pool: settings.pool,
    config,
    ...(settings.maxHeavyRun === undefined ? {} : { maxHeavyRun: settings.maxHeavyRun }),
  });
  // Separate streams, so changing one does not reshuffle the others.
  const stayRng = createRng(settings.seed * 31 + 17);
  const sideRng = createRng(settings.seed * 53 + 11);

  let placed: ArcadeAnimal[] = [
    ...level.initial.left.map((species, i) => ({ uid: `init-left-${i}`, species, side: 'left' as const, leavesIn: Infinity })),
    ...level.initial.right.map((species, i) => ({ uid: `init-right-${i}`, species, side: 'right' as const, leavesIn: Infinity })),
  ];
  let queue: AnimalId[] = [];
  let elapsed = 0;
  let danger = 0;
  let status: ArcadeState['status'] = 'playing';
  let untilArrival = 0;
  let waited = 0;
  let nextUid = 0;
  let animalsHandled = 0;
  let perfectBalances = 0;
  let streak = 0;
  let longestStreak = 0;
  let nearMisses = 0;

  let previous = describeSeesaw(placed, config);

  const snapshot = (): SeesawSnapshot => describeSeesaw(placed, config, wind?.bias ?? 0);

  /**
   * Arrivals quicken across a round. A timed level interpolates towards its
   * final pace; an endless one keeps tightening towards a floor, which is what
   * eventually ends every run.
   */
  const arrivalGap = (): number => {
    if (settings.ramp) {
      const through = Math.min(1, elapsed / settings.ramp.overSeconds);
      return settings.arrivalSeconds + (settings.ramp.arrivalFloorSeconds - settings.arrivalSeconds) * through;
    }
    const end = settings.finalArrivalSeconds ?? settings.arrivalSeconds;
    const through = target === null ? 0 : Math.min(1, elapsed / target);
    return settings.arrivalSeconds + (end - settings.arrivalSeconds) * through;
  };

  const stayTime = (): number => {
    const [min, max] = settings.staySeconds;
    return min + stayRng.next() * (max - min);
  };

  /**
   * Puts the waiting animal onto a side. When the player does not choose, the
   * animal climbs onto whichever side is already down, because that is the end
   * it can reach — so ignoring the game makes a lean worse, not better.
   */
  const put = (side: Side, chosenByPlayer: boolean): ArcadeEvent[] => {
    const species = queue.shift();
    if (!species) return [];
    waited = 0;

    const animal: ArcadeAnimal = {
      uid: `arcade-${nextUid++}`,
      species,
      side,
      leavesIn: stayTime(),
    };
    placed = [...placed, animal];
    animalsHandled += 1;
    return [{ type: 'placed', animal, chosenByPlayer }, ...settle()];
  };

  /** Reports zone changes and perfect balance, both edge-triggered as ever. */
  const settle = (): ArcadeEvent[] => {
    const events: ArcadeEvent[] = [];
    const next = snapshot();
    if (next.zone !== previous.zone) events.push({ type: 'zoneChanged', from: previous.zone, to: next.zone });
    if (next.isPerfectlyBalanced && !previous.isPerfectlyBalanced) {
      events.push({ type: 'perfectBalance' });
      perfectBalances += 1;
      streak += 1;
      longestStreak = Math.max(longestStreak, streak);
    } else if (!next.isPerfectlyBalanced && previous.isPerfectlyBalanced) {
      streak = 0;
    }
    // Reaching the red and getting back out again is the near miss worth
    // counting; sitting in it is just losing slowly.
    if (previous.zone === 'red' && next.zone !== 'red') nearMisses += 1;
    previous = next;
    return events;
  };

  const admitOne = (events: ArcadeEvent[]): void => {
    // The generator judges fairness against the snapshot, which already counts
    // the wind: an animal is only offered if it can be placed safely in the
    // weather that is actually blowing.
    const species = generator.next(snapshot().balanceDifference);
    queue.push(species);
    events.push({ type: 'arrived', species });
  };

  // The queue starts full so the player has something to plan with.
  while (queue.length < settings.queueLength) admitOne([]);

  const step = (dt: number): ArcadeEvent[] => {
    const events: ArcadeEvent[] = [];
    if (status !== 'playing') return events;

    elapsed += dt;

    const weather = wind?.tick(dt);
    if (weather) events.push({ type: 'windChanged', phase: weather });

    // Animals wander off, which shifts the balance without the player acting.
    const staying: ArcadeAnimal[] = [];
    for (const animal of placed) {
      const leavesIn = animal.leavesIn - dt;
      if (leavesIn <= 0) events.push({ type: 'left', animal });
      else staying.push({ ...animal, leavesIn });
    }
    // Always reassign: the decremented stay times are the countdown itself.
    placed = staying;

    // Supply is the pacing: one animal becomes available every arrivalGap, and
    // no faster. A full queue holds the arrival back rather than flooding a
    // player who is taking their time, and the held arrival is released as soon
    // as they make room.
    untilArrival -= dt;

    // Recovery, which the fairness rules owe the player (source spec 34): in the
    // red with an empty queue there is no move left to make, so help is sent
    // quickly. The generator only ever offers an animal that can be placed
    // safely, so the help is real help.
    if (previous.zone === 'red' && queue.length === 0) {
      untilArrival = Math.min(untilArrival, RESCUE_SECONDS);
    }

    if (untilArrival <= 0 && queue.length < settings.queueLength) {
      untilArrival = arrivalGap();
      admitOne(events);
    }

    // An ignored animal loses patience and climbs on wherever it likes.
    if (queue.length > 0) {
      waited += dt;
      if (waited >= settings.patienceSeconds) {
        const heavy = previous.heavySide ?? (sideRng.next() < 0.5 ? 'left' : 'right');
        events.push(...put(heavy, false));
      }
    } else {
      waited = 0;
    }

    events.push(...settle());

    const zone = previous.zone;
    danger =
      zone === 'red'
        ? Math.min(1, danger + dt / settings.dangerFillSeconds)
        : Math.max(0, danger - dt / settings.dangerDrainSeconds);

    if (danger >= 1) {
      status = 'lost';
      events.push({ type: 'roundLost' });
    } else if (target !== null && elapsed >= target) {
      status = 'won';
      events.push({ type: 'levelCleared' });
    }

    return events;
  };

  return {
    get state() {
      return {
        placed,
        queue,
        elapsed,
        danger,
        status,
        impatience: queue.length === 0 ? 0 : Math.min(1, waited / settings.patienceSeconds),
        wind: wind?.state ?? { phase: 'calm' as const, side: 'left' as const, bias: 0, through: 0 },
        stats: {
          secondsSurvived: elapsed,
          animalsHandled,
          perfectBalances,
          longestStreak,
          nearMisses,
        },
      };
    },
    level,
    snapshot,

    get progress() {
      return target === null ? null : Math.min(1, elapsed / target);
    },

    get target() {
      return target;
    },

    tick(dt) {
      if (!(dt > 0)) return [];
      const events: ArcadeEvent[] = [];
      let remaining = Math.min(dt, 1);
      while (remaining > 0 && status === 'playing') {
        const slice = Math.min(remaining, MAX_SLICE);
        events.push(...step(slice));
        remaining -= slice;
      }
      return events;
    },

    place(side) {
      if (status !== 'playing') return [];
      return put(side, true);
    },
  };
}
