// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import type { Intent } from '../intent.js';
import { createRescue, type Rescue } from '../logic/rescue.js';
import type { RescueDef } from '../logic/rescue-def.js';
import type { Phase } from '../driver.js';
import { bunchPoint, HOME, homeOf, LAYOUT, trayPoint } from './geometry.js';
import { createInput } from './input.js';
import { createScene, type Drag } from './scene.js';

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

const pointer = (canvas: HTMLCanvasElement, type: string, x: number, y: number, pointerId = 1, isPrimary = false) => {
  const event = new MouseEvent(type, { clientX: x, clientY: y, bubbles: true }) as MouseEvent & { pointerId: number };
  Object.defineProperty(event, 'pointerId', { value: pointerId });
  Object.defineProperty(event, 'isPrimary', { value: isPrimary });
  canvas.dispatchEvent(event);
};

const setup = (
  width = 1152,
  height = 768,
  phase: Phase = 'building',
  prepare: (rescue: Rescue) => void = () => {},
  rescueDef: RescueDef = def,
) => {
  const canvas = canvasOf(width, height);
  const intents: Intent[] = [];
  const drags: Array<Drag | null> = [];
  const rescue = createRescue(rescueDef);
  prepare(rescue);
  const scene = { ...createScene(), setDrag: (drag: Drag | null) => void drags.push(drag) };
  const input = createInput(canvas, scene, (intent) => intents.push(intent), () => ({ phase, rescue: rescue.state }));
  return { canvas, intents, drags, input, rescue };
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
    expect(intents).toEqual([{ kind: 'tray', index: 1, kit: 0 }]);
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

  it('ignores a finger pressed during the flight and lifted after landing', () => {
    const canvas = canvasOf(1152, 768);
    const intents: Intent[] = [];
    let phase: Phase = 'flying';
    const rescue = createRescue(def);
    const input = createInput(canvas, createScene(), (intent) => intents.push(intent), () => ({ phase, rescue: rescue.state }));
    pointer(canvas, 'pointerdown', 600, 300);
    phase = 'rescued';
    pointer(canvas, 'pointerup', 600, 300);
    expect(intents).toEqual([]);
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

  it('shows the balloon under the finger while it is dragged, and stops when it is dropped', () => {
    const { canvas, drags, input } = setup();
    const at = trayPoint(def, 2);
    pointer(canvas, 'pointerdown', at.x, at.y);
    pointer(canvas, 'pointermove', at.x + 30, at.y - 120);
    expect(drags.at(-1)).toEqual({ from: { kind: 'tray', index: 2 }, value: 6, at: { x: at.x + 30, y: at.y - 120 } });
    pointer(canvas, 'pointerup', at.x + 30, at.y - 120);
    expect(drags.at(-1)).toBeNull();
    input.dispose();
  });

  it('does not show a drag for a finger that has barely moved', () => {
    const { canvas, drags, input } = setup();
    const at = trayPoint(def, 2);
    pointer(canvas, 'pointerdown', at.x, at.y);
    pointer(canvas, 'pointermove', at.x + 4, at.y);
    expect(drags.filter(Boolean)).toEqual([]);
    input.dispose();
  });

  it('does not clip a balloon dropped on the button', () => {
    const { canvas, intents, input } = setup();
    const at = trayPoint(def, 3);
    pointer(canvas, 'pointerdown', at.x, at.y);
    pointer(canvas, 'pointerup', LAYOUT.button.left + 40, LAYOUT.button.top + 40);
    expect(intents).toEqual([]);
    input.dispose();
  });

  it('takes a clipped balloon off when it is dragged down into the tray', () => {
    const { canvas, intents, input } = setup(1152, 768, 'building', (rescue) => {
      rescue.clip(0);
      rescue.clip(1);
    });
    const at = bunchPoint(1, 2, HOME);
    pointer(canvas, 'pointerdown', at.x, at.y);
    pointer(canvas, 'pointermove', 500, LAYOUT.trayY);
    pointer(canvas, 'pointerup', 500, LAYOUT.trayY);
    expect(intents).toEqual([{ kind: 'clipped', kit: 0, slot: 1 }]);
    input.dispose();
  });

  it('leaves a clipped balloon on when it is dragged and dropped back in the sky', () => {
    const { canvas, intents, input } = setup(1152, 768, 'building', (rescue) => rescue.clip(0));
    const at = bunchPoint(0, 1, HOME);
    pointer(canvas, 'pointerdown', at.x, at.y);
    pointer(canvas, 'pointerup', at.x + 120, at.y + 60);
    expect(intents).toEqual([]);
    input.dispose();
  });

  it('does not drag a tied balloon: a tied one is popped by a tap', () => {
    const tiedDef: RescueDef = { id: 't', line: '', weight: 7, tray: [], tied: [6, 3, 1] };
    const canvas = canvasOf(1152, 768);
    const intents: Intent[] = [];
    const drags: Array<Drag | null> = [];
    const rescue = createRescue(tiedDef);
    const scene = { ...createScene(), setDrag: (drag: Drag | null) => void drags.push(drag) };
    const input = createInput(canvas, scene, (intent) => intents.push(intent), () => ({ phase: 'building', rescue: rescue.state }));
    const at = bunchPoint(1, 3, HOME);
    pointer(canvas, 'pointerdown', at.x, at.y);
    pointer(canvas, 'pointermove', at.x + 100, at.y + 200);
    pointer(canvas, 'pointerup', at.x + 100, at.y + 200);
    expect(drags.filter(Boolean)).toEqual([]);
    expect(intents).toEqual([]);
    input.dispose();
  });

  it('stops drawing the drag when the pointer is cancelled', () => {
    const { canvas, drags, input } = setup();
    const at = trayPoint(def, 0);
    pointer(canvas, 'pointerdown', at.x, at.y);
    pointer(canvas, 'pointermove', at.x, at.y - 200);
    pointer(canvas, 'pointercancel', at.x, at.y - 200);
    expect(drags.at(-1)).toBeNull();
    input.dispose();
  });

  it('puts a tray balloon back when it is dragged away and brought back to its place', () => {
    const { canvas, intents, input } = setup();
    const at = trayPoint(def, 1);
    pointer(canvas, 'pointerdown', at.x, at.y);
    pointer(canvas, 'pointermove', at.x, at.y - 220);
    pointer(canvas, 'pointerup', at.x, at.y);
    expect(intents).toEqual([]);
    input.dispose();
  });

  it('keeps a clipped balloon on when it is dragged away and brought back to its place', () => {
    const { canvas, intents, input } = setup(1152, 768, 'building', (rescue) => rescue.clip(0));
    const at = bunchPoint(0, 1, HOME);
    pointer(canvas, 'pointerdown', at.x, at.y);
    pointer(canvas, 'pointermove', at.x + 150, at.y + 100);
    pointer(canvas, 'pointerup', at.x, at.y);
    expect(intents).toEqual([]);
    input.dispose();
  });

  it('ignores a second finger, and clears the drag when the first one lifts', () => {
    const { canvas, intents, drags, input } = setup();
    const at = trayPoint(def, 2);
    pointer(canvas, 'pointerdown', at.x, at.y, 1);
    pointer(canvas, 'pointermove', at.x, at.y - 150, 1);
    const elsewhere = trayPoint(def, 0);
    pointer(canvas, 'pointerdown', elsewhere.x, elsewhere.y, 2);
    pointer(canvas, 'pointerup', elsewhere.x, elsewhere.y, 2);
    expect(intents).toEqual([]);
    pointer(canvas, 'pointerup', at.x, at.y - 150, 1);
    expect(drags.at(-1)).toBeNull();
    input.dispose();
  });

  it('starts over on a new first finger, even if the last one\'s lift was lost', () => {
    const { canvas, intents, drags, input } = setup();
    const lost = trayPoint(def, 2);
    pointer(canvas, 'pointerdown', lost.x, lost.y, 1, true);
    pointer(canvas, 'pointermove', lost.x, lost.y - 150, 1, true);
    // No pointerup for finger 1. A fresh first touch must still work.
    const at = trayPoint(def, 0);
    pointer(canvas, 'pointerdown', at.x, at.y, 7, true);
    pointer(canvas, 'pointerup', at.x, at.y, 7, true);
    expect(drags.at(-1)).toBeNull();
    expect(intents).toEqual([{ kind: 'tray', index: 0 }]);
    input.dispose();
  });

  const pairDef: RescueDef = { id: 'p', line: '', weight: 4, friend: 5, tray: [3, 1, 2, 3] };

  it('clips a dropped balloon to whichever kit it lands nearest', () => {
    const { canvas, intents, input } = setup(1152, 768, 'building', () => {}, pairDef);
    const at = trayPoint(pairDef, 0);
    const second = homeOf(pairDef, 1);
    pointer(canvas, 'pointerdown', at.x, at.y);
    pointer(canvas, 'pointermove', second.x, 330);
    pointer(canvas, 'pointerup', second.x, 330);
    expect(intents).toEqual([{ kind: 'tray', index: 0, kit: 1 }]);
    input.dispose();
  });

  it('selects a kit with a tap', () => {
    const { canvas, intents, input } = setup(1152, 768, 'building', () => {}, pairDef);
    const second = homeOf(pairDef, 1);
    pointer(canvas, 'pointerdown', second.x, second.y - 55);
    pointer(canvas, 'pointerup', second.x, second.y - 55);
    expect(intents).toEqual([{ kind: 'select', kit: 1 }]);
    input.dispose();
  });

  it('takes a balloon off the second kit when it is dragged into the tray', () => {
    const { canvas, intents, input } = setup(1152, 768, 'building', (rescue) => rescue.clip(0, 1), pairDef);
    const at = bunchPoint(0, 1, homeOf(pairDef, 1));
    pointer(canvas, 'pointerdown', at.x, at.y);
    pointer(canvas, 'pointermove', 500, LAYOUT.trayY);
    pointer(canvas, 'pointerup', 500, LAYOUT.trayY);
    expect(intents).toEqual([{ kind: 'clipped', kit: 1, slot: 0 }]);
    input.dispose();
  });

  it('presses start over', () => {
    const { canvas, intents, input } = setup();
    pointer(canvas, 'pointerdown', LAYOUT.reset.x, LAYOUT.reset.y);
    pointer(canvas, 'pointerup', LAYOUT.reset.x, LAYOUT.reset.y);
    expect(intents).toEqual([{ kind: 'reset' }]);
    input.dispose();
  });
});
