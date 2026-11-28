import { describe, it, expect } from 'vitest';
import { loadSprites } from './sprites.js';

describe('the sprites', () => {
  it('knows every picture cut from the sheet, and settles without a browser to load in', async () => {
    const { sprites, ready } = loadSprites();
    await ready;
    for (const name of ['table', 'basket', 'chair', 'dog-sneak', 'cookie', 'cake-slice', 'dial', 'share', 'fence', 'grass', 'teddy-happy', 'raccoon-grumpy']) {
      expect(sprites).toHaveProperty(name, null);
    }
  });
});
