import { createRng, type Rng } from '@bundle/core';
import { bandAt, bandById, type Band, type BandId } from './bands.data.js';
import { writeSum, type Sum } from './equation.js';
import { advance, damage, escaped, struck, type Plane } from './sky-state.js';
import { hasTrap, nextNumber, spawnPlane, trapNumber } from './spawner.js';
import { chooseTarget } from './targeting.js';
import { tempoAt, type Tempo } from './tempo.js';

/** A shell in flight. `y` runs 1 at the fighter down to 0 at the spawn line. */
export interface Bullet {
  x: number;
  y: number;
}

export type RunEvent =
  | { type: 'spawned'; plane: Plane }
  | { type: 'asked'; sum: Sum; target: Plane }
  | { type: 'damaged'; plane: Plane }
  | { type: 'destroyed'; plane: Plane; sum: Sum }
  | { type: 'jammed'; plane: Plane }
  | { type: 'escaped'; plane: Plane; hearts: number }
  | { type: 'band'; band: Band }
  | { type: 'ended'; score: number };

export interface RunState {
  elapsed: number;
  hearts: number;
  score: number;
  streak: number;
  bestStreak: number;
  band: Band;
  tempo: Tempo;
  /** The question on the fighter, or null for the instant before one is written. */
  sum: Sum | null;
  targetUid: string | null;
  aloft: Plane[];
  bullets: Bullet[];
  /** Where the fighter is, 0..1 across the playfield. */
  fighterX: number;
  /** Seconds of overheat left. The gun cannot fire while this is above zero. */
  jam: number;
  /** Wrong shells in a row, which is what makes the gun hotter each time. */
  jamStreak: number;
  status: 'flying' | 'over';
}

export interface RunOptions {
  seed?: number;
  hearts?: number;
  /** Opens the run at a band's own pace, for `?game=sky&level=take-aways`. */
  startBand?: BandId;
}

export interface Run {
  readonly state: RunState;
  step(dt: number): readonly RunEvent[];
  /** Slide the fighter. 0..1 across the playfield. */
  aim(x: number): void;
  /** Let go of the screen: one shell. */
  fire(): void;
}

/** Three for the whole run. */
export const HEARTS = 3;
/** What one wrong answer costs: gun time, never a heart. */
export const JAM_SECONDS = 0.9;
/**
 * Each wrong shell in a row holds the gun shut longer. One slip stays cheap, so
 * a mistimed tap never ends a run — but firing without reading is a pattern,
 * and a pattern gets expensive fast. This is what stops "shoot whatever is
 * lowest" from being a way to play: the guesser spends the whole of a plane's
 * fall waiting for a gun that will not cool down.
 */
export const JAM_ESCALATION = 0.7;
/** However hot it gets, the gun always comes back. */
export const JAM_CEILING = 3;
/** How long a shell takes to cross the sky. */
export const BULLET_SECONDS = 0.35;
/** Chance a spawn brings an escort pair, once the numbers get big. */
const ESCORT_CHANCE = 0.18;

