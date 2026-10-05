import { describe, it, expect } from 'vitest';
import { BOARDS } from '../logic/boards.data.js';
import { DESIGN } from '@bundle/core';
import { frogSpots, inBoardsButton, inOpenWater, inPickerPanel, LAYOUT, padAt, padFont, padRect, pickerAt, pickerRect } from './geometry.js';

describe('geometry', () => {
  it('keeps every pad of every board inside the pond, apart from its neighbours', () => {
    for (const board of BOARDS) {
      const pads = Array.from({ length: board.size * board.size }, (_, index) => padRect(board.size, index));
      for (const pad of pads) {
        expect(pad.x, board.id).toBeGreaterThanOrEqual(LAYOUT.pondLeft);
        expect(pad.y, board.id).toBeGreaterThanOrEqual(LAYOUT.pondTop);
        expect(pad.x + pad.w, board.id).toBeLessThanOrEqual(LAYOUT.pondRight);
        expect(pad.y + pad.h, board.id).toBeLessThanOrEqual(LAYOUT.pondBottom);
      }
      const right = padRect(board.size, 1);
      const below = padRect(board.size, board.size);
      expect(right.x - (pads[0]!.x + pads[0]!.w), board.id).toBeGreaterThan(0);
      expect(below.y - (pads[0]!.y + pads[0]!.h), board.id).toBeGreaterThan(0);
    }
  });

  it('keeps pads big enough to tap and sums big enough to read, even on 9×9', () => {
    const pad = padRect(9, 0);
    expect(pad.w).toBeGreaterThanOrEqual(100);
    expect(pad.h).toBeGreaterThanOrEqual(54);
    expect(padFont(9)).toBeGreaterThanOrEqual(24);
  });

  it('caps the pads on a small board', () => {
    expect(padRect(2, 0).w).toBeLessThanOrEqual(LAYOUT.maxPad.w);
    expect(padRect(2, 0).h).toBeLessThanOrEqual(LAYOUT.maxPad.h);
  });

  it('finds the pad under a finger, and nothing between pads', () => {
    for (const size of [2, 5, 9]) {
      for (const index of [0, size + 1, size * size - 1]) {
        const pad = padRect(size, index);
        expect(padAt({ x: pad.x + pad.w / 2, y: pad.y + pad.h / 2 }, size)).toBe(index);
      }
    }
    const first = padRect(9, 0);
    expect(padAt({ x: first.x + first.w + 2, y: first.y + first.h / 2 }, 9)).toBeNull();
  });

  it('finds the Boards button, and every board in the picker', () => {
    const button = LAYOUT.boardsButton;
    expect(inBoardsButton({ x: button.left + 10, y: button.top + 10 })).toBe(true);
    for (let index = 0; index < BOARDS.length; index += 1) {
      const rect = pickerRect(index);
      expect(pickerAt({ x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 })).toBe(index);
      expect(inPickerPanel({ x: rect.x + 4, y: rect.y + 4 })).toBe(true);
    }
    expect(inPickerPanel({ x: 10, y: 740 })).toBe(false);
  });

  it('starts the pond below the painted shore, so every pad sits on water', () => {
    expect(LAYOUT.pondTop).toBeGreaterThanOrEqual(185);
  });

  it('finds open water for the frog on every board, never on or beside a pad', () => {
    for (const board of BOARDS) {
      const spots = frogSpots(board.size);
      expect(spots.length, board.id).toBeGreaterThanOrEqual(2);
      for (const spot of spots) {
        expect(inOpenWater(spot), `${board.id} ${spot.x},${spot.y}`).toBe(true);
        expect(spot.x, board.id).toBeGreaterThanOrEqual(0);
        expect(spot.x, board.id).toBeLessThanOrEqual(DESIGN.width);
        for (let index = 0; index < board.size * board.size; index += 1) {
          const pad = padRect(board.size, index);
          const clear = spot.x < pad.x - 8 || spot.x > pad.x + pad.w + 8 || spot.y < pad.y - 8 || spot.y > pad.y + pad.h + 8;
          expect(clear, `${board.id} spot ${spot.x},${spot.y} beside pad ${index}`).toBe(true);
        }
      }
    }
  });

  it('keeps the frog out of the bank and the plants', () => {
    expect(inOpenWater({ x: 600, y: 120 })).toBe(false); // the far bank
    expect(inOpenWater({ x: 80, y: 700 })).toBe(false); // the plant at the bottom left
    expect(inOpenWater({ x: 1110, y: 700 })).toBe(false); // the plant at the bottom right
    expect(inOpenWater({ x: 600, y: 500 })).toBe(true);
  });

  it('gives the frog the whole open pond on a small board', () => {
    expect(frogSpots(2).length).toBeGreaterThan(frogSpots(9).length);
  });
});
