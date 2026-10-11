import { reachable, weightsIn } from './reach.js';
import { BAY, hookX, PHYSICS, sizeOf, total, weightOf, type Swimmer, type World, type WorldState } from './world.js';

/**
 * A player that never misreads a number, for the tests that guard the levels
 * and for the test seam. `biggest` lands the largest fish that still fits;
 * `smallest` only ever lands the smallest, which is safe but slow.
 */
export type Policy = 'biggest' | 'smallest';

/** Where a swimmer will be in `seconds`, ignoring its bob and its turning round. */
const ahead = (swimmer: Swimmer, seconds: number): number => swimmer.x + swimmer.dir * swimmer.speed * seconds;

const dropSeconds = (y: number): number => Math.max(0, y - PHYSICS.restY) / PHYSICS.dropSpeed;

/**
 * What a hook dropped at `x` now would catch first, judged by where everything
 * will be as the hook passes its depth.
 */
export function firstCatch(state: WorldState, x: number): Swimmer | null {
  let best: Swimmer | null = null;
  for (const swimmer of state.swimmers) {
    if (swimmer.hooked) continue;
    const { length, height } = sizeOf(swimmer.what);
    const pad = state.nets > 0 ? PHYSICS.netPad : PHYSICS.hookPad;
    // Where it is while the hook passes through its depth, from top to bottom,
    // with room for its bob: a fast fish can swim into the line on the way down.
    const top = dropSeconds(Math.max(PHYSICS.restY, swimmer.y - height * 0.38 - pad - 25));
    const bottom = dropSeconds(swimmer.y + height * 0.38 + pad + 25);
    const from = Math.min(ahead(swimmer, top), ahead(swimmer, bottom));
    const to = Math.max(ahead(swimmer, top), ahead(swimmer, bottom));
    const reach = length * 0.42 + pad + 12;
    if (x < from - reach || x > to + reach) continue;
    if (!best || swimmer.y < best.y) best = swimmer;
  }
  return best;
}

/**
 * Everything a net dropped at `x` now would come up with: what it touches
 * first, and what is near that when it does.
 */
export function netCatch(state: WorldState, x: number): Swimmer[] {
  const first = firstCatch(state, x);
  if (!first) return [];
  const seconds = dropSeconds(first.y);
  return state.swimmers.filter((swimmer) => {
    if (swimmer.hooked) return false;
    if (swimmer === first) return true;
    const { length, height } = sizeOf(swimmer.what);
    // A little more room than the net really has, to be safe.
    const dx = (ahead(swimmer, seconds) - x) / (length * 0.42 + PHYSICS.scoopPad + 30);
    const dy = (swimmer.y - first.y) / (height * 0.38 + PHYSICS.scoopPad + 30);
    return dx * dx + dy * dy <= 1;
  });
}

/** Where to drop for this fish, from where the boat is now. */
function aimFor(state: WorldState, swimmer: Swimmer): number {
  const load = Math.min(1, total(state) / state.def.capacity);
  const boatSpeed = PHYSICS.boatSpeed * (1 - PHYSICS.boatLoadSlowdown * load);
  let x = ahead(swimmer, dropSeconds(swimmer.y));
  for (let pass = 0; pass < 3; pass += 1) {
    const sail = Math.abs(x - hookX(state)) / boatSpeed;
    x = ahead(swimmer, sail + dropSeconds(swimmer.y));
  }
  return x;
}

/** One frame of play: sail towards the chosen fish, and cast when over it. */
export function botTurn(world: World, policy: Policy): void {
  const state = world.state;
  if (state.outcome) return;
  if (state.hook.state === 'reeling') {
    return;
  }
  if (state.hook.state !== 'ready') return;

  const room = state.def.capacity - total(state);
  const choices = state.swimmers
    .filter((swimmer) => swimmer.what.kind === 'fish' && !swimmer.hooked)
    // Never leave a gap nothing in the bay can fill.
    .filter((swimmer) => reachable(room - weightOf(swimmer.what), weightsIn(state.def)))
    .map((swimmer) => ({ swimmer, x: aimFor(state, swimmer) }))
    .filter(({ x }) => x >= BAY.hookMin && x <= BAY.hookMax);
  if (choices.length === 0) return;

  const weight = (choice: { swimmer: Swimmer }): number => weightOf(choice.swimmer.what);
  const best = policy === 'biggest' ? Math.max(...choices.map(weight)) : Math.min(...choices.map(weight));
  const target = choices
    .filter((choice) => weight(choice) === best)
    .sort((a, b) => Math.abs(a.x - hookX(state)) - Math.abs(b.x - hookX(state)))[0]!;

  if (Math.abs(target.x - hookX(state)) <= 8) {
    const haul = state.nets > 0 ? netCatch(state, hookX(state)) : [firstCatch(state, hookX(state))].flatMap((swimmer) => swimmer ?? []);
    const load = haul.reduce((sum, swimmer) => sum + weightOf(swimmer.what), 0);
    // Something too heavy in the way: wait for it to pass rather than tip the boat.
    if (load > 0 && !reachable(room - load, weightsIn(state.def))) return;
    world.cast();
    return;
  }
  world.sail(target.x);
}

/** Play a world out with a policy. Returns how it ended and the time left. */
export function playOut(world: World, policy: Policy, maxSeconds = 600): { outcome: WorldState['outcome']; timeLeft: number } {
  world.start();
  const dt = 1 / 60;
  for (let t = 0; t < maxSeconds && !world.state.outcome; t += dt) {
    botTurn(world, policy);
    world.step(dt);
  }
  return { outcome: world.state.outcome, timeLeft: world.state.timeLeft };
}
