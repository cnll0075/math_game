import { createRng } from '@bundle/core';
import { weightOf, type AnimalId } from './animals.js';
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
  /** Waiting animals. Any of them can be chosen, which is the whole point. */
  queue: readonly AnimalId[];
  /** Which queued animal the player has chosen. */
  selected: number;
  /**
   * When above zero, the first this many queued animals are a family and must
   * all be seated before the rest can be touched.
   */
  groupSize: number;
  /** Bells rung this round. */
  bells: number;
  /** True while the seesaw holds a balance before the animals hop off. */
  celebrating: boolean;
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
  | { type: 'bellRung'; bells: number }
  | { type: 'cleared' }
  | { type: 'windChanged'; phase: WindPhase };

export interface ArcadeRun {
  readonly state: ArcadeState;
  readonly level: ArcadeLevelDef;
  /** Advances the clock. Returns everything that happened in this slice. */
  tick(dt: number): ArcadeEvent[];
  /** Chooses which queued animal to place next. */
  select(index: number): void;
  /** Puts the chosen animal onto a side. */
  place(side: Side): ArcadeEvent[];
  /** Bells this round must ring, or null when the round is not counting them. */
  readonly bellTarget: number | null;
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
  const target =
    level.objective.kind === 'survive' || level.objective.kind === 'bells' ? level.objective.seconds : null;
  const bellTarget = level.objective.kind === 'bells' ? level.objective.count : null;
  const seedGap = settings.seedGap ?? ([1, 3] as const);
  const holdSeconds = settings.celebrateSeconds ?? 1;
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
  const groupRng = createRng(settings.seed * 97 + 41);
  const seedRng = createRng(settings.seed * 131 + 7);

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
  let selected = 0;
  let groupSize = 0;
  /** A family that is due but still waiting for room in the hand. */
  let pendingFamily = 0;
  let bells = 0;
  /** Counts down while a rung balance is held, before the animals hop off. */
  let holding = 0;
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

  /** How many of the queue's animals the player may choose between right now. */
  const choosable = (): number => (groupSize > 0 ? Math.min(groupSize, queue.length) : queue.length);

  /**
   * Puts the chosen animal onto a side. When the player does not choose, the
   * animal climbs onto whichever side is already down, because that is the end
   * it can reach — so ignoring the game makes a lean worse, not better.
   */
  const put = (side: Side, chosenByPlayer: boolean, index = selected): ArcadeEvent[] => {
    const limit = choosable();
    const at = Math.min(Math.max(index, 0), Math.max(0, limit - 1));
    const species = queue[at];
    if (species === undefined) return [];
    queue.splice(at, 1);
    if (groupSize > 0) groupSize -= 1;
    selected = 0;
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
      if (bellTarget !== null || target === null) {
        // In the rush, a rung bell is the point: it scores, the seesaw holds
        // its balance for a beat, and then the animals hop off for a fresh one.
        bells += 1;
        holding = holdSeconds;
        events.push({ type: 'bellRung', bells });
      }
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

  /**
   * Sometimes a family arrives instead of one animal. Every member has to be
   * seated, so the player splits them between the sides — which is partitioning
   * a set, not comparing two numbers.
   */
  const admitArrival = (events: ArcadeEvent[]): void => {
    // A family arrives all at once or not at all — half a family waiting
    // outside would be a rule the player cannot see. So once one is due it
    // holds its place in the queue rather than being skipped, and the singles
    // stop coming until the hand has room for it.
    if (pendingFamily === 0 && groupSize === 0 && settings.groupSize) {
      if (groupRng.next() < (settings.groupChance ?? 0)) {
        const [min, max] = settings.groupSize;
        pendingFamily = Math.round(min + groupRng.next() * (max - min));
      }
    }

    if (pendingFamily > 0) {
      if (queue.length + pendingFamily > settings.queueLength) return;
      for (let i = 0; i < pendingFamily; i++) admitOne(events);
      groupSize = pendingFamily;
      pendingFamily = 0;
      return;
    }

    admitOne(events);
  };

  // The queue starts full so the player has something to plan with.
  while (queue.length < settings.queueLength) admitOne([]);

  /**
   * Puts a gap on the plank for the player to close. One animal on one side, so
   * the arithmetic is "what adds up to this?" — sometimes answered with one
   * animal, sometimes by combining two or three.
   */
  const seedGapAnimals = (): void => {
    const [min, max] = seedGap;
    const wanted = Math.round(min + seedRng.next() * (max - min));
    const side: Side = seedRng.next() < 0.5 ? 'left' : 'right';
    const species = [...settings.pool]
      .filter((animal) => weightOf(animal) <= wanted)
      .sort((a, b) => weightOf(b) - weightOf(a))[0];
    if (!species) return;

    let remaining = wanted;
    while (remaining > 0) {
      const fits = [...settings.pool]
        .filter((animal) => weightOf(animal) <= remaining)
        .sort((a, b) => weightOf(b) - weightOf(a))[0];
      if (!fits) break;
      placed = [...placed, { uid: `seed-${nextUid++}`, species: fits, side, leavesIn: Infinity }];
      remaining -= weightOf(fits);
    }
  };

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
      admitArrival(events);
    }

    // A rung balance is held for a beat, then the animals hop down happily and
    // a fresh gap is seeded for the player to close.
    if (holding > 0) {
      holding -= dt;
      if (holding <= 0) {
        placed = [];
        seedGapAnimals();
        events.push({ type: 'cleared' });
        previous = snapshot();
      }
      return events;
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
    } else if (bellTarget !== null && bells >= bellTarget) {
      status = 'won';
      events.push({ type: 'levelCleared' });
    } else if (target !== null && elapsed >= target) {
      // The clock is a backstop: running it out without the bells is a loss.
      status = bellTarget === null ? 'won' : 'lost';
      events.push(bellTarget === null ? { type: 'levelCleared' } : { type: 'roundLost' });
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
        impatience: queue.length === 0 || holding > 0 ? 0 : Math.min(1, waited / settings.patienceSeconds),
        selected: Math.min(selected, Math.max(0, choosable() - 1)),
        groupSize,
        bells,
        celebrating: holding > 0,
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

    select(index) {
      const limit = choosable();
      if (limit <= 0) return;
      selected = Math.min(Math.max(index, 0), limit - 1);
    },

    place(side) {
      // Placements are refused while a balance is being celebrated, so a stray
      // tap cannot spoil the moment the child just earned.
      if (status !== 'playing' || holding > 0) return [];
      return put(side, true);
    },

    get bellTarget() {
      return bellTarget;
    },
  };
}
