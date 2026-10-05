import { DESIGN, type Point } from '@bundle/core';

/** Where everything sits, in design coordinates. */
export const LAYOUT = {
  /** The top bar: Boards left, the board's name centre, stars right. */
  hudY: 46,
  pondLeft: 60,
  pondRight: 1092,
  /** Below the painted shore, so every pad sits on water. */
  pondTop: 185,
  pondBottom: 764,
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

/** The painted pond's open water, in design coordinates: below the bank, clear of the plants. */
const WATER = {
  top: 205,
  bottom: 755,
  /** The plants that grow into the water at the two near corners. */
  plants: [
    { x: 0, y: 545, w: 175, h: 223 },
    { x: 1035, y: 590, w: 117, h: 178 },
  ],
} as const;

export const inOpenWater = (point: Point): boolean =>
  point.y >= WATER.top &&
  point.y <= WATER.bottom &&
  !WATER.plants.some((plant) => point.x >= plant.x && point.x <= plant.x + plant.w && point.y >= plant.y && point.y <= plant.y + plant.h);

const SPOT_COLUMNS = [20, 40, ...Array.from({ length: 26 }, (_, index) => 80 + index * 40), 1110, 1132];

const cache = new Map<number, Point[]>();

/**
 * Where the frog may leap out of or into the water on a board: open water, and
 * never on or right beside a pad, so a splash never lands on one. A small board
 * leaves most of the pond open; a big one only its edges and the strip below.
 */
export function frogSpots(size: number): Point[] {
  const known = cache.get(size);
  if (known) return known;
  const pads = gridBounds(size, 8);
  const spots: Point[] = [];
  for (let y = 220; y <= WATER.bottom; y += 40) {
    for (const x of SPOT_COLUMNS) {
      const spot = { x, y };
      const onPads = x >= pads.x && x <= pads.x + pads.w && y >= pads.y && y <= pads.y + pads.h;
      if (!onPads && inOpenWater(spot)) spots.push(spot);
    }
  }
  cache.set(size, spots);
  return spots;
}
