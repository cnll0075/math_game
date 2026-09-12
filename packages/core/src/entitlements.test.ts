import { describe, it, expect } from 'vitest';
import { createContentManifest } from './entitlements.js';

describe('createContentManifest', () => {
  it('unlocks everything under the all manifest', () => {
    expect(createContentManifest('all').isUnlocked('seesaw:level-5')).toBe(true);
  });

  it('unlocks only listed content otherwise', () => {
    const manifest = createContentManifest(['seesaw:level-1']);
    expect(manifest.isUnlocked('seesaw:level-1')).toBe(true);
    expect(manifest.isUnlocked('seesaw:level-2')).toBe(false);
  });

  it('unlocks nothing for an empty list', () => {
    expect(createContentManifest([]).isUnlocked('seesaw')).toBe(false);
  });
});
