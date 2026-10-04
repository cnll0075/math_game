/** Everything a tap or a drop can mean. Input produces these; the driver acts on them. */
export type Intent =
  /** A tray balloon onto a kit: the one it was dropped on, or the selected one for a tap. */
  | { kind: 'tray'; index: number; kit?: number }
  | { kind: 'clipped'; kit: number; slot: number }
  | { kind: 'tied'; index: number }
  | { kind: 'select'; kit: number }
  | { kind: 'reset' }
  | { kind: 'letGo' }
  | { kind: 'next' };
