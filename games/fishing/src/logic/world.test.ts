import { describe, it, expect } from 'vitest';
import type { LevelDef } from './levels.data.js';
import type { ItemId, SpeciesId } from './species.js';
import { BAY, createWorld, hookX, PHYSICS, turning, reelSpeed, total, type What, type World, type WorldEvent } from './world.js';

const DEF: LevelDef = {
  id: 'test',
  title: 'Test',
  line: '',
  capacity: 10,
  seconds: 60,
  fish: [{ species: 'clownfish', count: 1 }, { species: 'tuna', count: 1 }],
};

/** A world with nothing in the water but what the test puts there, standing still. */
function bay(def: Partial<LevelDef> = {}): World {
  const world = createWorld({ ...DEF, ...def }, { seed: 7 });
  world.state.swimmers = [];
  world.start();
  return world;
}

let nextId = 1000;
function put(world: World, what: What, x: number, y: number): void {
  world.state.swimmers.push({ id: nextId++, what, x, y, baseY: y, dir: 1, speed: 0, natural: 0, phase: 0, hooked: false });
}
const fish = (species: SpeciesId): What => ({ kind: 'fish', species });
const item = (id: ItemId): What => ({ kind: 'item', item: id });

/** Step until the hook is back, collecting everything that happened. */
function haul(world: World, seconds = 20): WorldEvent[] {
  const events: WorldEvent[] = [];
  for (let t = 0; t < seconds && (world.state.hook.state !== 'ready' || t === 0) && !world.state.outcome; t += 1 / 60) {
    events.push(...world.step(1 / 60));
  }
  return events;
}

const types = (events: readonly WorldEvent[]): string[] => events.map((event) => event.type).filter((type) => type !== 'reel' && type !== 'tick');

describe('the hook', () => {
  it('catches the first thing it meets on the way down, and lands it in the bucket', () => {
    const world = bay();
    put(world, fish('tuna'), hookX(world.state), 600);
    put(world, fish('clownfish'), hookX(world.state), 400);
    world.cast();
    const events = haul(world);
    expect(types(events)).toEqual(['hooked', 'caught']);
    expect(world.state.bucket).toEqual([1]);
  });

  it('comes back empty from the sand when it misses', () => {
    const world = bay();
    put(world, fish('tuna'), hookX(world.state) + 300, 500);
    world.cast();
    expect(types(haul(world))).toEqual(['empty']);
    expect(world.state.bucket).toEqual([]);
  });

  it('reels a heavy fish in more slowly than a light one', () => {
    const light = bay();
    put(light, fish('clownfish'), hookX(light.state), 600);
    const heavy = bay();
    put(heavy, fish('jellyfish'), hookX(heavy.state), 600);
    const time = (world: World) => {
      world.cast();
      const start = world.state.time;
      haul(world);
      return world.state.time - start;
    };
    expect(time(heavy)).toBeGreaterThan(time(light) * 2.5);
    expect(reelSpeed(heavy.state, fish('jellyfish'))).toBeLessThan(reelSpeed(light.state, fish('clownfish')) / 5);
  });

  it('clicks the reel more often for the same distance with a light catch, in time', () => {
    const world = bay();
    put(world, fish('clownfish'), hookX(world.state), 600);
    world.cast();
    const reels = haul(world).filter((event) => event.type === 'reel');
    expect(reels.length).toBeGreaterThan(5);
  });

  it('will not let the boat sail while the line is out', () => {
    const world = bay();
    const x = hookX(world.state);
    world.cast();
    world.sail(x + 300);
    world.step(0.5);
    expect(hookX(world.state)).toBe(x);
  });

  it('sails the hook to where the finger went, turning the boat to face it', () => {
    const world = bay();
    world.sail(900);
    world.step(5);
    expect(world.state.boat.facing).toBe(1);
    expect(hookX(world.state)).toBeCloseTo(900);
    world.sail(200);
    expect(world.state.boat.facing).toBe(-1);
    world.step(5);
    expect(hookX(world.state)).toBeCloseTo(200);
    // Facing left, the hull is to the right of the hook: on the screen.
    expect(world.state.boat.x).toBeGreaterThan(200);
  });

  it('takes a moment to turn round, swinging the hook across with it', () => {
    const world = bay();
    const start = hookX(world.state);
    world.sail(100);
    expect(world.state.boat.facing).toBe(-1);
    world.step(PHYSICS.turnSeconds / 2);
    expect(turning(world.state)).toBe(true);
    // Halfway round, the rod is over the middle of the hull, not yet on the far side.
    expect(Math.abs(hookX(world.state) - world.state.boat.x)).toBeLessThan(BAY.rodReach * 0.3);
    world.step(PHYSICS.turnSeconds / 2 + 0.05);
    expect(turning(world.state)).toBe(false);
    expect(hookX(world.state)).toBeLessThan(start);
  });

  it('drops the hook as soon as the boat has come round, when the button is tapped mid-turn', () => {
    const world = bay();
    world.sail(100);
    world.step(0.1);
    expect(world.cast()).toEqual([]);
    expect(world.state.hook.state).toBe('ready');
    const events = world.step(PHYSICS.turnSeconds);
    expect(events).toContainEqual({ type: 'cast' });
    expect(world.state.hook.state).toBe('dropping');
  });

  it('reaches nearly to either edge', () => {
    const world = bay();
    world.sail(-500);
    world.step(10);
    expect(hookX(world.state)).toBe(BAY.hookMin);
    world.sail(5000);
    world.step(10);
    expect(hookX(world.state)).toBe(BAY.hookMax);
  });
});

