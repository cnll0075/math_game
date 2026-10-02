import { DESIGN, type Point, type Size } from '@bundle/core';
import type { Phase } from '../driver.js';
import type { Intent } from '../intent.js';
import type { RescueState } from '../logic/rescue.js';
import { hitTest, inDropZone, inTray } from './geometry.js';
import type { Drag, Scene } from './scene.js';

export interface InputHandle {
  dispose(): void;
}

/** Further than this and a press has become a drag. */
const DRAG_PIXELS = 16;

/**
 * Tap is the main gesture, because six-year-olds drag imprecisely, and it always
 * works. A tray balloon can also be dragged: it follows the finger, clips on if
 * dropped near the kit, and goes back to its place anywhere else. A clipped
 * balloon dragged down into the tray comes off. Tied balloons are tapped, never
 * dragged. Everything else acts when the finger lifts on the thing it went down
 * on, so a slipped finger does nothing.
 */
export function createInput(
  canvas: HTMLCanvasElement,
  scene: Scene,
  emit: (intent: Intent) => void,
  current: () => { phase: Phase; rescue: RescueState },
): InputHandle {
  let pressed: { intent: Intent | null; at: Point; dragging: boolean } | null = null;

  const screenSize = (): Size => ({
    width: canvas.clientWidth || DESIGN.width,
    height: canvas.clientHeight || DESIGN.height,
  });

  const designPoint = (event: PointerEvent): Point => {
    const bounds = canvas.getBoundingClientRect();
    return scene.toDesign({ x: event.clientX - bounds.left, y: event.clientY - bounds.top }, screenSize());
  };

  const same = (a: Intent | null, b: Intent | null): boolean => JSON.stringify(a) === JSON.stringify(b);

  /** What a press on `intent` would drag, if it can be dragged at all. */
  const dragFrom = (intent: Intent | null, rescue: RescueState, at: Point): Drag | null => {
    if (intent?.kind === 'tray') {
      const value = rescue.def.tray[intent.index];
      return value === undefined ? null : { from: { kind: 'tray', index: intent.index }, value, at };
    }
    if (intent?.kind === 'clipped') {
      const value = rescue.clipped[intent.slot]?.value;
      return value === undefined ? null : { from: { kind: 'clipped', slot: intent.slot }, value, at };
    }
    return null;
  };

  const endDrag = (): void => {
    if (pressed?.dragging) scene.setDrag(null);
  };

  const onPointerDown = (event: PointerEvent): void => {
    canvas.setPointerCapture?.(event.pointerId);
    const { phase, rescue } = current();
    // A finger that went down mid-flight belongs to nothing; lifting it after
    // landing must not count as the tap that moves on.
    if (phase === 'flying') {
      pressed = null;
      return;
    }
    const at = designPoint(event);
    pressed = { intent: phase === 'building' ? hitTest(at, rescue) : null, at, dragging: false };
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (!pressed) return;
    const { phase, rescue } = current();
    if (phase !== 'building') return;
    const at = designPoint(event);
    if (!pressed.dragging && Math.hypot(at.x - pressed.at.x, at.y - pressed.at.y) < DRAG_PIXELS) return;
    const drag = dragFrom(pressed.intent, rescue, at);
    if (!drag) return;
    pressed.dragging = true;
    scene.setDrag(drag);
  };

  const onPointerUp = (event: PointerEvent): void => {
    endDrag();
    const down = pressed;
    pressed = null;
    canvas.releasePointerCapture?.(event.pointerId);
    if (!down) return;
    const { phase, rescue } = current();
    if (phase === 'rescued' || phase === 'finished') {
      emit({ kind: 'next' });
      return;
    }
    if (phase !== 'building' || !down.intent) return;

    const at = designPoint(event);
    const dragged = Math.hypot(at.x - down.at.x, at.y - down.at.y) >= DRAG_PIXELS;
    if (down.intent.kind === 'tray') {
      if (!dragged || inDropZone(at)) emit(down.intent);
      return;
    }
    if (down.intent.kind === 'clipped' && dragged) {
      if (inTray(at)) emit(down.intent);
      return;
    }
    if (same(hitTest(at, rescue), down.intent)) emit(down.intent);
  };

  const onPointerCancel = (): void => {
    endDrag();
    pressed = null;
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== ' ' && event.key !== 'Enter') return;
    const { phase } = current();
    if (phase === 'building') emit({ kind: 'letGo' });
    else if (phase === 'rescued' || phase === 'finished') emit({ kind: 'next' });
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
