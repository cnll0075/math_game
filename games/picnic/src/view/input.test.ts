// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import type { Phase } from '../driver.js';
import type { Intent } from '../intent.js';
import type { TablePhase } from '../logic/table.js';
import { DIAL, fenceSpot, FOOD, SHARE, seats } from './geometry.js';
import { createInput, type InputState } from './input.js';
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
  Object.defineProperty(event, 'isPrimary', { value: pointerId === 1 });
  canvas.dispatchEvent(event);
};

const tap = (canvas: HTMLCanvasElement, x: number, y: number, pointerId = 1) => {
  pointer(canvas, 'pointerdown', x, y, pointerId);
  pointer(canvas, 'pointerup', x, y, pointerId);
};

const setup = (state: () => InputState) => {
  const canvas = canvasOf(1152, 768);
  const intents: Intent[] = [];
  const input = createInput(canvas, createScene(NO_SPRITES), (intent) => intents.push(intent), state);
  return { canvas, intents, input };
};

const playing = (table: TablePhase, seated = 3): (() => InputState) => () => ({ phase: 'playing' as Phase, table, seated, food: 'pizza', waiting: [], seatedFriends: [] });

afterEach(() => document.body.replaceChildren());

describe('input', () => {
  it('gives a treat to the plate tapped', () => {
    const { canvas, intents, input } = setup(playing('sharing', 3));
    const seat = seats(3)[2]!;
    tap(canvas, seat.x, seat.y - 60);
    expect(intents).toEqual([{ kind: 'tap', plate: 2 }]);
    input.dispose();
  });

  it('invites a friend waiting at the fence, and sends back a friend at the table, but not the host', () => {
    const state = (): InputState => ({ phase: 'playing', table: 'inviting', seated: 2, food: null, waiting: [2, 3], seatedFriends: [0, 1] });
    const { canvas, intents, input } = setup(state);
    const spot = fenceSpot(3);
    tap(canvas, spot.x, spot.y - 60);
    const [, guest] = seats(2);
    tap(canvas, guest!.x, guest!.y - 80);
    const [host] = seats(2);
    tap(canvas, host!.x, host!.y - 80);
    tap(canvas, SHARE.x, SHARE.y);
    expect(intents).toEqual([{ kind: 'invite', friend: 3 }, { kind: 'invite', friend: 1 }, { kind: 'share' }]);
    input.dispose();
  });

  it('turns the dial down on its left and up on its right, and shares from the button', () => {
    const { canvas, intents, input } = setup(playing('sharing'));
    tap(canvas, DIAL.x - 50, DIAL.y);
    tap(canvas, DIAL.x + 50, DIAL.y);
    tap(canvas, SHARE.x, SHARE.y);
    expect(intents).toEqual([{ kind: 'dial', step: -1 }, { kind: 'dial', step: 1 }, { kind: 'share' }]);
    input.dispose();
  });

  it('cuts with a swipe across the food, measured from its middle', () => {
    const { canvas, intents, input } = setup(playing('cutting', 2));
    const pizza = FOOD.pizza;
    pointer(canvas, 'pointerdown', pizza.x - pizza.rx * 1.2, pizza.y);
    pointer(canvas, 'pointermove', pizza.x, pizza.y);
    pointer(canvas, 'pointerup', pizza.x + pizza.rx * 1.2, pizza.y);
    expect(intents).toHaveLength(1);
    const cut = intents[0]!;
    expect(cut.kind).toBe('cut');
    if (cut.kind === 'cut') {
      expect(cut.from.x).toBeCloseTo(-1.2);
      expect(cut.to.x).toBeCloseTo(1.2);
      expect(cut.from.y).toBeCloseTo(0);
    }
    input.dispose();
  });

  it('moves the knife with the finger while cutting, and puts it down on letting go', () => {
    const canvas = canvasOf(1152, 768);
    const scene = createScene(NO_SPRITES);
    const knife: unknown[] = [];
    scene.knife = (from, to) => void knife.push(from === null ? null : to);
    const input = createInput(canvas, scene, () => {}, playing('cutting', 2));
    const pizza = FOOD.pizza;
    pointer(canvas, 'pointerdown', pizza.x - pizza.rx * 1.2, pizza.y);
    pointer(canvas, 'pointermove', pizza.x, pizza.y);
    pointer(canvas, 'pointerup', pizza.x + pizza.rx * 1.2, pizza.y);
    expect(knife).toHaveLength(2);
    expect(knife[0]).toEqual({ x: 0, y: 0 });
    expect(knife[1]).toBeNull();
    input.dispose();
  });

  it('does not cut with a swipe that starts far from the food', () => {
    const { canvas, intents, input } = setup(playing('cutting', 2));
    pointer(canvas, 'pointerdown', 60, 700);
    pointer(canvas, 'pointerup', 400, 700);
    expect(intents).toEqual([]);
    input.dispose();
  });

  it('ignores a second finger', () => {
    const { canvas, intents, input } = setup(playing('sharing'));
    pointer(canvas, 'pointerdown', SHARE.x, SHARE.y, 1);
    tap(canvas, DIAL.x + 50, DIAL.y, 2);
    pointer(canvas, 'pointerup', SHARE.x, SHARE.y, 1);
    expect(intents).toEqual([{ kind: 'share' }]);
    input.dispose();
  });

  it('moves on with a tap between rounds, but not with a finger that was already down', () => {
    let phase: Phase = 'playing';
    const { canvas, intents, input } = setup(() => ({ phase, table: 'sharing', seated: 3, food: null, waiting: [], seatedFriends: [] }));
    pointer(canvas, 'pointerdown', 500, 700);
    phase = 'done';
    pointer(canvas, 'pointerup', 500, 700);
    expect(intents).toEqual([]);
    tap(canvas, 500, 500);
    expect(intents).toEqual([{ kind: 'next' }]);
    input.dispose();
  });
});
