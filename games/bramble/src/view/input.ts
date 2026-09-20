import { DESIGN, type Point, type Size } from '@bundle/core';
import { LANES } from '../logic/lanes.js';
import { pathXTo } from './geometry.js';
import type { Scene } from './scene.js';

export type InputIntent = { kind: 'steer'; x: number } | { kind: 'restart' };

export interface InputHandle {
  dispose(): void;
}

/**
 * Steering is the whole input: there is no fire button, so a finger down or
 * dragged is the only gesture the game has. The rabbit runs to the finger
 * rather than jumping, which lets a child change their mind right up to the
 * moment a row lands.
 */
export function createInput(
  canvas: HTMLCanvasElement,
  scene: Scene,
  emit: (intent: InputIntent) => void,
  isOver: () => boolean = () => false,
): InputHandle {
  let down = false;
  let keyX = 0.5;

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
    emit({ kind: 'steer', x: pathXTo(designPoint(event).x) });
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (!down || isOver()) return;
    emit({ kind: 'steer', x: pathXTo(designPoint(event).x) });
  };

  const onPointerUp = (event: PointerEvent): void => {
    if (!down) return;
    down = false;
    canvas.releasePointerCapture?.(event.pointerId);
    // Lifting a finger mid-run means nothing: the rabbit keeps the lane it has.
    if (isOver()) emit({ kind: 'restart' });
  };

  const onPointerCancel = (): void => {
    down = false;
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      const step = 1 / LANES;
      keyX = Math.min(1, Math.max(0, keyX + (event.key === 'ArrowLeft' ? -step : step)));
      emit({ kind: 'steer', x: keyX });
      return;
    }
    if (event.key !== ' ' && event.key !== 'Enter') return;
    if (isOver()) emit({ kind: 'restart' });
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
