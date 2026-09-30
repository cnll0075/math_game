import { createRng, type Rng } from '@bundle/core';
import { bandAt, bandById, type Band, type BandId, type Sum } from '@bundle/math';
import { makeBerry, BERRY_LATEST_SHARE, type Berry } from './berries.js';
import { laneAt, snapToLane } from './lanes.js';
import { buildRow, type Row } from './row.js';
import { drawApproach, drawGap, tempoAt, type Tempo } from './tempo.js';

export type RunEvent =
  | { type: 'row'; row: Row }
  | { type: 'burst'; row: Row; lane: number; sum: Sum }
  | { type: 'thump'; row: Row; lane: number; sum: Sum; health: number; streakWas: number }
  | { type: 'berryArrived'; berry: Berry; gapLeft: number; gap: number }
  | { type: 'berry'; berry: Berry; health: number }
  | { type: 'band'; band: Band }
  | { type: 'ended'; score: number; distance: number };

export interface RunState {
  elapsed: number;
  /** The fuel the run flies on, 0 to 100. */
  health: number;
  maxHealth: number;
  score: number;
  streak: number;
  bestStreak: number;
  /** How far the rabbit has run, in paces, for the card. */
  distance: number;
  band: Band;
  tempo: Tempo;
  rows: Row[];
  berries: Berry[];
  /** Where the rabbit is, 0..1 across the path. */
  rabbitX: number;
  /** Where the finger is asking it to be. It runs there rather than jumping. */
  rabbitTarget: number;
  /** Seconds of tumble left. The world slows and the missed sum is held. */
  stumble: number;
  missed: Sum | null;
  status: 'running' | 'over';
}

export interface RunOptions {
  seed?: number;
  health?: number;
  /** Opens the run at a band's own pace, for `?game=bramble&level=take-aways`. */
  startBand?: BandId;
}

export interface Run {
  readonly state: RunState;
  step(dt: number): readonly RunEvent[];
  /** Point the rabbit somewhere across the path, 0..1. */
  steer(x: number): void;
}

/** A full tank at the start of a run. */
export const MAX_HEALTH = 100;
/** What one wrong lane costs. Ten of them and the run is over. */
export const MISS_COST = 10;
/** What a berry gives back. */
export const BERRY_GIVES = 10;
/** How long the rabbit tumbles, with the world slowed, after a wrong lane. */
export const STUMBLE_SECONDS = 0.8;
/** How much the world slows during a tumble. */
const STUMBLE_SLOWDOWN = 0.35;
/** How fast the rabbit closes on the finger. */
const STEER_RATE = 14;
/** Paces a second at a run, for the distance on the card. */
const PACE = 6;


/**
 * The next row the rabbit has to answer, and the sum it wears.
 *
 * The one closest to the rabbit, not the one sent first: rows can be in the air
 * together and a slow row sent early is passed by a quick one sent later, so
 * the order they were spawned in says nothing about the order they arrive.
 */
export const currentRow = (state: RunState): Row | undefined => {
  let nearest: Row | undefined;
  for (const row of state.rows) {
    if (row.resolved) continue;
    if (!nearest || row.progress > nearest.progress) nearest = row;
  }
  return nearest;
};

