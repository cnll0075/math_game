import { DESIGN, type Point, type Size } from '@bundle/core';
import type { Phase } from '../driver.js';
import type { Intent } from '../intent.js';
import { inBoardsButton, inPickerPanel, padAt, pickerAt } from './geometry.js';
import type { Scene } from './scene.js';

export interface InputHandle {
  dispose(): void;
}

/**
 * Tap is the whole game: a tap acts when the finger lifts on the thing it went
 * down on, so a slipped finger does nothing. One finger is followed; a second
 * is ignored. Arrow keys and Space do the same on a desktop, for testing.
 */
export function createInput(
  canvas: HTMLCanvasElement,
  scene: Scene,
  emit: (intent: Intent) => void,
  current: () => { phase: Phase; size: number; frogAt?: (point: Point) => boolean },
): InputHandle {
  let pressed: { pointerId: number; intent: Intent | null } | null = null;
  let cursor: number | null = null;

  const screenSize = (): Size => ({
    width: canvas.clientWidth || DESIGN.width,
    height: canvas.clientHeight || DESIGN.height,
  });

  const designPoint = (event: PointerEvent): Point => {
    const bounds = canvas.getBoundingClientRect();
    return scene.toDesign({ x: event.clientX - bounds.left, y: event.clientY - bounds.top }, screenSize());
  };

  const intentAt = (point: Point): Intent | null => {
    const { phase, size, frogAt } = current();
    if (phase === 'picking') {
      const index = pickerAt(point);
      if (index !== null) return { kind: 'pick', index };
      return inPickerPanel(point) ? null : { kind: 'close' };
    }
    if (inBoardsButton(point)) return { kind: 'picker' };
    if (phase === 'cleared') return { kind: 'next' };
    // The frog never sits on a pad, so a tap on it is only ever a poke.
    if (frogAt?.(point)) return { kind: 'frog', point };
    const index = padAt(point, size);
    return index === null ? null : { kind: 'flip', index };
  };

  const same = (a: Intent | null, b: Intent | null): boolean =>
    a?.kind === 'frog' && b?.kind === 'frog' ? true : JSON.stringify(a) === JSON.stringify(b);

  const onPointerDown = (event: PointerEvent): void => {
    if (pressed && pressed.pointerId !== event.pointerId && !event.isPrimary) return;
    canvas.setPointerCapture?.(event.pointerId);
    pressed = { pointerId: event.pointerId, intent: intentAt(designPoint(event)) };
  };

  const onPointerUp = (event: PointerEvent): void => {
    if (!pressed || pressed.pointerId !== event.pointerId) return;
    const down = pressed;
    pressed = null;
    canvas.releasePointerCapture?.(event.pointerId);
    if (down.intent && same(intentAt(designPoint(event)), down.intent)) emit(down.intent);
  };

  const onPointerCancel = (event: PointerEvent): void => {
    if (pressed?.pointerId === event.pointerId) pressed = null;
  };

  const MOVES: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

  const onKeyDown = (event: KeyboardEvent): void => {
    const { phase, size } = current();
    const move = MOVES[event.key];
    if (move && phase === 'playing') {
      const at = cursor ?? 0;
      const col = Math.min(size - 1, Math.max(0, (at % size) + move[0]));
      const row = Math.min(size - 1, Math.max(0, Math.floor(at / size) + move[1]));
      cursor = row * size + col;
      scene.setCursor(cursor);
      return;
    }
    if (event.key === 'Escape' && phase === 'picking') emit({ kind: 'close' });
    if (event.key !== ' ' && event.key !== 'Enter') return;
    if (phase === 'playing') emit({ kind: 'flip', index: cursor ?? 0 });
    else if (phase === 'cleared') emit({ kind: 'next' });
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
