/** Everything a tap can mean. Input produces these; the driver acts on them. */
export type Intent =
  | { kind: 'flip'; index: number }
  | { kind: 'picker' }
  | { kind: 'pick'; index: number }
  | { kind: 'close' }
  | { kind: 'next' };
