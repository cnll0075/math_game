/**
 * What the player is allowed to open. This is the single place a real purchase
 * check will live; games only ever ask whether a content id is unlocked, so the
 * monetisation model can change without touching gameplay code.
 */
export interface ContentManifest {
  isUnlocked(contentId: string): boolean;
}

export function createContentManifest(unlocked: 'all' | readonly string[]): ContentManifest {
  if (unlocked === 'all') return { isUnlocked: () => true };
  const allowed = new Set(unlocked);
  return { isUnlocked: (contentId) => allowed.has(contentId) };
}
