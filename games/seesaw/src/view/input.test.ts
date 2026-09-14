// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { createInput, sideAt, type InputIntent } from './input.js';
import { createScene } from './scene.js';
import { createVectorTheme } from './vector-theme.js';
import { SCENE } from './geometry.js';
import { DESIGN } from './layout.js';
import type { SceneModel } from './scene.js';
import { describeSeesaw } from '../logic/seesaw-state.js';

const model = (overrides: Partial<SceneModel> = {}): SceneModel => ({
  snapshot: describeSeesaw([]),
  placed: [],
  targetBalance: null,
  celebrating: false,
  dancing: false,
  tray: [
    { uid: 'tray-0', species: 'chicken', count: 1, used: false },
    { uid: 'tray-1', species: 'cat', count: 1, used: false },
  ],
  selectedTrayIndex: null,
  caption: 'Make it level',
  won: false,
  goalToken: 'test:0',
  stages: 1,
  stagesCleared: 0,
  ...overrides,
});

/** jsdom has no layout, so the canvas reports a 1024x768 box for us. */
const makeCanvas = (): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  Object.defineProperty(canvas, 'clientWidth', { value: DESIGN.width });
  Object.defineProperty(canvas, 'clientHeight', { value: DESIGN.height });
  canvas.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: DESIGN.width, height: DESIGN.height }) as DOMRect;
  return canvas;
};

const pointer = (type: string, x: number, y: number): Event => {
  const event = new Event(type, { bubbles: true }) as Event & { clientX: number; clientY: number; pointerId: number };
  event.clientX = x;
  event.clientY = y;
  event.pointerId = 1;
  return event;
};

describe('sideAt', () => {
  it('finds the left and right landing areas on a level plank', () => {
    expect(sideAt({ x: SCENE.fulcrumX - SCENE.plankHalfLength, y: SCENE.fulcrumY - 40 }, 0)).toBe('left');
    expect(sideAt({ x: SCENE.fulcrumX + SCENE.plankHalfLength, y: SCENE.fulcrumY - 40 }, 0)).toBe('right');
  });

  it('follows the platforms as the plank tilts', () => {
    const tilted = 0.3;
    const rightDown = { x: SCENE.fulcrumX + SCENE.plankHalfLength * Math.cos(tilted), y: SCENE.fulcrumY + SCENE.plankHalfLength * Math.sin(tilted) - 40 };
    expect(sideAt(rightDown, tilted)).toBe('right');
  });

  it('ignores taps in the sky and on the tray', () => {
    expect(sideAt({ x: DESIGN.width / 2, y: 40 }, 0)).toBeNull();
    expect(sideAt({ x: DESIGN.width / 2, y: SCENE.trayY }, 0)).toBeNull();
  });
});

describe('createInput', () => {
  let canvas: HTMLCanvasElement;
  let scene: ReturnType<typeof createScene>;
  let intents: InputIntent[];

  beforeEach(() => {
    canvas = makeCanvas();
    scene = createScene(createVectorTheme());
    scene.update(1 / 60, model());
    intents = [];
  });

  const listen = (armed = true) =>
    createInput(canvas, scene, (intent) => void intents.push(intent), () => armed);

  it('arms an animal when the tray is tapped', () => {
    listen();
    const slot = scene.traySlots()[0]!;
    canvas.dispatchEvent(pointer('pointerdown', slot.x, slot.y));
    expect(intents).toEqual([{ kind: 'pickTray', index: 0 }]);
  });

  it('drops the armed animal on the side that is tapped next', () => {
    listen();
    const slot = scene.traySlots()[1]!;
    canvas.dispatchEvent(pointer('pointerdown', slot.x, slot.y));
    canvas.dispatchEvent(pointer('pointerup', SCENE.fulcrumX + SCENE.plankHalfLength, SCENE.fulcrumY - 40));
    expect(intents).toEqual([
      { kind: 'pickTray', index: 1 },
      { kind: 'dropSide', side: 'right' },
    ]);
  });

  it('supports a drag from the tray to a platform', () => {
    listen();
    const slot = scene.traySlots()[0]!;
    canvas.dispatchEvent(pointer('pointerdown', slot.x, slot.y));
    canvas.dispatchEvent(pointer('pointerup', SCENE.fulcrumX - SCENE.plankHalfLength, SCENE.fulcrumY - 40));
    expect(intents.at(-1)).toEqual({ kind: 'dropSide', side: 'left' });
  });

  it('takes a placed animal back when it is tapped', () => {
    const placed = [{ uid: 'tray-0', source: 'tray-0', species: 'chicken' as const, side: 'left' as const }];
    scene.update(1 / 60, model({ placed, snapshot: describeSeesaw(placed) }));
    for (let i = 0; i < 200; i++) scene.update(1 / 60, model({ placed, snapshot: describeSeesaw(placed) }));
    listen(false);
    // Tap the animal's body, which sits above the pose's feet position.
    const pose = scene.placements()[0]!.pose;
    canvas.dispatchEvent(pointer('pointerdown', pose.x + pose.slide, pose.y - 26));
    canvas.dispatchEvent(pointer('pointerup', pose.x + pose.slide, pose.y - 26));
    expect(intents).toContainEqual({ kind: 'takeBack', uid: 'tray-0' });
  });

  it('leaves placed animals alone while an animal is armed', () => {
    const placed = [{ uid: 'tray-0', source: 'tray-0', species: 'chicken' as const, side: 'left' as const }];
    for (let i = 0; i < 200; i++) scene.update(1 / 60, model({ placed, snapshot: describeSeesaw(placed) }));
    listen(true);
    const pose = scene.placements()[0]!.pose;
    canvas.dispatchEvent(pointer('pointerdown', pose.x + pose.slide, pose.y));
    canvas.dispatchEvent(pointer('pointerup', pose.x + pose.slide, pose.y));
    expect(intents.some((intent) => intent.kind === 'takeBack')).toBe(false);
    expect(intents.at(-1)).toEqual({ kind: 'dropSide', side: 'left' });
  });

  it('clears the selection when empty space is tapped', () => {
    listen();
    canvas.dispatchEvent(pointer('pointerdown', 20, 20));
    canvas.dispatchEvent(pointer('pointerup', 20, 20));
    expect(intents).toEqual([{ kind: 'clearSelection' }]);
  });

  it('stops listening once disposed', () => {
    const handle = listen();
    handle.dispose();
    const slot = scene.traySlots()[0]!;
    canvas.dispatchEvent(pointer('pointerdown', slot.x, slot.y));
    expect(intents).toEqual([]);
  });
});
