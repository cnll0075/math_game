import { SCENE } from './geometry.js';
import { ANIMAL_HIT_LIFT } from './animals-art.js';
import { DESIGN, type Point, type Size } from './layout.js';
import type { Side } from '../logic/seesaw-state.js';
import type { Scene } from './scene.js';

export type InputIntent =
  | { kind: 'pickTray'; index: number }
  | { kind: 'dropSide'; side: Side }
  | { kind: 'takeBack'; uid: string }
  | { kind: 'clearSelection' };

export interface InputHandle {
  dispose(): void;
}

/** How close a tap must land to count as hitting a placed animal. */
const ANIMAL_HIT_RADIUS = 46;

const distance = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);

/** Which landing area a point falls in, or null if it is not near either. */
export function sideAt(point: Point, plankAngle: number): Side | null {
  if (point.y < 180 || point.y > SCENE.trayY - 70) return null;
  let best: Side | null = null;
  let bestDistance = Infinity;
  for (const side of ['left', 'right'] as Side[]) {
    const armX = (side === 'left' ? -1 : 1) * SCENE.plankHalfLength;
    const anchor = {
      x: SCENE.fulcrumX + armX * Math.cos(plankAngle),
      y: SCENE.fulcrumY + armX * Math.sin(plankAngle) - 50,
    };
    const gap = distance(point, anchor);
    if (gap < bestDistance) {
      bestDistance = gap;
      best = side;
    }
  }
  // Generous: small children aim roughly, and the two areas are far apart.
  return bestDistance <= SCENE.platformWidth ? best : null;
}

/**
 * Turns pointer events into intents. Two ways in, because a five-year-old's
 * drag is unreliable: drag an animal onto a side, or tap the animal and then
 * tap the side.
 *
 * `isArmed` decides what a tap on a platform means. A placed animal always sits
 * inside a landing area, so without it, taking an animal back would be
 * impossible: every tap would read as another placement.
 */
export function createInput(
  canvas: HTMLCanvasElement,
  scene: Scene,
  emit: (intent: InputIntent) => void,
  isArmed: () => boolean = () => true,
): InputHandle {
  let pointerDownAt: Point | null = null;
  let draggingFrom: number | null = null;

  const screenSize = (): Size => ({ width: canvas.clientWidth || DESIGN.width, height: canvas.clientHeight || DESIGN.height });

  const designPoint = (event: PointerEvent): Point => {
    const bounds = canvas.getBoundingClientRect();
    const local = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
    return scene.toDesign(local, screenSize());
  };

  const trayIndexAt = (point: Point): number | null => {
    for (const slot of scene.traySlots()) {
      // Generous vertically: the animals stand below their slot centre, and a
      // child aiming at an animal should hit it.
      const near = Math.hypot(point.x - slot.x, (point.y - slot.y - 12) * 0.8) <= slot.radius + 8;
      if (near) return slot.index;
    }
    return null;
  };

  const placedUidAt = (point: Point): string | null => {
    let best: string | null = null;
    let bestDistance = ANIMAL_HIT_RADIUS;
    for (const placement of scene.placements()) {
      // A pose positions the animal's feet, so aim the hit circle at its body.
      const gap = distance(point, {
        x: placement.pose.x + placement.pose.slide,
        y: placement.pose.y - ANIMAL_HIT_LIFT,
      });
      if (gap < bestDistance) {
        bestDistance = gap;
        best = placement.animal.uid;
      }
    }
    return best;
  };

  const onPointerDown = (event: PointerEvent): void => {
    const point = designPoint(event);
    pointerDownAt = point;
    const trayIndex = trayIndexAt(point);
    if (trayIndex !== null) {
      draggingFrom = trayIndex;
      emit({ kind: 'pickTray', index: trayIndex });
      canvas.setPointerCapture?.(event.pointerId);
    }
  };

  const onPointerUp = (event: PointerEvent): void => {
    const point = designPoint(event);
    const wasDragging = draggingFrom;
    pointerDownAt = null;
    draggingFrom = null;
    canvas.releasePointerCapture?.(event.pointerId);

    const armed = wasDragging !== null || isArmed();

    if (armed) {
      const side = sideAt(point, scene.plankAngle);
      if (side) {
        emit({ kind: 'dropSide', side });
        return;
      }
      // Armed, but dropped nowhere useful: put the animal back down.
      if (trayIndexAt(point) === null) emit({ kind: 'clearSelection' });
      return;
    }

    // Nothing armed, so a tap on an animal means "take that one off again".
    const uid = placedUidAt(point);
    if (uid) emit({ kind: 'takeBack', uid });
  };

  const onPointerCancel = (): void => {
    pointerDownAt = null;
    draggingFrom = null;
  };

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerCancel);

  return {
    dispose() {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerCancel);
    },
  };
}
