import { DESIGN, type Point } from '@bundle/core';
import { FROG } from './frog.js';

/** Where everything sits, in design coordinates. */
export const LAYOUT = {
  /** The top bar: Boards left, the board's name centre, stars right. */
  hudY: 46,
  pondLeft: 60,
  pondRight: 1092,
  /** Below the painted shore, so every pad sits on water. */
  pondTop: 150,
  pondBottom: 744,
  /** A small board's pads stop growing here, so they never become posters. */
  maxPad: { w: 220, h: 140 },
  gap: 10,
  boardsButton: { left: 24, top: 18, width: 150, height: 56 },
  /** The picker: two rows of four boards. */
  picker: { left: 156, top: 196, width: 840, height: 440, cols: 4 },
} as const;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const inside = (point: Point, rect: Rect): boolean =>
  point.x >= rect.x && point.x <= rect.x + rect.w && point.y >= rect.y && point.y <= rect.y + rect.h;

/** The pad at `index` (row by row) on a `size`×`size` board, the grid centred in the pond. */
export function padRect(size: number, index: number): Rect {
  const areaW = LAYOUT.pondRight - LAYOUT.pondLeft;
  const areaH = LAYOUT.pondBottom - LAYOUT.pondTop;
  const w = Math.min(LAYOUT.maxPad.w, areaW / size - LAYOUT.gap);
  const h = Math.min(LAYOUT.maxPad.h, areaH / size - LAYOUT.gap);
  const gridW = size * (w + LAYOUT.gap) - LAYOUT.gap;
  const gridH = size * (h + LAYOUT.gap) - LAYOUT.gap;
  const left = LAYOUT.pondLeft + (areaW - gridW) / 2;
  const top = LAYOUT.pondTop + (areaH - gridH) / 2;
  const row = Math.floor(index / size);
  const col = index % size;
  return { x: left + col * (w + LAYOUT.gap), y: top + row * (h + LAYOUT.gap), w, h };
}

/** Lettering as big as a pad allows: tall enough to read, narrow enough for `13 − 5`. */
export const padFont = (size: number): number => {
  const { w, h } = padRect(size, 0);
  return Math.min(h * 0.45, w / 4);
};

export function padAt(point: Point, size: number): number | null {
  for (let index = 0; index < size * size; index += 1) if (inside(point, padRect(size, index))) return index;
  return null;
}

export const inBoardsButton = (point: Point): boolean => {
  const { left, top, width, height } = LAYOUT.boardsButton;
  return inside(point, { x: left, y: top, w: width, h: height });
};

export function pickerRect(index: number): Rect {
  const { left, top, width, height, cols } = LAYOUT.picker;
  const cellW = width / cols;
  const cellH = height / 2;
  return { x: left + (index % cols) * cellW + 10, y: top + Math.floor(index / cols) * cellH + 10, w: cellW - 20, h: cellH - 20 };
}

export function pickerAt(point: Point): number | null {
  for (let index = 0; index < 8; index += 1) if (inside(point, pickerRect(index))) return index;
  return null;
}

export const inPickerPanel = (point: Point): boolean => {
  const { left, top, width, height } = LAYOUT.picker;
  return inside(point, { x: left, y: top, w: width, h: height });
};

/** The patch of pond a board's pads cover, with a little room around it. */
function gridBounds(size: number, margin: number): Rect {
  const first = padRect(size, 0);
  const last = padRect(size, size * size - 1);
  return { x: first.x - margin, y: first.y - margin, w: last.x + last.w - first.x + 2 * margin, h: last.y + last.h - first.y + 2 * margin };
}

/** Spots on the bank along the top, between the Boards button, the board's name and the stars. */
const SHORE: readonly Point[] = [
  { x: 260, y: 136 },
  { x: 400, y: 136 },
  { x: 760, y: 136 },
  { x: 900, y: 136 },
];

/**
 * Where the frog may sit on a board: open water and the bank, never over a pad,
 * so it can never get between a child and the game. A small board leaves most
 * of the pond open; on 9×9 only the bank is left.
 */
export function frogSpots(size: number): Point[] {
  const pads = gridBounds(size, 12);
  const candidates: Point[] = [...SHORE];
  for (let y = 240; y <= DESIGN.height - 30; y += 70) {
    for (let x = 70; x <= DESIGN.width - 70; x += 70) candidates.push({ x, y });
  }
  return candidates.filter((spot) => {
    const frog: Rect = { x: spot.x - FROG.reach, y: spot.y - FROG.height, w: FROG.reach * 2, h: FROG.height };
    return frog.x + frog.w <= pads.x || pads.x + pads.w <= frog.x || frog.y + frog.h <= pads.y || pads.y + pads.h <= frog.y;
  });
}
