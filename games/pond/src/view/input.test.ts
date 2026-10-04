// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import type { Phase } from '../driver.js';
import type { Intent } from '../intent.js';
import { LAYOUT, padRect, pickerRect } from './geometry.js';
import { createInput } from './input.js';
import { createScene } from './scene.js';

const canvasOf = (width: number, height: number): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  Object.defineProperty(canvas, 'clientWidth', { value: width });
  Object.defineProperty(canvas, 'clientHeight', { value: height });
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width, height, right: width, bottom: height, x: 0, y: 0, toJSON: () => ({}) });
  document.body.appendChild(canvas);
  return canvas;
};

const pointer = (canvas: HTMLCanvasElement, type: string, x: number, y: number, pointerId = 1) => {
  const event = new MouseEvent(type, { clientX: x, clientY: y, bubbles: true }) as MouseEvent & { pointerId: number };
  Object.defineProperty(event, 'pointerId', { value: pointerId });
  Object.defineProperty(event, 'isPrimary', { value: pointerId === 1 });
  canvas.dispatchEvent(event);
};

const tap = (canvas: HTMLCanvasElement, x: number, y: number) => {
  pointer(canvas, 'pointerdown', x, y);
  pointer(canvas, 'pointerup', x, y);
};

const setup = (phase: Phase = 'playing', size = 4, width = 1152, height = 768) => {
  const canvas = canvasOf(width, height);
  const intents: Intent[] = [];
  const input = createInput(canvas, createScene(), (intent) => intents.push(intent), () => ({ phase, size }));
  return { canvas, intents, input };
};

const centre = (rect: { x: number; y: number; w: number; h: number }) => ({ x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 });

afterEach(() => document.body.replaceChildren());

describe('input', () => {
  it('turns a tap on a pad into a flip', () => {
    const { canvas, intents, input } = setup();
    const at = centre(padRect(4, 5));
    tap(canvas, at.x, at.y);
    expect(intents).toEqual([{ kind: 'flip', index: 5 }]);
    input.dispose();
  });

  it('does nothing for a finger that slides off the pad it went down on', () => {
    const { canvas, intents, input } = setup();
    const at = centre(padRect(4, 5));
    const away = centre(padRect(4, 6));
    pointer(canvas, 'pointerdown', at.x, at.y);
    pointer(canvas, 'pointerup', away.x, away.y);
    expect(intents).toEqual([]);
    input.dispose();
  });

  it('hits the pad under the finger on a screen that is not 3:2', () => {
    // 2000x768: the design is centred with 424px of water either side.
    const { canvas, intents, input } = setup('playing', 9, 2000, 768);
    const at = centre(padRect(9, 40));
    tap(canvas, at.x + 424, at.y);
    expect(intents).toEqual([{ kind: 'flip', index: 40 }]);
    input.dispose();
  });

  it('opens the picker from the Boards button', () => {
    const { canvas, intents, input } = setup();
    tap(canvas, LAYOUT.boardsButton.left + 20, LAYOUT.boardsButton.top + 20);
    expect(intents).toEqual([{ kind: 'picker' }]);
    input.dispose();
  });

  it('picks a board in the picker, and closes it on a tap outside', () => {
    const { canvas, intents, input } = setup('picking');
    const at = centre(pickerRect(2));
    tap(canvas, at.x, at.y);
    tap(canvas, 20, 740);
    expect(intents).toEqual([{ kind: 'pick', index: 2 }, { kind: 'close' }]);
    input.dispose();
  });

  it('moves on with any tap once the pond is cleared', () => {
    const { canvas, intents, input } = setup('cleared');
    tap(canvas, 600, 400);
    expect(intents).toEqual([{ kind: 'next' }]);
    input.dispose();
  });

  it('ignores a second finger', () => {
    const { canvas, intents, input } = setup();
    const at = centre(padRect(4, 0));
    const other = centre(padRect(4, 1));
    pointer(canvas, 'pointerdown', at.x, at.y, 1);
    pointer(canvas, 'pointerdown', other.x, other.y, 2);
    pointer(canvas, 'pointerup', other.x, other.y, 2);
    pointer(canvas, 'pointerup', at.x, at.y, 1);
    expect(intents).toEqual([{ kind: 'flip', index: 0 }]);
    input.dispose();
  });

  it('moves a highlight with the arrow keys and flips with the space bar', () => {
    const { intents, input } = setup();
    globalThis.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    globalThis.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    globalThis.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    expect(intents).toEqual([{ kind: 'flip', index: 5 }]);
    input.dispose();
    globalThis.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    expect(intents).toHaveLength(1);
  });
});
