import { DESIGN, type Point, type Size } from '@bundle/core';
import type { Phase } from '../driver.js';
import type { Intent } from '../intent.js';
import type { RescueState } from '../logic/rescue.js';
import { hitTest, LAYOUT } from './geometry.js';
import type { Scene } from './scene.js';

export interface InputHandle {
  dispose(): void;
}

/** Further than this and a press has become a drag. */
const DRAG_PIXELS = 16;

/**
 * Tap is the main gesture, because six-year-olds drag imprecisely. A tray
 * balloon also clips when dragged up out of the tray; dropped back in the tray,
 * it stays where it was. Everything else acts when the finger lifts on the
 * thing it went down on, so a slipped finger does nothing.
 */
export function createInput(
  canvas: HTMLCanvasElement,
  scene: Scene,
  emit: (intent: Intent) => void,
  current: () => { phase: Phase; rescue: RescueState },
): InputHandle {
  let pressed: { intent: Intent | null; at: Point } | null = null;

  const screenSize = (): Size => ({
    width: canvas.clientWidth || DESIGN.width,
    height: canvas.clientHeight || DESIGN.height,
  });

  const designPoint = (event: PointerEvent): Point => {
    const bounds = canvas.getBoundingClientRect();
    return scene.toDesign({ x: event.clientX - bounds.left, y: event.clientY - bounds.top }, screenSize());
  };

  const same = (a: Intent | null, b: Intent | null): boolean => JSON.stringify(a) === JSON.stringify(b);

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
    pressed = { intent: phase === 'building' ? hitTest(at, rescue) : null, at };
  };

  const onPointerUp = (event: PointerEvent): void => {
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
    const moved = Math.hypot(at.x - down.at.x, at.y - down.at.y);
    const fromTray = down.intent.kind === 'tray';
    if (fromTray) {
      if (moved < DRAG_PIXELS || at.y < LAYOUT.trayY - 90) emit(down.intent);
      return;
    }
    if (same(hitTest(at, rescue), down.intent)) emit(down.intent);
  };

  const onPointerCancel = (): void => {
    pressed = null;
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== ' ' && event.key !== 'Enter') return;
    const { phase } = current();
    if (phase === 'building') emit({ kind: 'letGo' });
    else if (phase === 'rescued' || phase === 'finished') emit({ kind: 'next' });
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
