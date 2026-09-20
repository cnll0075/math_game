// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { createInput, type InputIntent } from './input.js';
import { createScene } from './scene.js';
import { createRun } from '../logic/run.js';
import { laneAt } from './geometry.js';

const harness = (isOver = () => false) => {
  const canvas = document.createElement('canvas');
  Object.defineProperty(canvas, 'clientWidth', { value: 1152 });
  Object.defineProperty(canvas, 'clientHeight', { value: 768 });
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1152, height: 768 }) as DOMRect;
  const scene = createScene();
  const game = createRun({ seed: 1 });
  scene.update(1 / 60, { run: game.state, sumText: '', urgency: 0, mourning: false, heartOnOffer: false, summary: null });
  const intents: InputIntent[] = [];
  const handle = createInput(canvas, scene, (intent) => intents.push(intent), isOver);
  return { canvas, intents, handle };
};

/** jsdom has no PointerEvent, so an Event wearing the fields we read will do. */
const pointer = (kind: string, x: number, y: number): Event => {
  const event = new Event(kind, { bubbles: true }) as Event & {
    clientX: number;
    clientY: number;
    pointerId: number;
  };
  event.clientX = x;
  event.clientY = y;
  event.pointerId = 1;
  return event;
};

describe('input', () => {
  it('aims where the finger goes down', () => {
    const { canvas, intents } = harness();
    canvas.dispatchEvent(pointer('pointerdown', 300, 700));
    expect(intents).toEqual([{ kind: 'aim', lane: laneAt(300) }]);
  });

  it('tracks a drag', () => {
    const { canvas, intents } = harness();
    canvas.dispatchEvent(pointer('pointerdown', 300, 700));
    canvas.dispatchEvent(pointer('pointermove', 600, 700));
    expect(intents.at(-1)).toEqual({ kind: 'aim', lane: laneAt(600) });
  });

  it('fires when the finger lifts — aim, then let go', () => {
    const { canvas, intents } = harness();
    canvas.dispatchEvent(pointer('pointerdown', 300, 700));
    canvas.dispatchEvent(pointer('pointerup', 300, 700));
    expect(intents.at(-1)).toEqual({ kind: 'fire' });
  });

  it('aims a final time before firing, so a fast drag still shoots where it ended', () => {
    const { canvas, intents } = harness();
    canvas.dispatchEvent(pointer('pointerdown', 300, 700));
    canvas.dispatchEvent(pointer('pointerup', 900, 700));
    expect(intents.at(-2)).toEqual({ kind: 'aim', lane: laneAt(900) });
    expect(intents.at(-1)).toEqual({ kind: 'fire' });
  });

  it('does not fire when a touch is cancelled', () => {
    const { canvas, intents } = harness();
    canvas.dispatchEvent(pointer('pointerdown', 300, 700));
    canvas.dispatchEvent(pointer('pointercancel', 300, 700));
    expect(intents.some((intent) => intent.kind === 'fire')).toBe(false);
  });

  it('ignores a drag that never began on the canvas', () => {
    const { canvas, intents } = harness();
    canvas.dispatchEvent(pointer('pointermove', 600, 700));
    canvas.dispatchEvent(pointer('pointerup', 600, 700));
    expect(intents).toHaveLength(0);
  });

  it('restarts instead of firing once the run is over', () => {
    const { canvas, intents } = harness(() => true);
    canvas.dispatchEvent(pointer('pointerdown', 300, 700));
    canvas.dispatchEvent(pointer('pointerup', 300, 700));
    expect(intents).toEqual([{ kind: 'restart' }]);
  });

  it('flies with the arrow keys and fires with space, for testing on a Mac', () => {
    const { intents } = harness();
    globalThis.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    globalThis.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    expect(intents.some((intent) => intent.kind === 'aim')).toBe(true);
    expect(intents.some((intent) => intent.kind === 'fire')).toBe(true);
  });

  it('stops listening once disposed', () => {
    const { canvas, intents, handle } = harness();
    handle.dispose();
    canvas.dispatchEvent(pointer('pointerdown', 300, 700));
    globalThis.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    expect(intents).toHaveLength(0);
  });
});
