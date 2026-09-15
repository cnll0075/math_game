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
/** How much of its own width each animal shares with the one beside it. */
const TUCK = 0.66;

/**
 * Evenly spaced x offsets, centred on the platform. Animals stay readable as
 * individuals — never an unreadable pile — by tightening the spacing as the
 * platform fills rather than by overflowing it.
 */
export interface Row {
  /** How big everything in the row is drawn, 0..maxScale. */
  scale: number;
  /** Each animal's centre, measured from the middle of the basket. */
  offsets: number[];
}

/**
 * A row of animals arranged to fit inside a basket.
 *
 * Spacing cannot be decided without knowing how wide the animals are: two bears
 * and two chickens are the same count and nothing like the same armful. So the
 * row is laid out at full size first and then shrunk to fit, which keeps a lone
 * animal as big as the art allows and asks a crowd to step back instead of
 * letting it spill over the basket's sides and off the screen.
 */
export function layOutRow(widths: readonly number[], inner: number, maxScale: number): Row {
  if (widths.length === 0) return { scale: maxScale, offsets: [] };

  // Neighbours tuck in behind one another rather than standing clear: a crowd
  // in a basket overlaps, and holding them all apart would shrink them to
  // nothing long before the basket was full.
  const strides: number[] = [];
  for (let i = 1; i < widths.length; i += 1) {
    strides.push(((widths[i - 1] ?? 0) + (widths[i] ?? 0)) / 2 * TUCK);
  }
  const span = strides.reduce((total, stride) => total + stride, 0);
  const extent = span + ((widths[0] ?? 0) + (widths.at(-1) ?? 0)) / 2;
  const scale = Math.min(maxScale, extent > 0 ? inner / extent : maxScale);

  const offsets: number[] = [];
  let x = -span / 2;
  for (let i = 0; i < widths.length; i += 1) {
    offsets.push(x * scale);
    x += strides[i] ?? 0;
  }
  return { scale, offsets };
}