describe('the bucket', () => {
  it('is full when the total is exactly the bucket', () => {
    const world = bay({ capacity: 5 });
    put(world, fish('tuna'), hookX(world.state), 500);
    world.cast();
    expect(types(haul(world))).toEqual(['hooked', 'caught', 'full']);
    expect(world.state.outcome).toBe('full');
  });

  it('tips the boat over when a catch takes it past the bucket', () => {
    const world = bay({ capacity: 4, fish: [{ species: 'clownfish', count: 1 }, { species: 'tuna', count: 1 }] });
    put(world, fish('tuna'), hookX(world.state), 500);
    world.cast();
    expect(types(haul(world))).toContain('capsized');
    expect(world.state.outcome).toBe('capsized');
    expect(total(world.state)).toBe(5);
  });

  it('says at once when the gap left can never be filled, rather than waiting out the clock', () => {
    // 2s and 5s only: 7 leaves 2, fine; 9 would leave 1, which nothing makes.
    const world = bay({ capacity: 10, fish: [{ species: 'bluefish', count: 1 }, { species: 'tuna', count: 1 }], start: [4] });
    put(world, fish('tuna'), hookX(world.state), 500);
    world.cast();
    const events = haul(world);
    expect(world.state.outcome).toBe('stuck');
    expect(events.find((event) => event.type === 'stuck')).toEqual({ type: 'stuck', total: 9, gap: 1 });
  });

  it('starts with whatever the level already put in it', () => {
    const world = bay({ start: [5, 3] });
    expect(total(world.state)).toBe(8);
  });
});

describe('the clock', () => {
  it('does not run until the level starts', () => {
    const world = createWorld(DEF, { seed: 1 });
    world.step(3);
    expect(world.state.timeLeft).toBe(60);
  });

  it('ticks out loud for the last five seconds and ends the level at zero', () => {
    const world = bay({ seconds: 8 });
    const events: WorldEvent[] = [];
    for (let t = 0; t < 9; t += 1 / 60) events.push(...world.step(1 / 60));
    expect(events.filter((event) => event.type === 'tick').map((event) => (event.type === 'tick' ? event.seconds : 0))).toEqual([5, 4, 3, 2, 1]);
    expect(world.state.outcome).toBe('timeout');
  });
});

