import { createRng, type Rng } from '@bundle/core';
import type { LevelDef } from './levels.data.js';
import { reachable, weightsIn } from './reach.js';
import { BONUS_SECONDS, ITEMS, SPECIES, type Gait, type ItemId, type SpeciesId } from './species.js';

/**
 * The bay, in design pixels. The simulation lives in the same coordinates the
 * scene draws in, so "the hook touched the fish" means what it looks like.
 */
export const BAY = {
  surfaceY: 285,
  floorY: 752,
  /** The band fish swim in, between just under the surface and just over the sand. */
  swimTop: 350,
  swimBottom: 676,
  /** Where crabs walk and treasure rests. */
  sandY: 706,
  /**
   * How far the hook may reach. The boat always faces right with the rod out
   * over the bow, so on the left the hull slides half off the screen to bring
   * the hook as near the edge as it will go; on the right it reaches nearly to
   * the edge with the whole boat in view.
   */
  hookMin: 174,
  hookMax: 1118,
  /** From the middle of the hull out to the rod tip, which is over the bow. */
  rodReach: 174,
  /** Fish turn round once they are this far off either side. */
  turnLeft: -170,
  turnRight: 1322,
} as const;

export const PHYSICS = {
  /** The hook sinks at this, design pixels per second. */
  dropSpeed: 540,
  /** An empty hook comes back up at this. */
  emptySpeed: 760,
  /**
   * A 1 comes up at `reelLight`, a 10 at `reelHeavy`, and everything between
   * on a curve, so each step heavier is the same share slower and a 10 is a
   * real effort next to a 1. Twice as fast after a speed potion.
   */
  reelLight: 430,
  reelHeavy: 72,
  /** The boat sails at this when the bucket is empty, and slows as it fills. */
  boatSpeed: 460,
  boatLoadSlowdown: 0.35,
  /** Slack around a fish the hook can still catch it in. */
  hookPad: 14,
  /** A net touches something from further away than the hook, */
  netPad: 44,
  /** and once it has, scoops up everything this near as well. */
  scoopPad: 64,
  /** A net full of fish reels no slower than this much weight on the line. */
  heaviestHaul: 10,
  /** Where the hook rests, just in the water. */
  restY: 297,
  /** A caught fish is replaced by another of its kind after this long. */
  respawnSeconds: 1.4,
  /** One reel click for every this many pixels of line wound in. */
  reelClickPixels: 30,
  /** A fish thrown back swims off at least this fast. */
  fleeSpeed: 300,
  /** The clock ticks out loud for the last few seconds. */
  tickFrom: 5,
} as const;

export type What = { kind: 'fish'; species: SpeciesId } | { kind: 'item'; item: ItemId };

export interface Swimmer {
  id: number;
  what: What;
  x: number;
  y: number;
  /** The depth it swims at; it bobs around this. */
  baseY: number;
  dir: 1 | -1;
  /** How fast it is going now. */
  speed: number;
  /** How fast it goes when nothing has frightened it. */
  natural: number;
  /** Where in its bob it is, so a shoal does not move in step. */
  phase: number;
  hooked: boolean;
}

export type HookState = 'ready' | 'dropping' | 'reeling';

export interface Hook {
  state: HookState;
  y: number;
  /** The ids of whatever is on it: one thing on the hook, any number in the net. */
  catch: number[];
  /** This cast is the net's: it scoops up everything near what it touches. */
  net: boolean;
}

/** `stuck` is a gap nothing in the bay can fill, said at once rather than waited out. */
export type Outcome = 'full' | 'capsized' | 'timeout' | 'stuck';

export interface WorldState {
  def: LevelDef;
  /** Seconds since the level opened, running or not. */
  time: number;
  timeLeft: number;
  /** The clock does not run until the level has announced itself. */
  running: boolean;
  /** The middle of the hull, and where it is sailing to. It always faces right. */
  boat: { x: number; target: number };
  hook: Hook;
  swimmers: Swimmer[];
  /** Every weight in the bucket, in the order it went in. */
  bucket: number[];
  /** Drank a speed potion: reeling is twice as fast for the rest of the level. */
  fast: boolean;
  /** Health potions held: each one throws back a fish that would tip the boat. */
  saves: number;
  /** Nets held: the next cast is the net's, and scoops up a bunch at once. */
  nets: number;
  outcome: Outcome | null;
  /** How many times the player has sailed and cast, for the coach. */
  sailed: number;
  casts: number;
}