export function createRun(options: RunOptions = {}): Run {
  const rng: Rng = createRng(options.seed ?? 1);
  const opened = (options.startBand ? bandById(options.startBand)?.from : 0) ?? 0;
  let uidCounter = 0;
  const nextUid = (): string => `plane-${(uidCounter += 1)}`;

  const state: RunState = {
    elapsed: opened,
    hearts: options.hearts ?? HEARTS,
    score: 0,
    streak: 0,
    bestStreak: 0,
    band: bandAt(opened),
    tempo: tempoAt(opened),
    sum: null,
    targetUid: null,
    aloft: [],
    bullets: [],
    fighterX: 0.5,
    jam: 0,
    jamStreak: 0,
    status: 'flying',
  };

  let sinceSpawn = 0;

  const spawn = (events: RunEvent[], number?: number, lane?: number): Plane => {
    const plane = spawnPlane(rng, {
      uid: nextUid(),
      number: number ?? nextNumber(rng, state.band, state.sum, state.aloft),
      elapsed: state.elapsed,
      fallSeconds: state.tempo.fallSeconds,
      lane,
    });
    state.aloft.push(plane);
    events.push({ type: 'spawned', plane });
    return plane;
  };

  /**
   * Write the next question about a plane already flying. If nothing aloft can
   * fairly be asked about, one is sent up for the purpose — so the game can
   * never ask a question it has not also made answerable.
   */
  const ask = (events: RunEvent[]): void => {
    const chosen = chooseTarget(rng, state.aloft, state.tempo.thinkSeconds) ?? spawn(events);
    const sum = writeSum(rng, state.band, chosen.number, state.aloft.map((plane) => plane.number));
    if (!sum) return;
    state.sum = sum;
    state.targetUid = chosen.uid;
    events.push({ type: 'asked', sum, target: chosen });
    // A question whose answer is the only plausible number in the sky can be
    // answered without arithmetic, so a trap goes up now.
    if (!hasTrap(sum, state.aloft)) spawn(events, trapNumber(rng, sum, state.band));
  };

  // Open with a sky already flying, spread down the screen, so the first
  // question is about a plane that is already on its way rather than one that
  // has just appeared at the top.
  const prime = (): void => {
    const events: RunEvent[] = [];
    for (let i = 0; i < state.tempo.aloft; i += 1) {
      const plane = spawn(events);
      plane.progress = 0.08 * i;
      plane.age = plane.progress * plane.fallSeconds;
    }
  };
  prime();

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
    if (state.jam > 0) state.jam = Math.max(0, state.jam - dt);

    for (const plane of state.aloft) advance(plane, dt);

    // Planes that got away. Only the one being asked about costs anything; the
    // rest were never the player's business.
    const gone = state.aloft.filter(escaped);
    if (gone.length > 0) {
      state.aloft = state.aloft.filter((plane) => !escaped(plane));
      for (const plane of gone) {
        if (plane.uid !== state.targetUid) continue;
        state.hearts -= 1;
        state.streak = 0;
        state.sum = null;
        state.targetUid = null;
        events.push({ type: 'escaped', plane, hearts: state.hearts });
      }
    }

    if (state.hearts <= 0) {
      state.status = 'over';
      events.push({ type: 'ended', score: state.score });
      return events;
    }

    for (const bullet of state.bullets) bullet.y -= dt / BULLET_SECONDS;
    const spent = new Set<Bullet>();
    for (const bullet of state.bullets) {
      if (bullet.y <= 0) {
        spent.add(bullet);
        continue;
      }
      // A shell stops at the first plane in its path, which is the lowest one it
      // overlaps — not whichever happens to sit earliest in the list. Something
      // flying between the fighter and the right answer really does block the
      // shot, and the player can see it there.
      const hit = state.aloft
        .filter((plane) => struck(plane, bullet.x, bullet.y))
        .sort((a, b) => b.progress - a.progress)[0];
      if (!hit) continue;
      spent.add(bullet);

      if (!state.sum || hit.number !== state.sum.answer) {
        // The wrong plane shrugs the shell off. The cost is the clock, which is
        // the thing that actually matters as the sky speeds up — and it grows
        // with each wrong shell in a row.
        state.jam = Math.min(JAM_CEILING, JAM_SECONDS * (1 + state.jamStreak * JAM_ESCALATION));
        state.jamStreak += 1;
        state.streak = 0;
        events.push({ type: 'jammed', plane: hit });
        continue;
      }

      // A shell home on the right plane cools the gun completely.
      state.jamStreak = 0;

      if (damage(hit) === 'damaged') {
        events.push({ type: 'damaged', plane: hit });
        continue;
      }

      state.aloft = state.aloft.filter((plane) => plane.uid !== hit.uid);
      state.score += 1;
      state.streak += 1;
      state.bestStreak = Math.max(state.bestStreak, state.streak);
      events.push({ type: 'destroyed', plane: hit, sum: state.sum });
      state.sum = null;
      state.targetUid = null;
    }
    state.bullets = state.bullets.filter((bullet) => !spent.has(bullet));

    sinceSpawn += dt;
    if (state.aloft.length < state.tempo.aloft && sinceSpawn >= state.tempo.spawnEvery) {
      sinceSpawn = 0;
      const first = spawn(events);
      // Escort pairs: two planes abreast wearing neighbouring numbers, so once
      // the numbers get big the sky supplies its own traps.
      if (state.band.id !== 'easy' && rng.next() < ESCORT_CHANCE) {
        const shift = rng.next() < 0.5 ? -1 : 1;
        const neighbour = Math.min(20, Math.max(1, first.number + shift));
        spawn(events, neighbour, first.lane + (first.lane < 0.5 ? 0.12 : -0.12));
      }
    }

    if (!state.sum) ask(events);

    // The trap has to be there for as long as the question is, not only at the
    // moment it was written: the plane that was the near miss gets away like any
    // other, and a sum whose answer is the only plausible number left in the sky
    // can be shot without doing any arithmetic.
    if (state.sum && !hasTrap(state.sum, state.aloft)) {
      spawn(events, trapNumber(rng, state.sum, state.band));
    }

    return events;
  };

  return {
    state,
    step,
    aim(x) {
      state.fighterX = Math.min(1, Math.max(0, x));
    },
    fire() {
      if (state.status === 'over' || state.jam > 0) return;
      state.bullets.push({ x: state.fighterX, y: 1 });
    },
  };
}
