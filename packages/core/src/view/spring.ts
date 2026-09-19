export interface Spring {
  value: number;
  target: number;
  velocity: number;
  step(dt: number): void;
  snap(value: number): void;
  readonly settled: boolean;
}

export interface SpringOptions {
  stiffness?: number;
  damping?: number;
}

/** Below this, motion is invisible and the spring counts as at rest. */
const EPSILON = 0.001;
/** Longest step the integrator takes; anything larger is sub-stepped. */
const MAX_STEP = 1 / 60;

/**
 * A critically damped spring: reaches the target quickly, never bounces past
 * it. Used for the plank angle, the gauge needle and the danger glow, all of which
 * should look smooth without ever influencing the game's mathematical state.
 */
export function createSpring(initial: number, options: SpringOptions = {}): Spring {
  const stiffness = options.stiffness ?? 180;
  const damping = options.damping ?? 2 * Math.sqrt(stiffness);

  let value = initial;
  let target = initial;
  let velocity = 0;

  const integrate = (dt: number): void => {
    const acceleration = stiffness * (target - value) - damping * velocity;
    velocity += acceleration * dt;
    value += velocity * dt;
  };

  return {
    get value() {
      return value;
    },
    set value(next: number) {
      value = next;
    },
    get target() {
      return target;
    },
    set target(next: number) {
      target = next;
    },
    get velocity() {
      return velocity;
    },
    set velocity(next: number) {
      velocity = next;
    },
    step(dt) {
      if (!(dt > 0)) return;
      let remaining = Math.min(dt, 0.25);
      while (remaining > 0) {
        const slice = Math.min(remaining, MAX_STEP);
        integrate(slice);
        remaining -= slice;
      }
      if (Math.abs(target - value) < EPSILON && Math.abs(velocity) < EPSILON) {
        value = target;
        velocity = 0;
      }
    },
    snap(next) {
      value = next;
      target = next;
      velocity = 0;
    },
    get settled() {
      return Math.abs(target - value) < EPSILON && Math.abs(velocity) < EPSILON;
    },
  };
}