export type WorldEvent =
  | { type: 'cast' }
  /** `weight` is everything on the line together; `count` is more than one in a net. */
  | { type: 'hooked'; what: What; weight: number; count: number }
  | { type: 'empty' }
  | { type: 'reel'; weight: number }
  /** One fish into the bucket. Out of a net they go in one after another: `order` counts them. */
  | { type: 'caught'; weight: number; total: number; order: number }
  /** A net came up with more than one fish: what they weigh, and the bucket after. */
  | { type: 'netted'; weights: number[]; total: number }
  | { type: 'item'; item: ItemId }
  /** A health potion threw back the catch that would have tipped the boat: a fish, or a whole net. */
  | { type: 'saved'; weights: number[]; total: number }
  | { type: 'full'; total: number }
  | { type: 'capsized'; total: number }
  | { type: 'stuck'; total: number; gap: number }
  | { type: 'timeout' }
  | { type: 'tick'; seconds: number };

export const total = (state: WorldState): number => state.bucket.reduce((sum, weight) => sum + weight, 0);

/** What a swimmer weighs in the bucket: an item weighs nothing. */
export const weightOf = (what: What): number => (what.kind === 'fish' ? SPECIES[what.species].weight : 0);

/** How heavy it is on the line, which is not the same thing for treasure. */
export const dragOf = (what: What): number => (what.kind === 'fish' ? SPECIES[what.species].weight : ITEMS[what.item].drag);

/** Its picture's size in the water: length and height, design pixels. A heavier fish is a bigger fish. */
export function sizeOf(what: What): { length: number; height: number } {
  if (what.kind === 'item') {
    const item = ITEMS[what.item];
    return { length: item.length, height: item.length * item.aspect };
  }
  const species = SPECIES[what.species];
  const length = 70 + species.weight * 10;
  return { length, height: length * species.aspect };
}

const gaitOf = (what: What): Gait => (what.kind === 'fish' ? SPECIES[what.species].gait : ITEMS[what.item].gait);

/** How fast the line comes in with this on the end, or this much weight. */
export function reelSpeed(state: WorldState, what: What | number | null): number {
  if (what === null || what === 0) return PHYSICS.emptySpeed;
  const drag = typeof what === 'number' ? what : dragOf(what);
  const heaviness = (drag - 1) / 9;
  const speed = PHYSICS.reelLight * Math.pow(PHYSICS.reelHeavy / PHYSICS.reelLight, heaviness);
  return speed * (state.fast ? 2 : 1);
}

/** The hook hangs from the rod tip, out over the side the boat faces. */
export const hookX = (state: WorldState): number => state.boat.x + BAY.rodReach;

/** Where the hook is heading: over where the boat is sailing to. */
export const hookTarget = (state: WorldState): number => state.boat.target + BAY.rodReach;

/** Everything on the line, the first thing it touched first. */
export const onLine = (state: WorldState): Swimmer[] =>
  state.hook.catch.flatMap((id) => state.swimmers.find((swimmer) => swimmer.id === id) ?? []);

/** How heavy the line is to wind in: a net of fish together, up to a point. */
export const lineDrag = (state: WorldState): number =>
  Math.min(PHYSICS.heaviestHaul, onLine(state).reduce((sum, swimmer) => sum + dragOf(swimmer.what), 0));

/** Where something in the net hangs, from the hook: side by side, so every number can be read. */
export const inNet = (index: number): { x: number; y: number } => {
  const step = Math.ceil(index / 2);
  return { x: (index % 2 === 1 ? -1 : 1) * 48 * step, y: 16 * step };
};

const between = (rng: Rng, [low, high]: readonly [number, number]): number => low + (high - low) * rng.next();

const depthToY = (share: number): number => BAY.swimTop + share * (BAY.swimBottom - BAY.swimTop);

export interface World {
  readonly state: WorldState;
  start(): void;
  /** Sail so the rod tip ends up over `x`. Ignored while the hook is out. */
  sail(x: number): WorldEvent[];
  cast(): WorldEvent[];
  step(dt: number): WorldEvent[];
}

export interface WorldOptions {
  seed?: number;
}

/** Longest single step the simulation takes; a long frame is cut into these. */
const MAX_STEP = 1 / 30;

