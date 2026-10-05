/** One board on the ladder. */
export interface BoardDef {
  id: string;
  size: number;
  /** The biggest number any sum on the board reaches. */
  limit: number;
  title: string;
}

const board = (size: number): BoardDef => ({
  id: `board-${size}`,
  size,
  limit: size <= 3 ? 10 : 20,
  title: `${size} × ${size}`,
});

/** Eight square boards, 2×2 to 9×9. Board size is the whole of the difficulty. */
export const BOARDS: readonly BoardDef[] = [2, 3, 4, 5, 6, 7, 8, 9].map(board);

export const padsOf = (def: BoardDef): number => def.size * def.size;
export const pairsOf = (def: BoardDef): number => Math.floor(padsOf(def) / 2);
/** An odd board has a free ★ pad in the very middle, so every other pad has a partner. */
export const starIndexOf = (def: BoardDef): number | null => (padsOf(def) % 2 === 1 ? (padsOf(def) - 1) / 2 : null);
export const boardById = (id: string): BoardDef | undefined => BOARDS.find((def) => def.id === id);
