import { createRng, type Rng } from '@bundle/core';
import { bandAt, bandById, type Band, type BandId, type Sum } from '@bundle/math';
import { makeBerry, BERRY_LATEST_SHARE, type Berry } from './berries.js';
import { laneAt } from './lanes.js';
import { buildRow, type Row } from './row.js';
import { tempoAt, type Tempo } from './tempo.js';

export type RunEvent =
  | { type: 'row'; row: Row }
  | { type: 'burst'; row: Row; lane: number; sum: Sum }
  | { type: 'thump'; row: Row; lane: number; sum: Sum; health: number }
  | { type: 'berryArrived'; berry: Berry; gapLeft: number }
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

/** The next row the rabbit has to answer. The sum it wears is this row's. */
export const currentRow = (state: RunState): Row | undefined => state.rows.find((row) => !row.resolved);

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
    rabbitX: 0.5,
    rabbitTarget: 0.5,
    stumble: 0,
    missed: null,
    status: 'running',
  };

  /** Seconds until the next row is sent, so a berry knows how much gap is left. */
  let untilNextRow = 0;
  /** Whether this gap has already had its berry. */
  let berryThisGap = false;

  const sendRow = (events: RunEvent[]): void => {
    const row = buildRow(rng, state.band, nextUid('row'), state.tempo.approachSeconds);
    state.rows.push(row);
    events.push({ type: 'row', row });
  };

  const sendBerry = (events: RunEvent[], gapLeft: number): void => {
    const berry = makeBerry(rng, nextUid('berry'), state.tempo.approachSeconds);
    state.berries.push(berry);
    events.push({ type: 'berryArrived', berry, gapLeft });
  };

  // The first row is already on its way when the run opens, so the rabbit has a
  // sum to read from the first frame rather than running at nothing.
  sendRow([]);
  untilNextRow = state.tempo.rowEvery;

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
        state.health = Math.max(0, state.health - MISS_COST);
        state.streak = 0;
        state.stumble = STUMBLE_SECONDS;
        state.missed = row.sum;
        events.push({ type: 'thump', row, lane, sum: row.sum, health: state.health });
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

    // The cadence. A berry lands in the first half of a gap, so there is always
    // time to reach any lane afterwards.
    untilNextRow -= worldDt;
    if (!berryThisGap && untilNextRow <= state.tempo.rowEvery * BERRY_LATEST_SHARE && untilNextRow > 0) {
      berryThisGap = true;
      if (rng.next() < state.tempo.berryChance) sendBerry(events, untilNextRow);
    }
    if (untilNextRow <= 0) {
      sendRow(events);
      untilNextRow = state.tempo.rowEvery;
      berryThisGap = false;
    }

    return events;
  };

  return {
    state,
    step,
    steer(x) {
      state.rabbitTarget = Math.min(1, Math.max(0, x));
    },
  };
}
