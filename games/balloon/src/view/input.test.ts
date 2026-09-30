// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import type { Intent } from '../intent.js';
import { createRescue } from '../logic/rescue.js';
import type { RescueDef } from '../logic/rescue-def.js';
import type { Phase } from '../driver.js';
import { LAYOUT, trayPoint } from './geometry.js';
import { createInput } from './input.js';
import { createScene } from './scene.js';

const def: RescueDef = { id: 'i', line: '', weight: 8, tray: [5, 3, 6, 2] };

/** A canvas laid out at `width` by `height` CSS pixels at the page's origin. */
const canvasOf = (width: number, height: number): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  Object.defineProperty(canvas, 'clientWidth', { value: width });
  Object.defineProperty(canvas, 'clientHeight', { value: height });
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width, height, right: width, bottom: height, x: 0, y: 0, toJSON: () => ({}) });
  document.body.appendChild(canvas);
  return canvas;
};

const pointer = (canvas: HTMLCanvasElement, type: string, x: number, y: number) => {
  const event = new MouseEvent(type, { clientX: x, clientY: y, bubbles: true }) as MouseEvent & { pointerId: number };
  Object.defineProperty(event, 'pointerId', { value: 1 });
  canvas.dispatchEvent(event);
};

const setup = (width = 1152, height = 768, phase: Phase = 'building') => {
  const canvas = canvasOf(width, height);
  const intents: Intent[] = [];
  const rescue = createRescue(def);
  const input = createInput(canvas, createScene(), (intent) => intents.push(intent), () => ({ phase, rescue: rescue.state }));
  return { canvas, intents, input };
};

afterEach(() => document.body.replaceChildren());

describe('input', () => {
  it('turns a tap on a tray balloon into a clip', () => {
    const { canvas, intents, input } = setup();
    const at = trayPoint(def, 2);
    pointer(canvas, 'pointerdown', at.x, at.y);
    pointer(canvas, 'pointerup', at.x, at.y);
    expect(intents).toEqual([{ kind: 'tray', index: 2 }]);
    input.dispose();
  });

  it('clips a balloon dragged up out of the tray', () => {
    const { canvas, intents, input } = setup();
    const at = trayPoint(def, 1);
    pointer(canvas, 'pointerdown', at.x, at.y);
    pointer(canvas, 'pointerup', at.x + 40, at.y - 260);
    expect(intents).toEqual([{ kind: 'tray', index: 1 }]);
    input.dispose();
  });

  it('leaves a balloon dragged sideways and dropped back in the tray', () => {
    const { canvas, intents, input } = setup();
    const at = trayPoint(def, 1);
    pointer(canvas, 'pointerdown', at.x, at.y);
    pointer(canvas, 'pointerup', at.x + 150, at.y);
    expect(intents).toEqual([]);
    input.dispose();
  });

  it('presses the button', () => {
    const { canvas, intents, input } = setup();
    const x = LAYOUT.button.left + 20;
    const y = LAYOUT.button.top + 20;
    pointer(canvas, 'pointerdown', x, y);
    pointer(canvas, 'pointerup', x, y);
    expect(intents).toEqual([{ kind: 'letGo' }]);
    input.dispose();
  });

  it('hits the balloon under the finger on a screen that is not 3:2', () => {
    // 2000x768: the design is centred with 424px of sky either side.
    const { canvas, intents, input } = setup(2000, 768);
    const at = trayPoint(def, 0);
    pointer(canvas, 'pointerdown', at.x + 424, at.y);
    pointer(canvas, 'pointerup', at.x + 424, at.y);
    expect(intents).toEqual([{ kind: 'tray', index: 0 }]);
    input.dispose();
  });

  it('turns any tap into "next" once a rescue is done', () => {
    const { canvas, intents, input } = setup(1152, 768, 'rescued');
    pointer(canvas, 'pointerdown', 600, 300);
    pointer(canvas, 'pointerup', 600, 300);
    expect(intents).toEqual([{ kind: 'next' }]);
    input.dispose();
  });

  it('does nothing while the kit is flying', () => {
    const { canvas, intents, input } = setup(1152, 768, 'flying');
    const at = trayPoint(def, 0);
    pointer(canvas, 'pointerdown', at.x, at.y);
    pointer(canvas, 'pointerup', at.x, at.y);
    expect(intents).toEqual([]);
    input.dispose();
  });

  it('lets go with the space bar, and stops listening when disposed', () => {
    const { intents, input } = setup();
    globalThis.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    expect(intents).toEqual([{ kind: 'letGo' }]);
    input.dispose();
    globalThis.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    expect(intents).toHaveLength(1);
  });
});
