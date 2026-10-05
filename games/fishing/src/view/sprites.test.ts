import { describe, it, expect } from 'vitest';
import { loadSprites } from './sprites.js';

describe('the sprites', () => {
  it('knows every picture on the board, and settles without a browser to load in', async () => {
    const { sprites, ready } = loadSprites();
    await ready;
    for (const name of ['backdrop', 'fisherman', 'boat', 'bucket', 'timer', 'clownfish', 'jellyfish', 'speed-potion', 'treasure']) {
      expect(sprites).toHaveProperty(name, null);
    }
  });
});
