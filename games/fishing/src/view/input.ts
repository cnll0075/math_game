import { DESIGN, type Point, type Size } from '@bundle/core';
import type { Phase } from '../driver.js';
import type { Intent } from '../intent.js';
import { onBoat, onHookButton } from './geometry.js';
import type { Scene } from './scene.js';

export interface InputHandle {
  dispose(): void;
}

/**
 * Two verbs, both taps. A tap on the water sails the boat there, acting as the
 * finger goes down so the boat answers at once, and a finger held and slid
 * keeps steering it. A tap on the hook button, or on the boat itself, drops
 * the hook. Between levels a tap (on lifting) moves on.
 */
export function createInput(
  canvas: HTMLCanvasElement,
  scene: Scene,
  emit: (intent: Intent) => void,
  current: () => { phase: Phase; boatX: number; swing: number },
): InputHandle {
  /** The one finger being followed; a second finger is ignored. */
  let pressed: { pointerId: number; steering: boolean } | null = null;

  const screenSize = (): Size => ({
    width: canvas.clientWidth || DESIGN.width,
    height: canvas.clientHeight || DESIGN.height,
  });

  const designPoint = (event: PointerEvent): Point => {
    const bounds = canvas.getBoundingClientRect();
    return scene.toDesign({ x: event.clientX - bounds.left, y: event.clientY - bounds.top }, screenSize());
  };

  const playing = (phase: Phase): boolean => phase === 'intro' || phase === 'fishing';

  const onPointerDown = (event: PointerEvent): void => {
    if (pressed && pressed.pointerId !== event.pointerId && !event.isPrimary) return;
    canvas.setPointerCapture?.(event.pointerId);
    const { phase, boatX, swing } = current();
    pressed = { pointerId: event.pointerId, steering: false };
    if (!playing(phase)) return;
    const at = designPoint(event);
    if (onHookButton(at) || onBoat(at, boatX, swing)) {
      emit({ kind: 'cast' });
      return;
    }
    pressed.steering = true;
    emit({ kind: 'sail', x: at.x });
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (!pressed || pressed.pointerId !== event.pointerId || !pressed.steering) return;
    if (!playing(current().phase)) return;
    emit({ kind: 'sail', x: designPoint(event).x });
  };

  const onPointerUp = (event: PointerEvent): void => {
    if (!pressed || pressed.pointerId !== event.pointerId) return;
    pressed = null;
    canvas.releasePointerCapture?.(event.pointerId);
    if (!playing(current().phase)) emit({ kind: 'next' });
  };

  const onPointerCancel = (event: PointerEvent): void => {
    if (pressed?.pointerId === event.pointerId) pressed = null;
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    const { phase } = current();
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      if (playing(phase)) emit({ kind: 'nudge', dir: event.key === 'ArrowLeft' ? -1 : 1 });
      return;
    }
    if (event.key !== ' ' && event.key !== 'Enter' && event.key !== 'ArrowDown') return;
    emit(playing(phase) ? { kind: 'cast' } : { kind: 'next' });
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
