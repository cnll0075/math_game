export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

/** The coordinate system every draw call uses, scaled to whatever screen. */
export const DESIGN: Size = { width: 1024, height: 768 };

export interface ViewTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
  toScreen(point: Point): Point;
  toDesign(point: Point): Point;
}

/** Fits the design space inside the screen, letterboxing the leftover. */
export function fitToScreen(screen: Size, design: Size = DESIGN): ViewTransform {
  const scale = Math.min(screen.width / design.width, screen.height / design.height) || 1;
  const offsetX = (screen.width - design.width * scale) / 2;
  const offsetY = (screen.height - design.height * scale) / 2;

  return {
    scale,
    offsetX,
    offsetY,
    toScreen: (point) => ({ x: point.x * scale + offsetX, y: point.y * scale + offsetY }),
    toDesign: (point) => ({ x: (point.x - offsetX) / scale, y: (point.y - offsetY) / scale }),
  };
}

/** Widest gap we bother with; beyond this the animals look scattered. */
const MAX_SPACING = 78;

/**
 * Evenly spaced x offsets, centred on the platform. Animals stay readable as
 * individuals — never an unreadable pile — by tightening the spacing as the
 * platform fills rather than by overflowing it.
 */
export function slotPositions(count: number, platformWidth: number): number[] {
  if (count <= 0) return [];
  const usable = platformWidth - 24;
  const spacing = Math.min(MAX_SPACING, usable / Math.max(count, 1));
  const start = -((count - 1) * spacing) / 2;
  return Array.from({ length: count }, (_, index) => start + index * spacing);
}