export function createRun(options: RunOptions = {}): Run {
  const rng: Rng = createRng(options.seed ?? 1);
  const opened = (options.startBand ? bandById(options.startBand)?.from : 0) ?? 0;
  let counter = 0;
  const nextUid = (kind: string): string => `${kind}-${(counter += 1)}`;

  const health = options.health ?? MAX_HEALTH;
  const state: RunState = {
    elapsed: opened,
    health,
    maxHealth: health,
    score: 0,
    streak: 0,
    bestStreak: 0,
    distance: 0,
    band: bandAt(opened),
    tempo: tempoAt(opened),
    rows: [],
    berries: [],
    rabbitX: snapToLane(0.5),
    rabbitTarget: snapToLane(0.5),
    stumble: 0,
    missed: null,
    status: 'running',
  };

  /**
   * What is coming, in world-clock seconds. More than one is scheduled at a
   * time so that rows can be in the air together: with only ever one on the
   * path, every row was the identical event — appear, travel, land — and no
   * amount of varying the gaps showed, because there was never a second row at
   * a different distance to see it against.
   */
  interface Booking {
    /** When this row should reach the rabbit. */
    arrival: number;
    /** How long it should take coming down. Its speed, and visibly so. */
    approach: number;
    /** The gap from the row before it, for the carrot rule. */
    gap: number;
    roomy: boolean;
    sent: boolean;
    carrotSent: boolean;
  }

  let worldClock = 0;
  const booked: Booking[] = [];

  const sendRow = (events: RunEvent[], approachSeconds = state.tempo.approachSeconds): void => {
    const row = buildRow(rng, state.band, nextUid('row'), approachSeconds);
    state.rows.push(row);
    events.push({ type: 'row', row });
  };

  const sendBerry = (events: RunEvent[], gapLeft: number, gap: number, approachSeconds: number): void => {
    const berry = makeBerry(rng, nextUid('berry'), approachSeconds);
    state.berries.push(berry);
    events.push({ type: 'berryArrived', berry, gapLeft, gap });
  };

  /**
   * How long until the row after this one, and whether it has room for a carrot.
   * Both decided together, here: the floor shrinks as a run goes on, so asking
   * "is this gap roomy?" every frame let a gap change its mind halfway through
   * and drop a carrot far too late to be safe.
   */
  const nextGap = (): { seconds: number; roomy: boolean } => {
    const drawn = drawGap(rng, state.tempo);
    return { seconds: drawn.seconds, roomy: drawn.shape !== 'tight' };
  };

  // The first row is already on its way when the run opens, so the rabbit has a
  // sum to read from the first frame rather than running at nothing.
  // The first row lands a floor's worth in, so the run opens with a moment of
  // running rather than with a wall.
  /** Books the next row after whatever is already scheduled. */
  const book = (): void => {
    const last = booked.at(-1);
    const drawn = drawGap(rng, state.tempo);
    const gapFromLast = last ? drawn.seconds : state.tempo.minGap;
    booked.push({
      arrival: (last?.arrival ?? worldClock) + gapFromLast,
      approach: drawApproach(rng, state.tempo).seconds,
      gap: gapFromLast,
      roomy: last ? drawn.shape !== 'tight' : true,
      sent: false,
      carrotSent: false,
    });
  };

  const step = (dt: number): readonly RunEvent[] => {
    const events: RunEvent[] = [];
    if (state.status === 'over') return events;

    state.elapsed += dt;
    state.tempo = tempoAt(state.elapsed);
    const band = bandAt(state.elapsed);
    if (band.id !== state.band.id) {
      state.band = band;
      events.push({ type: 'band', band });
    }

    // A tumble slows the world rather than stopping it: a runner cannot stand
    // still, but it can stagger, and the stagger is what ties the lost fuel to
    // the question it was lost on.
    if (state.stumble > 0) {
      state.stumble = Math.max(0, state.stumble - dt);
      if (state.stumble === 0) state.missed = null;
    }
    const worldDt = state.stumble > 0 ? dt * STUMBLE_SLOWDOWN : dt;
    state.distance += worldDt * PACE;
    // Everything on the path moves on this clock, and everything is scheduled
    // against it, so a stumble slows the world without the schedule drifting
    // away from where the rows actually are.
    worldClock += worldDt;

    state.rabbitX += (state.rabbitTarget - state.rabbitX) * (1 - Math.exp(-STEER_RATE * dt));

    for (const row of state.rows) row.progress += worldDt / row.approachSeconds;
    for (const berry of state.berries) berry.progress += worldDt / berry.approachSeconds;

    // Meeting a row. Every lane is occupied, so the rabbit always meets
    // something: there is no lane that is safe by default.
    for (const row of state.rows) {
      if (row.resolved || row.progress < 1) continue;
      row.resolved = true;
      const lane = laneAt(state.rabbitX);
      if (lane === row.answerLane) {
        state.score += 1;
        state.streak += 1;
        state.bestStreak = Math.max(state.bestStreak, state.streak);
        events.push({ type: 'burst', row, lane, sum: row.sum });
      } else {
        const streakWas = state.streak;
        state.health = Math.max(0, state.health - MISS_COST);
        state.streak = 0;
        state.stumble = STUMBLE_SECONDS;
        state.missed = row.sum;
        events.push({ type: 'thump', row, lane, sum: row.sum, health: state.health, streakWas });
      }
    }
    state.rows = state.rows.filter((row) => row.progress < 1.2);

    for (const berry of state.berries) {
      if (berry.taken || berry.progress < 1) continue;
      berry.taken = true;
      if (laneAt(state.rabbitX) !== berry.lane) continue;
      state.health = Math.min(state.maxHealth, state.health + BERRY_GIVES);
      events.push({ type: 'berry', berry, health: state.health });
    }
    state.berries = state.berries.filter((berry) => berry.progress < 1.2);

    if (state.health <= 0) {
      state.status = 'over';
      events.push({ type: 'ended', score: state.score, distance: state.distance });
      return events;
    }

    // The cadence. Everything is scheduled by when it *lands*: a row takes its
    // approach time from the tempo at the moment it spawns, and that time
    // shrinks over a run, so spacing the spawns evenly let later rows catch the
    // ones ahead and land far closer together than the floor promised.
    while (booked.length < 3) book();

    for (const booking of booked) {
      if (!booking.sent && worldClock >= booking.arrival - booking.approach) {
        booking.sent = true;
        sendRow(events, Math.max(0.1, booking.arrival - worldClock));
      }
      // A carrot lands halfway through the gap, so there is always half a gap
      // left to reach whichever lane the next row wants. Only in a gap with
      // room in it: a flurry is no place for a treat.
      if (booking.carrotSent || !booking.roomy) continue;
      const carrotLands = booking.arrival - booking.gap * BERRY_LATEST_SHARE;
      if (worldClock >= carrotLands - state.tempo.approachSeconds && carrotLands > worldClock) {
        booking.carrotSent = true;
        if (rng.next() < state.tempo.berryChance) {
          sendBerry(
            events,
            booking.arrival - carrotLands,
            booking.gap,
            Math.max(0.1, carrotLands - worldClock),
          );
        }
      }
    }

    while (booked.length > 0 && worldClock >= booked[0]!.arrival) booked.shift();

    return events;
  };

  return {
    state,
    step,
    steer(x) {
      // Snapped to a lane: the rabbit runs down one of three, never between two
      // and never half off the edge of the path.
      state.rabbitTarget = snapToLane(Math.min(1, Math.max(0, x)));
    },
  };
}
