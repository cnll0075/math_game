// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import type { Phase } from '../driver.js';
import type { Intent } from '../intent.js';
import { LAYOUT } from './geometry.js';
import { createInput } from './input.js';
import { createScene } from './scene.js';
import { NO_SPRITES } from './sprites.js';

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
  Object.defineProperty(event, 'isPrimary', { value: true });
  canvas.dispatchEvent(event);
};

const setup = (phase: Phase = 'fishing', boatX = 500) => {
  const canvas = canvasOf(1152, 768);
  const intents: Intent[] = [];
  const input = createInput(canvas, createScene(NO_SPRITES), (intent) => intents.push(intent), () => ({ phase, boatX, facing: 1 as const }));
  return { canvas, intents, input };
};

afterEach(() => document.body.replaceChildren());

describe('input', () => {
  it('sails to a tap on the water as the finger goes down, and steers with it', () => {
    const { canvas, intents, input } = setup();
    pointer(canvas, 'pointerdown', 300, 500);
    expect(intents).toEqual([{ kind: 'sail', x: 300 }]);
    pointer(canvas, 'pointermove', 420, 500);
    pointer(canvas, 'pointerup', 420, 500);
    expect(intents).toEqual([{ kind: 'sail', x: 300 }, { kind: 'sail', x: 420 }]);
    input.dispose();
  });

  it('casts from the hook button, and from the boat itself', () => {
    const { canvas, intents, input } = setup();
    pointer(canvas, 'pointerdown', LAYOUT.hookButton.x, LAYOUT.hookButton.y);
    pointer(canvas, 'pointerup', LAYOUT.hookButton.x, LAYOUT.hookButton.y);
    pointer(canvas, 'pointerdown', 500, 230);
    pointer(canvas, 'pointerup', 500, 230);
    expect(intents).toEqual([{ kind: 'cast' }, { kind: 'cast' }]);
    input.dispose();
  });

  it('moves on with a tap between levels, on lifting', () => {
    const { canvas, intents, input } = setup('won');
    pointer(canvas, 'pointerdown', 500, 500);
    expect(intents).toEqual([]);
    pointer(canvas, 'pointerup', 500, 500);
    expect(intents).toEqual([{ kind: 'next' }]);
    input.dispose();
  });

  it('sails with the arrow keys and casts with space', () => {
    const { intents, input } = setup();
    globalThis.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    globalThis.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    expect(intents).toEqual([{ kind: 'nudge', dir: -1 }, { kind: 'cast' }]);
    input.dispose();
  });
});
