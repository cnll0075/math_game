import { createRng } from '@bundle/core';
import { chooseCrate, chooseTarget, openingCrates, openingTarget, starTarget } from './choose.js';
import { arrivalGap, bandAt, bandById, paceStep, type Band, type BandId } from './tempo.js';

export const TRACK_COUNT = 3;
/** How many crates fit along the floor before the marker. One more ends the run. */
export const QUEUE_SLOTS = 12;

export const TIMES = {
  /** A fresh train rolls in this long after the last one left or was mended. */
  rollIn: 1.5,
  /** The crew takes this long to mend a train that was loaded too heavy. */
  repair: 5,
  /** A star train has this long to be filled for the bonus. */
  star: 5,
  /** No star trains before this far into a run, */
  starFrom: 30,
  /** and then about one train in this many. */
  starChance: 1 / 8,
  /** The first crate comes out of the port this soon. */
  firstCrate: 0.6,
} as const;

export interface Crate {
  id: number;
  weight: number;
}

/**
 * `rolling` — no train to load: one is on its way in.
 * `waiting` — a train is in, with a target, taking crates.
 * `broken` — loaded too heavy; the crew is mending it.
 */
export type TrackPhase = 'rolling' | 'waiting' | 'broken';

export interface Track {
  phase: TrackPhase;
  /** Seconds left rolling in or being mended. */
  timer: number;
  /** What the waiting train wants. Meaningless unless waiting. */
  target: number;
  /** The crates in its wagon, by weight, in the order they went in. */
  load: number[];
  /** Seconds left to fill a star train for the bonus; 0 when it is not one. */
  star: number;
  /** Counts up with every new train, so the view can tell one train from the next. */
  train: number;
}

export interface RunState {
  /** Seconds since the start of the yard's day: a run opened in a later band starts later. */
  elapsed: number;
  /** Waiting crates, from the port end to the marker end. */
  queue: Crate[];
  tracks: Track[];
  sent: number;
  /** Crates loaded on any train, for the coach. */
  loaded: number;
  broken: number;
  untilCrate: number;
  band: BandId;
  /** How many times the pace has stepped up. */
  step: number;
  over: boolean;
}

export type RunEvent =
  | { type: 'crate'; crate: Crate }
  | { type: 'band'; band: Band }
  | { type: 'speed'; gap: number }
  | { type: 'arrived'; track: number; target: number; star: boolean }
  | { type: 'loaded'; track: number; crate: Crate; load: number; target: number }
  | { type: 'sent'; track: number; target: number; load: number[]; bonus: boolean }
  | { type: 'cleared'; crates: Crate[] }
  | { type: 'broke'; track: number; target: number; load: number[] }
  | { type: 'repaired'; track: number }
  | { type: 'starTick'; track: number; seconds: number }
  | { type: 'starFaded'; track: number }
  | { type: 'over'; elapsed: number; sent: number };

export interface Run {
  readonly state: RunState;
  step(dt: number): RunEvent[];
  /** Load the queued crate with this id onto this track. Nothing happens unless that train is waiting. */
  load(crate: number, track: number): RunEvent[];
}

export interface RunOptions {
  seed: number;
  startBand?: BandId;
}

export const loadOf = (track: Track): number => track.load.reduce((sum, weight) => sum + weight, 0);
export const gapOf = (track: Track): number => track.target - loadOf(track);

/** Longest single step the run takes; a long frame is cut into these. */
const MAX_STEP = 1 / 30;

