/**
 * The game's lettering.
 *
 * Chalkboard SE is a rounded, hand-drawn face that ships with iOS and macOS, so
 * the game reads as something drawn by hand rather than typed, and it does it
 * without shipping a font file or fetching one - which matters for a game meant
 * to work on a plane. The rest of the stack is what to fall back to elsewhere,
 * in the same spirit.
 */
export const HAND = "'Chalkboard SE', 'Marker Felt', 'Comic Sans MS', system-ui, sans-serif";

/** A hand-drawn face at a weight and size. */
export const hand = (weight: number, size: number): string => `${weight} ${size}px ${HAND}`;
