export { DESIGN, fitToScreen, visibleBounds, type Bounds, type Point, type Size, type ViewTransform } from '@bundle/core';

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
