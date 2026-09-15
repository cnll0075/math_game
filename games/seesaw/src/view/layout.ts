export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

/**
 * The coordinate system every draw call uses, scaled to whatever screen.
 * 3:2 rather than 4:3: iPad landscape is wider than 4:3, and the extra width is
 * what lets the seesaw fill the screen instead of sitting in a middle band.
 */
export const DESIGN: Size = { width: 1152, height: 768 };

export interface ViewTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
  toScreen(point: Point): Point;
  toDesign(point: Point): Point;
}

/** A rectangle in design coordinates. */
export interface Bounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * The whole canvas expressed in design coordinates. The design rect is always
 * inside it; on a screen whose shape differs, the surplus is the area that
 * would otherwise be letterboxed. Scenery is painted across this so there are
 * no bars, while gameplay stays inside the design rect where it is always
 * visible.
 */
export function visibleBounds(screen: Size, transform: ViewTransform): Bounds {
  const topLeft = transform.toDesign({ x: 0, y: 0 });
  const bottomRight = transform.toDesign({ x: screen.width, y: screen.height });
  return { left: topLeft.x, top: topLeft.y, right: bottomRight.x, bottom: bottomRight.y };
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
const MAX_SPACING = 88;

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
