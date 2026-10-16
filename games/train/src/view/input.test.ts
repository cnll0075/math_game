// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import type { Phase } from '../driver.js';
import type { Intent } from '../intent.js';
import type { Crate } from '../logic/run.js';
import { HUD, slotCentre, TRACKS } from './geometry.js';
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

const pointer = (canvas: HTMLCanvasElement, type: string, x: number, y: number, pointerId = 1, isPrimary = true) => {
  const event = new MouseEvent(type, { clientX: x, clientY: y, bubbles: true }) as MouseEvent & { pointerId: number };
  Object.defineProperty(event, 'pointerId', { value: pointerId });
  Object.defineProperty(event, 'isPrimary', { value: isPrimary });
  canvas.dispatchEvent(event);
};

const QUEUE: Crate[] = [{ id: 11, weight: 3 }, { id: 12, weight: 5 }];

const setup = (phase: () => Phase = () => 'playing') => {
  const canvas = canvasOf(1152, 768);
  const intents: Intent[] = [];
  const input = createInput(canvas, createScene(NO_SPRITES), (intent) => intents.push(intent), () => ({ phase: phase(), queue: QUEUE }));
  return { canvas, intents, input };
};

afterEach(() => document.body.replaceChildren());

describe('dragging', () => {
  it('loads the crate picked up onto the track it is dropped on', () => {
    const { canvas, intents, input } = setup();
    const from = slotCentre(1);
    pointer(canvas, 'pointerdown', from.x, from.y);
    pointer(canvas, 'pointermove', 700, TRACKS[2]!.railY - 40);
    pointer(canvas, 'pointerup', 700, TRACKS[2]!.railY - 40);
    expect(intents).toEqual([{ kind: 'load', crate: 12, track: 2 }]);
    input.dispose();
  });

  it('drops a crate let go anywhere else, loading nothing', () => {
    const { canvas, intents, input } = setup();
    const from = slotCentre(0);
    pointer(canvas, 'pointerdown', from.x, from.y);
    pointer(canvas, 'pointermove', 600, 700);
    pointer(canvas, 'pointerup', 600, 700);
    pointer(canvas, 'pointerdown', 600, 300);
    pointer(canvas, 'pointerup', 700, TRACKS[0]!.railY - 40);
    expect(intents).toEqual([]);
    input.dispose();
  });

  it('ignores a second finger while one crate is held', () => {
    const { canvas, intents, input } = setup();
    const from = slotCentre(0);
    pointer(canvas, 'pointerdown', from.x, from.y, 1);
    pointer(canvas, 'pointerdown', slotCentre(1).x, slotCentre(1).y, 2, false);
    pointer(canvas, 'pointerup', 700, TRACKS[1]!.railY - 40, 2, false);
    pointer(canvas, 'pointerup', 700, TRACKS[0]!.railY - 40, 1);
    expect(intents).toEqual([{ kind: 'load', crate: 11, track: 0 }]);
    input.dispose();
  });

  it('drops a crate still held when the run ends, and taps carry on after it', () => {
    let phase: Phase = 'playing';
    const { canvas, intents, input } = setup(() => phase);
    pointer(canvas, 'pointerdown', slotCentre(0).x, slotCentre(0).y);
    phase = 'over';
    pointer(canvas, 'pointerup', 700, TRACKS[0]!.railY - 40);
    expect(intents).toEqual([{ kind: 'next' }]);
    input.dispose();
  });

  it('pauses from the button, and a tap while paused carries on', () => {
    let phase: Phase = 'playing';
    const { canvas, intents, input } = setup(() => phase);
    pointer(canvas, 'pointerdown', HUD.pause.x, HUD.pause.y);
    pointer(canvas, 'pointerup', HUD.pause.x, HUD.pause.y);
    phase = 'paused';
    pointer(canvas, 'pointerdown', 500, 500);
    pointer(canvas, 'pointerup', 500, 500);
    expect(intents).toEqual([{ kind: 'pause' }, { kind: 'next' }]);
    input.dispose();
  });
});
