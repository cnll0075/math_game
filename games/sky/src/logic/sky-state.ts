import { PLANE_TYPES, type PlaneTypeId } from './planes.js';

/**
 * One plane in the air. Positions are fractions, never pixels: `progress` runs
 * 0 at the spawn line to 1 at the escape line, and `lane` runs 0 to 1 across the
 * playfield. The view is the only thing that knows how big a screen is.
 */
export interface Plane {
  readonly uid: string;
  /** What it wears, and therefore what sum can ask for it. */
  readonly number: number;
  readonly type: PlaneTypeId;
  progress: number;
  /** Seconds it takes to fall the whole way, its type's speed included. */
  fallSeconds: number;
  /** The line it flies down; weavers sway about it. */
  lane: number;
  /** Where its sway starts, so two weavers never move as one. */
  phase: number;
  age: number;
  hits: number;
  /** Whether its number can be read right now. */
  hidden: boolean;
  /** Seconds until it hides or shows again. */
  hideTimer: number;
}

/** Keeps a plane's whole body on the playfield, however far it sways. */
const clampLane = (x: number, halfWidth: number): number =>
  Math.min(1 - halfWidth, Math.max(halfWidth, x));

export const planeX = (plane: Plane): number => {
  const type = PLANE_TYPES[plane.type];
  const sway = type.sway * Math.sin(plane.phase + plane.age * type.swayHz * Math.PI * 2);
  return clampLane(plane.lane + sway, type.halfWidth);
};

/** Seconds of fall left. The number the fair window is measured against. */
export const remaining = (plane: Plane): number => Math.max(0, (1 - plane.progress) * plane.fallSeconds);

export const escaped = (plane: Plane): boolean => plane.progress >= 1;

export function advance(plane: Plane, dt: number): void {
  plane.age += dt;
  plane.progress += dt / plane.fallSeconds;
  const type = PLANE_TYPES[plane.type];
  if (type.hideSeconds <= 0) return;
  plane.hideTimer -= dt;
  if (plane.hideTimer > 0) return;
  plane.hidden = !plane.hidden;
  plane.hideTimer = plane.hidden ? type.hideSeconds : type.showSeconds;
}

/** Whether a shell at this point, in playfield fractions, is inside the plane. */
export const struck = (plane: Plane, x: number, y: number): boolean => {
  const type = PLANE_TYPES[plane.type];
  return Math.abs(x - planeX(plane)) <= type.halfWidth && Math.abs(y - plane.progress) <= type.halfHeight;
};

/** Another shell home. A blimp remembers the hits it has taken. */
export const damage = (plane: Plane): 'damaged' | 'destroyed' => {
  plane.hits += 1;
  return plane.hits >= PLANE_TYPES[plane.type].hits ? 'destroyed' : 'damaged';
};
