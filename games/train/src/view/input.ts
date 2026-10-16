import { DESIGN, type Point, type Size } from '@bundle/core';
import type { Phase } from '../driver.js';
import type { Intent } from '../intent.js';
import type { Crate } from '../logic/run.js';
import { crateAt, onPause, trackAt } from './geometry.js';
import type { Scene } from './scene.js';

export interface InputHandle {
  dispose(): void;
}

/**
 * One gesture: pick a crate up from the queue, carry it, let go over a train.
 * Let go anywhere else and it goes back. The pause button pauses; while
 * paused, or on the summary, a tap (on lifting) carries on. One finger at a
 * time: a second is ignored while a crate is held.
 */
export function createInput(
  canvas: HTMLCanvasElement,
  scene: Scene,
  emit: (intent: Intent) => void,
  current: () => { phase: Phase; queue: readonly Crate[] },
): InputHandle {
  /** The one finger followed; `paused` when its press hit the pause button, so its lifting does not unpause. */
  let pressed: { pointerId: number; crate: number | null; paused: boolean } | null = null;

  const screenSize = (): Size => ({ width: canvas.clientWidth || DESIGN.width, height: canvas.clientHeight || DESIGN.height });
  const designPoint = (event: PointerEvent): Point => {
    const bounds = canvas.getBoundingClientRect();
    return scene.toDesign({ x: event.clientX - bounds.left, y: event.clientY - bounds.top }, screenSize());
  };

  const onPointerDown = (event: PointerEvent): void => {
    if (pressed) return;
    canvas.setPointerCapture?.(event.pointerId);
    pressed = { pointerId: event.pointerId, crate: null, paused: false };
    const { phase, queue } = current();
    if (phase !== 'playing') return;
    const at = designPoint(event);
    if (onPause(at)) {
      pressed.paused = true;
      emit({ kind: 'pause' });
      return;
    }
    const index = crateAt(at, queue.length);
    if (index === null) return;
    pressed.crate = queue[index]!.id;
    scene.drag(pressed.crate, at);
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (!pressed || pressed.pointerId !== event.pointerId || pressed.crate === null) return;
    scene.drag(pressed.crate, designPoint(event));
  };

  const onPointerUp = (event: PointerEvent): void => {
    if (!pressed || pressed.pointerId !== event.pointerId) return;
    const { crate, paused } = pressed;
    pressed = null;
    canvas.releasePointerCapture?.(event.pointerId);
    scene.drag(null);
    if (paused) return;
    const { phase } = current();
    if (phase !== 'playing') {
      emit({ kind: 'next' });
      return;
    }
    if (crate === null) return;
    const track = trackAt(designPoint(event));
    if (track !== null) emit({ kind: 'load', crate, track });
  };

  const onPointerCancel = (event: PointerEvent): void => {
    if (pressed?.pointerId !== event.pointerId) return;
    pressed = null;
    scene.drag(null);
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' || event.key === 'p') {
      emit(current().phase === 'playing' ? { kind: 'pause' } : { kind: 'next' });
    } else if (event.key === ' ' || event.key === 'Enter') {
      if (current().phase !== 'playing') emit({ kind: 'next' });
    }
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
