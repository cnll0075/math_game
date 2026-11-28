import { describe, it, expect } from 'vitest';
import { loadSprites } from './sprites.js';

describe('the sprites', () => {
  it('knows every picture cut from the sheets, and settles without a browser to load in', async () => {
    const { sprites, ready } = loadSprites();
    await ready;
    for (const name of ['backdrop', 'glider', 'weaver', 'blimp', 'piece-1', 'piece-2', 'scout', 'hider', 'treasure', 'cloud-1', 'fighter', 'fighter-hot', 'shell', 'pop', 'fuel', 'score', 'heart', 'heart-empty', 'heart-cracked', 'ribbon', 'plaque', 'card']) {
      expect(sprites).toHaveProperty(name, null);
    }
  });
});