describe('the items', () => {
  it('weigh nothing in the bucket', () => {
    const world = bay();
    put(world, item('treasure'), hookX(world.state), BAY.sandY);
    world.cast();
    const events = haul(world);
    expect(events).toContainEqual({ type: 'item', item: 'treasure' });
    expect(world.state.bucket).toEqual([]);
  });

  it('treasure is slow to wind up, for nothing', () => {
    const world = bay();
    expect(reelSpeed(world.state, item('treasure'))).toBeLessThan(reelSpeed(world.state, fish('tuna')));
  });

  it('a speed potion reels twice as fast', () => {
    const world = bay();
    const before = reelSpeed(world.state, fish('jellyfish'));
    put(world, item('speed-potion'), hookX(world.state), 400);
    world.cast();
    haul(world);
    expect(world.state.fast).toBe(true);
    expect(reelSpeed(world.state, fish('jellyfish'))).toBeCloseTo(before * 2);
  });

  it('bonus time adds ten seconds', () => {
    const world = bay();
    put(world, item('bonus-time'), hookX(world.state), 400);
    world.cast();
    const before = world.state.timeLeft;
    haul(world);
    expect(world.state.timeLeft).toBeGreaterThan(before + 8);
  });

  it('a health potion throws back the one fish that would tip the boat', () => {
    const world = bay({ capacity: 4 });
    put(world, item('health-potion'), hookX(world.state), 400);
    world.cast();
    haul(world);
    expect(world.state.saves).toBe(1);
    put(world, fish('tuna'), hookX(world.state), 500);
    world.cast();
    const events = haul(world);
    expect(events).toContainEqual({ type: 'saved', weight: 5, total: 5 });
    expect(world.state.outcome).toBeNull();
    expect(world.state.bucket).toEqual([]);
    expect(world.state.saves).toBe(0);
  });

  it('the net catches from further away', () => {
    const near = PHYSICS.hookPad + 20;
    const without = bay();
    put(without, fish('clownfish'), hookX(without.state) + 40 + near, 450);
    without.cast();
    expect(types(haul(without))).toEqual(['empty']);

    const withNet = bay();
    withNet.state.net = true;
    put(withNet, fish('clownfish'), hookX(withNet.state) + 40 + near, 450);
    withNet.cast();
    expect(types(haul(withNet))).toEqual(['hooked', 'caught']);
  });
});

describe('the bay', () => {
  it('replaces a caught fish with another of its kind', () => {
    const world = createWorld(DEF, { seed: 3 });
    world.start();
    const count = () => world.state.swimmers.filter((swimmer) => swimmer.what.kind === 'fish' && swimmer.what.species === 'clownfish').length;
    expect(count()).toBe(1);
    const clown = world.state.swimmers.find((swimmer) => swimmer.what.kind === 'fish' && swimmer.what.species === 'clownfish')!;
    world.state.swimmers = world.state.swimmers.filter((swimmer) => swimmer !== clown);
    clown.x = hookX(world.state);
    clown.y = clown.baseY = 400;
    clown.speed = 0;
    clown.natural = 0;
    world.state.swimmers.unshift(clown);
    world.cast();
    haul(world);
    expect(count()).toBe(0);
    world.step(PHYSICS.respawnSeconds + 0.1);
    expect(count()).toBe(1);
  });

  it('is the same bay for the same seed', () => {
    const a = createWorld(DEF, { seed: 11 }).state.swimmers.map((swimmer) => [swimmer.x, swimmer.y]);
    const b = createWorld(DEF, { seed: 11 }).state.swimmers.map((swimmer) => [swimmer.x, swimmer.y]);
    expect(a).toEqual(b);
  });

  it('keeps crabs and treasure on the sand', () => {
    const world = createWorld(
      { ...DEF, fish: [{ species: 'crab', count: 3 }], items: [{ item: 'treasure', count: 2 }] },
      { seed: 5 },
    );
    world.step(5);
    for (const swimmer of world.state.swimmers) expect(swimmer.y).toBe(BAY.sandY);
  });
});