export function createWorld(def: LevelDef, options: WorldOptions = {}): World {
  const rng = createRng(options.seed ?? Math.floor(Math.random() * 2 ** 31));
  let nextId = 1;
  let reeled = 0;
  let lastTick = Infinity;
  const respawns: { at: number; species: SpeciesId }[] = [];

  const make = (what: What, x: number, dir: 1 | -1): Swimmer => {
    const range = what.kind === 'fish' ? SPECIES[what.species] : ITEMS[what.item];
    const gait = gaitOf(what);
    const baseY = gait === 'walk' || gait === 'rest' ? BAY.sandY : depthToY(between(rng, range.depth));
    const natural = between(rng, range.speed);
    return { id: nextId++, what, x, y: baseY, baseY, dir, speed: natural, natural, phase: rng.next() * Math.PI * 2, hooked: false };
  };

  const state: WorldState = {
    def,
    time: 0,
    timeLeft: def.seconds,
    running: false,
    boat: { x: 576 - BAY.rodReach, target: 576 - BAY.rodReach },
    hook: { state: 'ready', y: PHYSICS.restY, catch: [], net: false },
    swimmers: [],
    bucket: [...(def.start ?? [])],
    fast: false,
    saves: 0,
    nets: 0,
    outcome: null,
    sailed: 0,
    casts: 0,
  };

  // Spread the opening shoal across the whole width, so there is something
  // under the boat wherever it goes from the first second.
  const opening: What[] = [
    ...def.fish.flatMap(({ species, count }) => Array.from({ length: count }, (): What => ({ kind: 'fish', species }))),
    ...(def.items ?? []).flatMap(({ item, count }) => Array.from({ length: count }, (): What => ({ kind: 'item', item }))),
  ];
  opening.forEach((what, index) => {
    const slot = (index + 0.2 + rng.next() * 0.6) / opening.length;
    // Something that never moves is put where the boat can reach it.
    const still = gaitOf(what) === 'rest';
    const x = still ? BAY.hookMin + 30 + rng.next() * (BAY.hookMax - BAY.hookMin - 60) : 40 + slot * 1072;
    state.swimmers.push(make(what, x, rng.next() < 0.5 ? 1 : -1));
  });

  const spawn = (species: SpeciesId): void => {
    const dir: 1 | -1 = rng.next() < 0.5 ? 1 : -1;
    state.swimmers.push(make({ kind: 'fish', species }, dir === 1 ? BAY.turnLeft + 20 : BAY.turnRight - 20, dir));
  };

  const remove = (id: number): void => {
    state.swimmers = state.swimmers.filter((swimmer) => swimmer.id !== id);
  };

  const touching = (swimmer: Swimmer, x: number, y: number, pad: number): boolean => {
    const { length, height } = sizeOf(swimmer.what);
    // The body, not the picture's corners: fins and claws stick out past it.
    const dx = (x - swimmer.x) / (length * 0.42 + pad);
    const dy = (y - swimmer.y) / (height * 0.38 + pad);
    return dx * dx + dy * dy <= 1;
  };

  const land = (events: WorldEvent[]): void => {
    const haul = onLine(state);
    state.hook = { state: 'ready', y: PHYSICS.restY, catch: [], net: false };
    for (const swimmer of haul) remove(swimmer.id);
    for (const { what } of haul) {
      if (what.kind !== 'item') continue;
      if (what.item === 'speed-potion') state.fast = true;
      if (what.item === 'health-potion') state.saves += 1;
      if (what.item === 'net') state.nets += 1;
      if (what.item === 'bonus-time') state.timeLeft += BONUS_SECONDS;
      events.push({ type: 'item', item: what.item });
    }
    const weights = haul.flatMap(({ what }) => (what.kind === 'fish' ? [SPECIES[what.species].weight] : []));
    for (const { what } of haul) if (what.kind === 'fish') respawns.push({ at: state.time + PHYSICS.respawnSeconds, species: what.species });
    if (weights.length === 0) return;
    const after = total(state) + weights.reduce((sum, weight) => sum + weight, 0);
    if (after > def.capacity && state.saves > 0) {
      // The health potion: the catch that would tip the boat jumps back in.
      state.saves -= 1;
      events.push({ type: 'saved', weights, total: after });
      return;
    }
    if (weights.length > 1) events.push({ type: 'netted', weights, total: after });
    weights.forEach((weight, order) => {
      state.bucket.push(weight);
      events.push({ type: 'caught', weight, total: total(state), order });
    });
    if (after === def.capacity) {
      state.outcome = 'full';
      events.push({ type: 'full', total: after });
    } else if (after > def.capacity) {
      state.outcome = 'capsized';
      events.push({ type: 'capsized', total: after });
    } else if (!reachable(def.capacity - after, weightsIn(def))) {
      state.outcome = 'stuck';
      events.push({ type: 'stuck', total: after, gap: def.capacity - after });
    }
  };

  const dropHook = (): WorldEvent[] => {
    // Casting stops the boat where it is: the hook goes down here, now.
    state.boat.target = state.boat.x;
    // Holding a net, this cast is the net's.
    const net = state.nets > 0;
    if (net) state.nets -= 1;
    state.hook = { state: 'dropping', y: PHYSICS.restY, catch: [], net };
    state.casts += 1;
    return [{ type: 'cast' }];
  };

  const swim = (swimmer: Swimmer, dt: number): void => {
    if (swimmer.hooked) return;
    const gait = gaitOf(swimmer.what);
    if (gait === 'rest') return;
    swimmer.x += swimmer.dir * swimmer.speed * dt;
    swimmer.y =
      swimmer.baseY +
      (gait === 'swim' ? Math.sin(state.time * 1.6 + swimmer.phase) * 7 : gait === 'drift' ? Math.sin(state.time * 0.9 + swimmer.phase) * 22 : 0);
    const off = swimmer.dir === 1 ? swimmer.x > BAY.turnRight : swimmer.x < BAY.turnLeft;
    if (!off) return;
    // Out of sight it turns round, at a new depth and calm again, so what comes
    // back looks like a different fish.
    const range = swimmer.what.kind === 'fish' ? SPECIES[swimmer.what.species] : ITEMS[swimmer.what.item];
    swimmer.dir = swimmer.dir === 1 ? -1 : 1;
    if (gait !== 'walk') swimmer.baseY = depthToY(between(rng, range.depth));
    swimmer.speed = swimmer.natural;
  };

  const advance = (dt: number, events: WorldEvent[]): void => {
    state.time += dt;
    if (state.outcome) return;

    if (state.running) {
      state.timeLeft = Math.max(0, state.timeLeft - dt);
      const whole = Math.ceil(state.timeLeft);
      if (whole < lastTick && whole <= PHYSICS.tickFrom && whole > 0) events.push({ type: 'tick', seconds: whole });
      lastTick = whole;
      if (state.timeLeft <= 0) {
        state.outcome = 'timeout';
        events.push({ type: 'timeout' });
        return;
      }
    }

    if (state.hook.state === 'ready') {
      const load = Math.min(1, total(state) / def.capacity);
      const speed = PHYSICS.boatSpeed * (1 - PHYSICS.boatLoadSlowdown * load);
      const gap = state.boat.target - state.boat.x;
      const move = Math.sign(gap) * Math.min(Math.abs(gap), speed * dt);
      state.boat.x += move;

    }

    for (const swimmer of state.swimmers) swim(swimmer, dt);

    const hook = state.hook;
    if (hook.state === 'dropping') {
      hook.y += PHYSICS.dropSpeed * dt;
      const x = hookX(state);
      // The first thing the hook meets is the thing it catches: the topmost.
      const hit = state.swimmers
        .filter((swimmer) => !swimmer.hooked && touching(swimmer, x, hook.y, hook.net ? PHYSICS.netPad : PHYSICS.hookPad))
        .sort((a, b) => a.y - b.y)[0];
      if (hit) {
        // A net scoops up everything near what it touched as well.
        const scooped = hook.net
          ? state.swimmers.filter((swimmer) => swimmer !== hit && !swimmer.hooked && touching(swimmer, x, hit.y, PHYSICS.scoopPad))
          : [];
        const haul = [hit, ...scooped];
        for (const swimmer of haul) swimmer.hooked = true;
        hook.catch = haul.map((swimmer) => swimmer.id);
        hook.state = 'reeling';
        reeled = 0;
        const weight = haul.reduce((sum, swimmer) => sum + weightOf(swimmer.what), 0);
        events.push({ type: 'hooked', what: hit.what, weight, count: haul.length });
      } else if (hook.y >= BAY.floorY - 12) {
        hook.y = BAY.floorY - 12;
        hook.state = 'reeling';
        events.push({ type: 'empty' });
      }
    } else if (hook.state === 'reeling') {
      const haul = onLine(state);
      const drag = lineDrag(state);
      const distance = reelSpeed(state, drag) * dt;
      hook.y -= distance;
      haul.forEach((swimmer, index) => {
        const offset = inNet(index);
        swimmer.x = hookX(state) + offset.x;
        swimmer.y = hook.y + sizeOf(swimmer.what).length * 0.4 + offset.y;
      });
      if (haul.length > 0) {
        reeled += distance;
        while (reeled >= PHYSICS.reelClickPixels) {
          reeled -= PHYSICS.reelClickPixels;
          events.push({ type: 'reel', weight: drag });
        }
      }
      if (hook.y <= PHYSICS.restY) land(events);
    }

    while (respawns.length > 0 && respawns[0]!.at <= state.time) spawn(respawns.shift()!.species);
  };

  return {
    state,

    start() {
      state.running = true;
    },

    sail(x) {
      if (state.outcome || state.hook.state !== 'ready') return [];
      state.boat.target = Math.max(BAY.hookMin, Math.min(BAY.hookMax, x)) - BAY.rodReach;
      state.sailed += 1;
      return [];
    },

    cast() {
      if (state.outcome || state.hook.state !== 'ready') return [];
      return dropHook();
    },

    step(dt) {
      const events: WorldEvent[] = [];
      let left = Math.max(0, dt);
      while (left > 1e-9) {
        const slice = Math.min(MAX_STEP, left);
        advance(slice, events);
        left -= slice;
      }
      return events;
    },
  };
}
