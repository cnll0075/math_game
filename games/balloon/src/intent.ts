/** Everything a tap can mean. Input produces these; the driver acts on them. */
export type Intent =
  | { kind: 'tray'; index: number }
  | { kind: 'clipped'; slot: number }
  | { kind: 'tied'; index: number }
  | { kind: 'puff'; index: number }
  | { kind: 'puffSlot'; slot: number }
  | { kind: 'letGo' }
  | { kind: 'next' };