export function createRun(options: RunOptions): Run {
  const rng = createRng(options.seed);
  const opening = bandById(options.startBand) ?? bandAt(0);
  let nextCrate = 1;

  const firstTrack = rng.int(TRACK_COUNT);
  const firstTarget = openingTarget(rng, opening);
  const tracks: Track[] = [];
  for (let index = 0; index < TRACK_COUNT; index += 1) {
    const taken = [firstTarget, ...tracks.map((track) => track.target)];
    const target = index === firstTrack ? firstTarget : chooseTarget(rng, opening, taken);
    tracks.push({ phase: 'waiting', timer: 0, target, load: [], star: 0, train: index + 1 });
  }
  let nextTrain = TRACK_COUNT + 1;
  /** The first two crates make the first train exactly: the run always opens with something to do. */
  const openers = openingCrates(rng, opening, firstTarget);

  const state: RunState = {
    elapsed: opening.from,
    queue: [],
    tracks,
    sent: 0,
    loaded: 0,
    broken: 0,
    untilCrate: TIMES.firstCrate,
    band: opening.id,
    step: paceStep(opening.from),
    over: false,
  };

  const waitingTargets = (except?: Track): number[] =>
    state.tracks.filter((track) => track !== except && track.phase === 'waiting').map((track) => track.target);

  const arrive = (track: Track, index: number, events: RunEvent[]): void => {
    const band = bandAt(state.elapsed);
    track.phase = 'waiting';
    track.timer = 0;
    track.load = [];
    track.star = 0;
    track.train = nextTrain++;
    track.target = chooseTarget(rng, band, waitingTargets(track));
    events.push({ type: 'arrived', track: index, target: track.target, star: false });
  };

  const rollIn = (track: Track): void => {
    track.phase = 'rolling';
    track.timer = TIMES.rollIn;
    track.load = [];
    track.star = 0;
  };

  const spawnCrate = (events: RunEvent[]): void => {
    if (state.queue.length >= QUEUE_SLOTS) {
      state.over = true;
      events.push({ type: 'over', elapsed: state.elapsed, sent: state.sent });
      return;
    }
    const gaps = state.tracks.filter((track) => track.phase === 'waiting').map(gapOf);
    const weight = openers.shift() ?? chooseCrate(rng, bandAt(state.elapsed), gaps);
    const crate = { id: nextCrate++, weight };
    state.queue.push(crate);
    events.push({ type: 'crate', crate });
  };

  const advance = (dt: number, events: RunEvent[]): void => {
    const before = state.elapsed;
    state.elapsed += dt;

    const band = bandAt(state.elapsed);
    if (band.id !== state.band) {
      state.band = band.id;
      events.push({ type: 'band', band });
    }
    const step = paceStep(state.elapsed);
    if (step > state.step) {
      const gap = arrivalGap(state.elapsed);
      if (gap < arrivalGap(before)) events.push({ type: 'speed', gap });
      state.step = step;
    }

    state.tracks.forEach((track, index) => {
      if (track.phase === 'waiting') return;
      track.timer -= dt;
      if (track.timer > 0) return;
      if (track.phase === 'broken') {
        rollIn(track);
        events.push({ type: 'repaired', track: index });
      } else {
        arrive(track, index, events);
      }
    });

    state.untilCrate -= dt;
    while (state.untilCrate <= 0 && !state.over) {
      spawnCrate(events);
      state.untilCrate += arrivalGap(state.elapsed);
    }
  };

  return {
    state,

    step(dt) {
      const events: RunEvent[] = [];
      let left = Math.max(0, dt);
      while (left > 1e-9 && !state.over) {
        const slice = Math.min(MAX_STEP, left);
        advance(slice, events);
        left -= slice;
      }
      return events;
    },

    load(crateId, index) {
      const track = state.tracks[index];
      const at = state.queue.findIndex((crate) => crate.id === crateId);
      if (state.over || !track || track.phase !== 'waiting' || at < 0) return [];
      const [crate] = state.queue.splice(at, 1) as [Crate];
      track.load.push(crate.weight);
      state.loaded += 1;
      const load = loadOf(track);
      const events: RunEvent[] = [{ type: 'loaded', track: index, crate, load, target: track.target }];
      if (load === track.target) {
        state.sent += 1;
        events.push({ type: 'sent', track: index, target: track.target, load: [...track.load], bonus: false });
        rollIn(track);
      } else if (load > track.target) {
        state.broken += 1;
        events.push({ type: 'broke', track: index, target: track.target, load: [...track.load] });
        track.phase = 'broken';
        track.timer = TIMES.repair;
        track.load = [];
        track.star = 0;
      }
      return events;
    },
  };
}
