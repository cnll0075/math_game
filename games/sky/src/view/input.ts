import { DESIGN, type Point, type Size } from '@bundle/core';
import { laneAt } from './geometry.js';
import type { Scene } from './scene.js';

export type InputIntent = { kind: 'aim'; lane: number } | { kind: 'fire' } | { kind: 'restart' };

export interface InputHandle {
  dispose(): void;
}

/** How far the arrow keys move the fighter per press. */
const KEY_STEP = 0.06;

/**
 * Drag to move, fire on release.
 *
 * One shot per touch: the finger positions the fighter and lifting it shoots.
 * Firing on touch-down would spray a shell every time the fighter was
 * repositioned, and repositioning is most of what a player does. A shell that
 * hits nothing costs nothing, so a drag that ends in a shot is harmless.
 */
export function createInput(
  canvas: HTMLCanvasElement,
  scene: Scene,
  emit: (intent: InputIntent) => void,
  isOver: () => boolean = () => false,
): InputHandle {
  let down = false;
  let keyLane = 0.5;

  const screenSize = (): Size => ({
    width: canvas.clientWidth || DESIGN.width,
    height: canvas.clientHeight || DESIGN.height,
  });

  const designPoint = (event: PointerEvent): Point => {
    const bounds = canvas.getBoundingClientRect();
    return scene.toDesign({ x: event.clientX - bounds.left, y: event.clientY - bounds.top }, screenSize());
  };

  const onPointerDown = (event: PointerEvent): void => {
    down = true;
    if (isOver()) return;
    canvas.setPointerCapture?.(event.pointerId);
    emit({ kind: 'aim', lane: laneAt(designPoint(event).x) });
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (!down || isOver()) return;
    emit({ kind: 'aim', lane: laneAt(designPoint(event).x) });
  };

  const onPointerUp = (event: PointerEvent): void => {
    if (!down) return;
    down = false;
    canvas.releasePointerCapture?.(event.pointerId);
    if (isOver()) {
      emit({ kind: 'restart' });
      return;
    }
    // Aim once more first: a fast drag should shoot from where it ended, not
    // from wherever the last move event happened to land.
    emit({ kind: 'aim', lane: laneAt(designPoint(event).x) });
    emit({ kind: 'fire' });
  };

  const onPointerCancel = (): void => {
    down = false;
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      keyLane = Math.min(1, Math.max(0, keyLane + (event.key === 'ArrowLeft' ? -KEY_STEP : KEY_STEP)));
      emit({ kind: 'aim', lane: keyLane });
      return;
    }
    if (event.key !== ' ' && event.key !== 'Enter') return;
    emit(isOver() ? { kind: 'restart' } : { kind: 'fire' });
  };

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerCancel);
  globalThis.addEventListener?.('keydown', onKeyDown);

  return {
    dispose() {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerCancel);
      globalThis.removeEventListener?.('keydown', onKeyDown);
    },
  };
}
