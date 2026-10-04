import type { Point } from '@bundle/core';

/** Where everything sits, in design coordinates. */
export const LAYOUT = {
  /** The top bar: Boards left, the board's name centre, stars right. */
  hudY: 46,
  pondLeft: 60,
  pondRight: 1092,
  pondTop: 108,
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
