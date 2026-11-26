import { DESIGN, type Point, type Size } from '@bundle/core';
import type { Phase } from '../driver.js';
import type { Intent } from '../intent.js';
import type { FoodId } from '../logic/friends.js';
import type { TablePhase } from '../logic/table.js';
import { onDial, onShare, plateAt, toFood } from './geometry.js';
import type { Scene } from './scene.js';

export interface InputHandle {
  dispose(): void;
}

/** What input needs to know to read a gesture. */
export interface InputState {
  phase: Phase;
  table: TablePhase;
  seated: number;
  /** What is on the table to cut, if anything. */
  food: FoodId | null;
}

/** A swipe that starts this far from the middle of the food, in radii, is not a cut. */
const CUT_START = 1.6;

/**
 * Taps, and one swipe. A tap on a friend or their plate gives them one; on the
 * dial's left or right half turns it; on Share shares. While a pizza or cake is
 * on the table, a swipe across it cuts. Between rounds a tap (on lifting) moves
 * on, but only a tap that began there. One finger at a time.
 */
export function createInput(canvas: HTMLCanvasElement, scene: Scene, emit: (intent: Intent) => void, current: () => InputState): InputHandle {
  /** The one finger followed: where a cut began, and whether it pressed during play. */
  let pressed: { pointerId: number; cutFrom: Point | null; food: FoodId | null; playing: boolean } | null = null;

  const screenSize = (): Size => ({ width: canvas.clientWidth || DESIGN.width, height: canvas.clientHeight || DESIGN.height });
  const designPoint = (event: PointerEvent): Point => {
    const bounds = canvas.getBoundingClientRect();
    return scene.toDesign({ x: event.clientX - bounds.left, y: event.clientY - bounds.top }, screenSize());
  };
  const isPlaying = (phase: Phase): boolean => phase === 'intro' || phase === 'playing';

  const onPointerDown = (event: PointerEvent): void => {
    if (pressed) return;
    canvas.setPointerCapture?.(event.pointerId);
    const state = current();
    pressed = { pointerId: event.pointerId, cutFrom: null, food: state.food, playing: isPlaying(state.phase) };
    if (!pressed.playing) return;
    const at = designPoint(event);
    if (state.table === 'cutting' && state.food) {
      const from = toFood(state.food, at);
      if (Math.hypot(from.x, from.y) <= CUT_START) pressed.cutFrom = from;
      return;
    }
    const step = onDial(at);
    if (step !== null) {
      emit({ kind: 'dial', step });
      return;
    }
    if (onShare(at)) {
      emit({ kind: 'share' });
      return;
    }
    const plate = plateAt(at, state.seated);
    if (plate !== null && state.table === 'sharing') emit({ kind: 'tap', plate });
  };

  const onPointerUp = (event: PointerEvent): void => {
    if (!pressed || pressed.pointerId !== event.pointerId) return;
    const { cutFrom, food, playing } = pressed;
    pressed = null;
    canvas.releasePointerCapture?.(event.pointerId);
    if (!isPlaying(current().phase)) {
      if (!playing) emit({ kind: 'next' });
      return;
    }
    if (cutFrom && food) {
      const to = toFood(food, designPoint(event));
      scene.swipe(cutFrom, to);
      emit({ kind: 'cut', from: cutFrom, to });
    }
  };

  const onPointerCancel = (event: PointerEvent): void => {
    if (pressed?.pointerId === event.pointerId) pressed = null;
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    const state = current();
    if (!isPlaying(state.phase)) {
      if (event.key === ' ' || event.key === 'Enter') emit({ kind: 'next' });
      return;
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') emit({ kind: 'dial', step: -1 });
    else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') emit({ kind: 'dial', step: 1 });
    else if (event.key === ' ' || event.key === 'Enter') emit({ kind: 'share' });
    else if (/^[1-4]$/.test(event.key)) emit({ kind: 'tap', plate: Number(event.key) - 1 });
  };

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerCancel);
  globalThis.addEventListener?.('keydown', onKeyDown);

  return {
    dispose() {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerCancel);
      globalThis.removeEventListener?.('keydown', onKeyDown);
    },
  };
}
